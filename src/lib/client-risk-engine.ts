import { prisma } from "./prisma";
import { extractClientName, normalizeForAlias, UNIDENTIFIED_SOURCE } from "./client-identity";
import type { ClientConfidence } from "./client-identity";
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

export interface ClientRiskCenterData {
  clients: ClientRiskProfile[];
  totalRevenue: number;
  currentCount: number;    // active relationships (current + watch + risk)
  followUpCount: number;   // active clients with unusual payment timing (watch + risk)
  inactiveCount: number;   // concluded relationships
  hasIntentData: boolean;
}

// ── Status computation ────────────────────────────────────────────────────────

function computeStatus(avgIntervalDays: number | null, currentGapDays: number): ClientStatus {
  // "inactive" = relationship has concluded.
  // Threshold: 3× their usual interval, min 6 months, max 18 months.
  // This avoids false alarms for quarterly or annual payers.
  const inactiveThreshold = avgIntervalDays && avgIntervalDays > 0
    ? Math.min(Math.max(avgIntervalDays * 3, 180), 548)
    : 180;

  if (currentGapDays >= inactiveThreshold) return "inactive";

  // Active client — evaluate timeliness against their own historical pattern
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

  // Inactive clients have no outstanding payment — no follow-up needed
  if (p.status !== "inactive") {
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

export async function getClientRiskProfiles(userId: string): Promise<ClientRiskCenterData> {
  // Primary: intent-classified income (most accurate signal for real client payments)
  let txs = await prisma.transaction.findMany({
    where: { userId, intent: { in: ["freelance_income", "salary"] } },
    select: { description: true, amount: true, transactionDate: true, category: true },
    orderBy: { transactionDate: "asc" },
  });

  const hasIntentData = txs.length >= 3;

  // Fallback: income filtered to likely client receipts.
  // Excludes refunds (reversed user purchases) and micro-amounts (bank interest, cashback).
  if (!hasIntentData) {
    txs = await prisma.transaction.findMany({
      where: {
        userId,
        transactionType: "income",
        amount: { gte: 5 },
        NOT: { category: { in: ["refund"] } },
      },
      select: { description: true, amount: true, transactionDate: true, category: true },
      orderBy: { transactionDate: "asc" },
    });
  }

  if (txs.length === 0) {
    return { clients: [], totalRevenue: 0, currentCount: 0, followUpCount: 0, inactiveCount: 0, hasIntentData: false };
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

  const totalRevenue = txs.reduce((s, t) => s + Number(t.amount), 0);

  // ── Phase 1: Extract and group by alias-normalized key ───────────────────────
  // Two-level grouping:
  //   aliasKey → canonicalName → { txs[], confidence, isProcessor }
  //
  // aliasKey strips legal suffixes so "ACME LTD" and "ACME LIMITED" map to the
  // same key. The canonical name is the one that appears most often.

  const aliasGroups: Record<string, {
    names: Record<string, { count: number; confidence: ClientConfidence; isProcessor: boolean }>;
    txs: { amount: number; date: Date; description: string }[];
  }> = {};

  for (const tx of txs) {
    const result = extractClientName(tx.description, tx.category);

    // Low or unknown confidence → merge into the unidentified bucket
    const effectiveName =
      result.confidence === "unknown" || result.confidence === "low"
        ? UNIDENTIFIED_SOURCE
        : result.name;

    const aliasKey = normalizeForAlias(effectiveName);

    if (!aliasGroups[aliasKey]) {
      aliasGroups[aliasKey] = { names: {}, txs: [] };
    }

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

  // ── Phase 2: Pick canonical name per group ────────────────────────────────────
  // Canonical = the name variant with the highest payment count.
  // Confidence = that of the most-used variant.

  const map: Record<string, {
    name: string;
    confidence: ClientConfidence;
    isProcessor: boolean;
    txs: { amount: number; date: Date; description: string }[];
  }> = {};

  for (const [aliasKey, group] of Object.entries(aliasGroups)) {
    const canonical = Object.entries(group.names)
      .sort((a, b) => b[1].count - a[1].count)[0];

    // Use the correctly-cased name from the first transaction that produced it
    // (extractClientName already title-cases), not the uppercased map key.
    // We need to re-extract for the canonical key — take the most common name's
    // display form directly from what extractClientName already returned.
    // Since we stored it title-cased as effectiveName above, recover from the key:
    const displayName = canonical[0] === UNIDENTIFIED_SOURCE.toUpperCase()
      ? UNIDENTIFIED_SOURCE
      : canonical[0].split(" ").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");

    map[aliasKey] = {
      name: displayName,
      confidence: canonical[1].confidence,
      isProcessor: canonical[1].isProcessor,
      txs: group.txs,
    };
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
    const status = computeStatus(avgIntervalDays, currentGapDays);
    const lifecycle: ClientLifecycle = status === "inactive" ? "inactive" : "current";
    const dependencyRisk = computeDependencyRisk(revenueContributionPct);

    const recentMonthlyAvg = ((monthlyRevenue[3]?.amount ?? 0) + (monthlyRevenue[4]?.amount ?? 0) + (monthlyRevenue[5]?.amount ?? 0)) / 3;
    const priorMonthlyAvg  = ((monthlyRevenue[0]?.amount ?? 0) + (monthlyRevenue[1]?.amount ?? 0) + (monthlyRevenue[2]?.amount ?? 0)) / 3;

    const partial: PartialProfile = {
      name: c.name,
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

  return {
    clients:       profiles,
    totalRevenue,
    currentCount:  profiles.filter(p => p.lifecycle === "current").length,
    followUpCount: profiles.filter(p => p.status === "watch" || p.status === "risk").length,
    inactiveCount: profiles.filter(p => p.lifecycle === "inactive").length,
    hasIntentData,
  };
}
