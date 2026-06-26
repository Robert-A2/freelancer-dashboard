import { prisma } from "./prisma";
import { extractClientName, normalizeForAlias, UNIDENTIFIED_SOURCE } from "./client-identity";
import type { ClientConfidence } from "./client-identity";
import { descriptionFingerprint } from "./payer-engine";
import { getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

// ── Status terminology ────────────────────────────────────────────────────────
// "current"  — active client, paying on time
// "watch"    — active client, payment timing becoming unusual
// "risk"     — active client, significantly overdue vs. historical pattern
// "inactive" — relationship has concluded; no outstanding payment expected
export type ClientStatus = "current" | "watch" | "risk" | "inactive";
export type ClientLifecycle = "current" | "inactive";
export type DependencyRisk = "low" | "medium" | "high";
export type RevenueTrend = "increasing" | "stable" | "declining";
export type ReliabilityScore = "excellent" | "good" | "watch" | "risk" | "inactive";

export interface MonthlyRevenue {
  year: number;
  month: number;
  label: string;
  amount: number;
}

export interface ClientInsight {
  type: "reliable" | "delayWarning" | "dependency" | "decline" | "singlePayment";
  params: Record<string, number>;
}

export interface ClientAction {
  type: "followUp" | "monitor" | "noAction";
}

export interface ClientPayment {
  date: string;
  amount: number;
  description: string;
}

export interface ClientRiskProfile {
  name: string;
  payerId: string | null;          // null in fallback path (payer engine not yet run)
  canonicalName: string;           // system-extracted name; equals name unless user corrected
  confidence: ClientConfidence;    // how certain we are this is a real client identity
  isProcessor: boolean;
  totalRevenue: number;
  revenueContributionPct: number;
  paymentCount: number;
  avgPayment: number;
  largestPayment: number;
  firstPayment: string;
  lastPayment: string;
  monthsActive: number;
  avgIntervalDays: number | null;
  currentGapDays: number;
  status: ClientStatus;
  lifecycle: ClientLifecycle;
  dependencyRisk: DependencyRisk;
  monthlyRevenue: MonthlyRevenue[];
  revenueTrend: RevenueTrend | null;
  revenueTrendPct: number | null;
  insights: ClientInsight[];
  actions: ClientAction[];
  payments: ClientPayment[];
  reliabilityScore: ReliabilityScore;
  recentMonthlyAvg: number;
  priorMonthlyAvg: number;
  rawDescriptions: string[]; // kept for the payment timeline — ground truth
}

export interface UnresolvedGroup {
  fingerprint: string;
  description: string;   // example raw description from one of the matching transactions
  totalRevenue: number;
  txCount: number;
  lastDate: Date;
}

export interface ClientRiskCenterData {
  clients: ClientRiskProfile[];
  totalRevenue: number;
  currentCount: number;    // active relationships (current + watch + risk)
  followUpCount: number;   // active clients with unusual payment timing (watch + risk)
  inactiveCount: number;   // concluded relationships
  hasIntentData: boolean;
  unresolvedGroups: UnresolvedGroup[];
}

// ── Status computation ────────────────────────────────────────────────────────

function computeStatus(avgIntervalDays: number | null, currentGapDays: number, paymentCount: number): ClientStatus {
  // "inactive" = relationship has concluded.
  // Threshold: 3× their usual interval, min 6 months, max 18 months.
  // This avoids false alarms for quarterly or annual payers.
  const inactiveThreshold = avgIntervalDays && avgIntervalDays > 0
    ? Math.min(Math.max(avgIntervalDays * 3, 180), 548)
    : 180;

  if (currentGapDays >= inactiveThreshold) return "inactive";

  // Single and dual payments: no established cadence — never classify as "risk".
  // A client with 1-2 payments has no proven payment pattern, so we cannot
  // say they are "overdue." Showing "follow up" for them creates false urgency.
  if (paymentCount < 3) {
    if (avgIntervalDays === null || avgIntervalDays === 0) return "current";
    if (currentGapDays > avgIntervalDays * 1.2) return "watch";
    return "current";
  }

  // 3+ payments: established cadence — full pattern assessment applies.
  if (avgIntervalDays === null || avgIntervalDays === 0) return "current";
  if (currentGapDays > avgIntervalDays * 1.5) return "risk";
  if (currentGapDays > avgIntervalDays * 1.2) return "watch";
  return "current";
}

function computeDependencyRisk(pct: number): DependencyRisk {
  if (pct >= 50) return "high";
  if (pct >= 25) return "medium";
  return "low";
}

interface TrendResult {
  trend: RevenueTrend | null;
  trendPct: number | null;
}

function computeTrend(monthly: MonthlyRevenue[]): TrendResult {
  if (monthly.length < 6) return { trend: null, trendPct: null };
  const last3 = (monthly[3].amount + monthly[4].amount + monthly[5].amount) / 3;
  const prev3 = (monthly[0].amount + monthly[1].amount + monthly[2].amount) / 3;
  if (last3 === 0 && prev3 === 0) return { trend: null, trendPct: null };
  if (prev3 === 0) return { trend: "increasing", trendPct: null };
  const changePct = (last3 - prev3) / prev3;
  const pct = Math.abs(Math.round(changePct * 100));
  if (changePct > 0.1) return { trend: "increasing", trendPct: pct };
  if (changePct < -0.1) return { trend: "declining", trendPct: pct };
  return { trend: "stable", trendPct: pct };
}

// ── Insights & actions ────────────────────────────────────────────────────────

type PartialProfile = Omit<ClientRiskProfile, "insights" | "actions">;

function buildInsights(p: PartialProfile): ClientInsight[] {
  const insights: ClientInsight[] = [];
  const isInactive = p.status === "inactive";

  if (!isInactive) {
    if (p.status === "current" && p.paymentCount >= 5 && p.monthsActive >= 3) {
      insights.push({ type: "reliable", params: { count: p.paymentCount, months: p.monthsActive } });
    }
    if ((p.status === "watch" || p.status === "risk") && p.avgIntervalDays !== null && p.avgIntervalDays > 0) {
      insights.push({ type: "delayWarning", params: { avgDays: Math.round(p.avgIntervalDays), currentGap: p.currentGapDays } });
    }
  }

  if (p.revenueContributionPct >= 25) {
    insights.push({ type: "dependency", params: { pct: p.revenueContributionPct } });
  }

  if (!isInactive && p.revenueTrend === "declining" && p.revenueTrendPct !== null) {
    insights.push({ type: "decline", params: { pct: p.revenueTrendPct } });
  }

  if (p.paymentCount === 1) {
    insights.push({ type: "singlePayment", params: {} });
  }

  return insights;
}

function buildActions(p: PartialProfile): ClientAction[] {
  const actions: ClientAction[] = [];
  const isOverdue = p.avgIntervalDays !== null && p.currentGapDays > p.avgIntervalDays * 1.2;

  // Inactive clients have no outstanding payment — no follow-up needed.
  // Payment processors (platforms) are not individual clients — no follow-up.
  // Clients with fewer than 3 payments have no proven cadence — no follow-up.
  if (p.status !== "inactive" && !p.isProcessor && p.paymentCount >= 3) {
    if (p.status === "risk" || (p.status === "watch" && isOverdue)) {
      actions.push({ type: "followUp" });
    }
    if (p.revenueTrend === "declining") {
      actions.push({ type: "monitor" });
    }
  }

  if (actions.length === 0) {
    actions.push({ type: "noAction" });
  }

  return actions;
}

function computeReliabilityScore(p: PartialProfile): ReliabilityScore {
  if (p.status === "inactive") return "inactive";
  if (p.status === "risk")     return "risk";
  if (p.status === "watch")    return "watch";
  if (p.paymentCount >= 6 && p.monthsActive >= 4 && p.revenueTrend !== "declining") return "excellent";
  if (p.paymentCount >= 3)     return "good";
  return "watch";
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getClientRiskProfiles(userId: string, accountId?: string | null): Promise<ClientRiskCenterData> {
  const acctFilter = accountId ? { accountId } : {};

  // Primary: payer-resolved transactions (payer engine has run).
  // Includes payer metadata so we can use user-corrected names (displayName).
  const primaryTxs = await prisma.transaction.findMany({
    where: {
      userId,
      ...acctFilter,
      transactionType: "income",
      payerId:         { not: null },
      amount:          { gte: 5 },
      payer:           { payerType: { notIn: ["bank", "government", "refund_source"] } },
    },
    select: {
      description: true, amount: true, transactionDate: true, category: true,
      payerId: true,
      payer: { select: { id: true, canonicalName: true, displayName: true, payerType: true } },
    },
    orderBy: { transactionDate: "asc" },
  });

  const hasIntentData = primaryTxs.length >= 3;

  // Fallback when payer engine hasn't run yet: intent-classified income.
  const fallbackTxs = !hasIntentData ? await prisma.transaction.findMany({
    where: { userId, ...acctFilter, intent: { in: ["freelance_income", "salary"] } },
    select: { description: true, amount: true, transactionDate: true, category: true },
    orderBy: { transactionDate: "asc" },
  }) : [];

  const activeTxCount = hasIntentData ? primaryTxs.length : fallbackTxs.length;
  if (activeTxCount === 0) {
    return { clients: [], totalRevenue: 0, currentCount: 0, followUpCount: 0, inactiveCount: 0, hasIntentData: false, unresolvedGroups: [] };
  }

  const locale = (await getLocale()) as Locale;
  const today = new Date();

  // Build 6-month window ending on the current month
  const months6: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months6.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: d.toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "2-digit", timeZone: "UTC" }),
    });
  }

  const totalRevenue = hasIntentData
    ? primaryTxs.reduce((s, t) => s + Number(t.amount), 0)
    : fallbackTxs.reduce((s, t) => s + Number(t.amount), 0);

  // ── Phase 1 & 2: Group transactions by client identity ───────────────────────

  const map: Record<string, {
    name: string;
    payerId: string | null;
    canonicalName: string;
    confidence: ClientConfidence;
    isProcessor: boolean;
    txs: { amount: number; date: Date; description: string }[];
  }> = {};

  if (hasIntentData) {
    // Primary path: use payer names from DB (respects user corrections via displayName).
    const payerBuckets: Record<string, {
      payer: { id: string; canonicalName: string; displayName: string | null; payerType: string };
      txs: { amount: number; date: Date; description: string }[];
    }> = {};

    for (const tx of primaryTxs) {
      if (!tx.payer || !tx.payerId) continue;
      if (!payerBuckets[tx.payerId]) {
        payerBuckets[tx.payerId] = { payer: tx.payer, txs: [] };
      }
      payerBuckets[tx.payerId].txs.push({
        amount: Number(tx.amount),
        date: new Date(tx.transactionDate),
        description: tx.description,
      });
    }

    for (const [payerId, data] of Object.entries(payerBuckets)) {
      const { payer, txs: ptxs } = data;
      const isProcessor = payer.payerType === "platform";
      const hasUserName = !!payer.displayName;

      const confidence: ClientConfidence =
        hasUserName ? "high" :
        payer.payerType === "platform" || payer.payerType === "employer" || payer.payerType === "client" ? "high" :
        ptxs.length >= 3 ? "high" :
        ptxs.length >= 2 ? "medium" : "low";

      map[payerId] = {
        name: payer.displayName ?? payer.canonicalName,
        payerId,
        canonicalName: payer.canonicalName,
        confidence,
        isProcessor,
        txs: ptxs,
      };
    }

  } else {
    // Fallback path: payer engine hasn't run — extract names from descriptions.
    const aliasGroups: Record<string, {
      names: Record<string, { count: number; confidence: ClientConfidence; isProcessor: boolean }>;
      txs: { amount: number; date: Date; description: string }[];
    }> = {};

    for (const tx of fallbackTxs) {
      const result = extractClientName(tx.description, tx.category);
      const effectiveName =
        result.confidence === "unknown" || result.confidence === "low"
          ? UNIDENTIFIED_SOURCE
          : result.name;
      const aliasKey = normalizeForAlias(effectiveName);

      if (!aliasGroups[aliasKey]) aliasGroups[aliasKey] = { names: {}, txs: [] };
      const nameKey = effectiveName.toUpperCase();
      if (!aliasGroups[aliasKey].names[nameKey]) {
        aliasGroups[aliasKey].names[nameKey] = { count: 0, confidence: result.confidence, isProcessor: result.isProcessor };
      }
      aliasGroups[aliasKey].names[nameKey].count += 1;
      aliasGroups[aliasKey].txs.push({
        amount: Number(tx.amount),
        date: new Date(tx.transactionDate),
        description: tx.description,
      });
    }

    for (const [aliasKey, group] of Object.entries(aliasGroups)) {
      const canonical = Object.entries(group.names).sort((a, b) => b[1].count - a[1].count)[0];
      const displayName = canonical[0] === UNIDENTIFIED_SOURCE.toUpperCase()
        ? UNIDENTIFIED_SOURCE
        : canonical[0].split(" ").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");
      map[aliasKey] = {
        name: displayName,
        payerId: null,
        canonicalName: displayName,
        confidence: canonical[1].confidence,
        isProcessor: canonical[1].isProcessor,
        txs: group.txs,
      };
    }
  }

  // ── Phase 3: Build risk profiles ─────────────────────────────────────────────

  const profiles: ClientRiskProfile[] = Object.values(map).map(c => {
    const sorted = [...c.txs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const totalRev  = sorted.reduce((s, t) => s + t.amount, 0);
    const first     = sorted[0].date;
    const last      = sorted[sorted.length - 1].date;
    const currentGapDays = Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86_400_000));
    const monthsActive = (last.getUTCFullYear() - first.getUTCFullYear()) * 12
                       + (last.getUTCMonth() - first.getUTCMonth()) + 1;

    let avgIntervalDays: number | null = null;
    if (sorted.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(Math.floor((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 86_400_000));
      }
      avgIntervalDays = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
    }

    const revenueContributionPct = totalRevenue > 0 ? Math.round((totalRev / totalRevenue) * 100) : 0;
    const avgPayment    = Math.round(totalRev / sorted.length);
    const largestPayment = Math.max(...sorted.map(t => t.amount));

    const monthlyRevenue: MonthlyRevenue[] = months6.map(m => ({
      ...m,
      amount: sorted
        .filter(t => t.date.getUTCFullYear() === m.year && t.date.getUTCMonth() + 1 === m.month)
        .reduce((s, t) => s + t.amount, 0),
    }));

    const { trend, trendPct } = computeTrend(monthlyRevenue);
    const status = computeStatus(avgIntervalDays, currentGapDays, sorted.length);
    const lifecycle: ClientLifecycle = status === "inactive" ? "inactive" : "current";
    const dependencyRisk = computeDependencyRisk(revenueContributionPct);

    const recentMonthlyAvg = ((monthlyRevenue[3]?.amount ?? 0) + (monthlyRevenue[4]?.amount ?? 0) + (monthlyRevenue[5]?.amount ?? 0)) / 3;
    const priorMonthlyAvg  = ((monthlyRevenue[0]?.amount ?? 0) + (monthlyRevenue[1]?.amount ?? 0) + (monthlyRevenue[2]?.amount ?? 0)) / 3;

    const partial: PartialProfile = {
      name: c.name,
      payerId: c.payerId,
      canonicalName: c.canonicalName,
      confidence: c.confidence,
      isProcessor: c.isProcessor,
      totalRevenue: totalRev,
      revenueContributionPct,
      paymentCount: sorted.length,
      avgPayment,
      largestPayment,
      firstPayment: first.toISOString(),
      lastPayment:  last.toISOString(),
      monthsActive,
      avgIntervalDays,
      currentGapDays,
      status,
      lifecycle,
      dependencyRisk,
      monthlyRevenue,
      revenueTrend: trend,
      revenueTrendPct: trendPct,
      payments: sorted.map(t => ({ date: t.date.toISOString(), amount: t.amount, description: t.description })).reverse(),
      reliabilityScore: "good", // placeholder, overwritten below
      recentMonthlyAvg,
      priorMonthlyAvg,
      rawDescriptions: [...new Set(sorted.map(t => t.description))],
    };

    const reliabilityScore = computeReliabilityScore(partial);
    return { ...partial, reliabilityScore, insights: buildInsights(partial), actions: buildActions(partial) };
  });

  // Sort: identified clients by revenue, unidentified last
  profiles.sort((a, b) => {
    if (a.name === UNIDENTIFIED_SOURCE && b.name !== UNIDENTIFIED_SOURCE) return 1;
    if (b.name === UNIDENTIFIED_SOURCE && a.name !== UNIDENTIFIED_SOURCE) return -1;
    return b.totalRevenue - a.totalRevenue;
  });

  // ── Phase 4: Unresolved transactions (payerId: null) ─────────────────────────
  // Income transactions where extractPayer() found nothing to work with.
  // Group by description fingerprint so the user can name each distinct pattern.

  const unresolvedTxs = await prisma.transaction.findMany({
    where: { userId, ...acctFilter, transactionType: "income", payerId: null, amount: { gte: 5 } },
    select: { description: true, amount: true, transactionDate: true },
    orderBy: { transactionDate: "desc" },
  });

  const unresolvedMap: Record<string, UnresolvedGroup> = {};
  for (const tx of unresolvedTxs) {
    const fp = descriptionFingerprint(tx.description);
    if (!unresolvedMap[fp]) {
      unresolvedMap[fp] = {
        fingerprint: fp,
        description: tx.description.slice(0, 80).trim(),
        totalRevenue: 0,
        txCount: 0,
        lastDate: new Date(tx.transactionDate),
      };
    }
    unresolvedMap[fp].totalRevenue += Number(tx.amount);
    unresolvedMap[fp].txCount += 1;
    const txDate = new Date(tx.transactionDate);
    if (txDate > unresolvedMap[fp].lastDate) unresolvedMap[fp].lastDate = txDate;
  }

  const unresolvedGroups = Object.values(unresolvedMap)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    clients:          profiles,
    totalRevenue,
    currentCount:     profiles.filter(p => p.lifecycle === "current").length,
    followUpCount:    profiles.filter(p => p.status === "watch" || p.status === "risk").length,
    inactiveCount:    profiles.filter(p => p.lifecycle === "inactive").length,
    hasIntentData,
    unresolvedGroups,
  };
}
