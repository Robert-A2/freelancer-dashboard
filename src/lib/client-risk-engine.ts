import { prisma } from "./prisma";
import { extractClientName } from "./analytics-engine";
import { getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

export type ClientStatus = "green" | "yellow" | "red" | "previous";
export type ClientLifecycle = "current" | "previous";
export type DependencyRisk = "low" | "medium" | "high";
export type RevenueTrend = "increasing" | "stable" | "declining";
export type ReliabilityScore = "excellent" | "good" | "watch" | "risk" | "previous";

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
}

export interface ClientRiskCenterData {
  clients: ClientRiskProfile[];
  totalRevenue: number;
  currentCount: number;    // active relationships (green + yellow + red)
  followUpCount: number;   // active clients who are late (yellow + red)
  previousCount: number;   // concluded/previous client relationships
  hasIntentData: boolean;
}

function computeStatus(avgIntervalDays: number | null, currentGapDays: number): ClientStatus {
  // A "previous" client is one whose relationship has clearly concluded —
  // the gap far exceeds their own payment pattern, not just a late payment.
  //
  // Threshold: 3× their usual interval, minimum 6 months, maximum 18 months.
  // This correctly handles monthly payers (6 months), quarterly (9 months),
  // and annual payers (18 months cap) without over-triggering on genuine delays.
  const previousThreshold = avgIntervalDays && avgIntervalDays > 0
    ? Math.min(Math.max(avgIntervalDays * 3, 180), 548)
    : 180;

  if (currentGapDays >= previousThreshold) return "previous";

  // Active client — evaluate payment timeliness against their own pattern
  if (avgIntervalDays === null || avgIntervalDays === 0) return "green";
  if (currentGapDays > avgIntervalDays * 1.5) return "red";
  if (currentGapDays > avgIntervalDays * 1.2) return "yellow";
  return "green";
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

type PartialProfile = Omit<ClientRiskProfile, "insights" | "actions">;

function buildInsights(p: PartialProfile): ClientInsight[] {
  const insights: ClientInsight[] = [];
  const isPrevious = p.status === "previous";

  // Delay warnings are only meaningful for active clients — a previous client
  // has simply concluded their engagement, not failed to pay.
  if (!isPrevious) {
    if (p.status === "green" && p.paymentCount >= 5 && p.monthsActive >= 3) {
      insights.push({ type: "reliable", params: { count: p.paymentCount, months: p.monthsActive } });
    }
    if ((p.status === "yellow" || p.status === "red") && p.avgIntervalDays !== null && p.avgIntervalDays > 0) {
      insights.push({ type: "delayWarning", params: { avgDays: Math.round(p.avgIntervalDays), currentGap: p.currentGapDays } });
    }
  }

  if (p.revenueContributionPct >= 25) {
    insights.push({ type: "dependency", params: { pct: p.revenueContributionPct } });
  }

  if (!isPrevious && p.revenueTrend === "declining" && p.revenueTrendPct !== null) {
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

  // Previous clients are not owed a payment — no follow-up action needed.
  if (p.status !== "previous") {
    if (p.status === "red" || (p.status === "yellow" && isOverdue)) {
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
  if (p.status === "previous") return "previous";
  if (p.status === "red") return "risk";
  if (p.status === "yellow") return "watch";
  if (p.paymentCount >= 6 && p.monthsActive >= 4 && p.revenueTrend !== "declining") return "excellent";
  if (p.paymentCount >= 3) return "good";
  return "watch";
}

export async function getClientRiskProfiles(userId: string): Promise<ClientRiskCenterData> {
  // Primary: intent-classified income only
  let txs = await prisma.transaction.findMany({
    where: { userId, intent: { in: ["freelance_income", "salary"] } },
    select: { description: true, amount: true, transactionDate: true, category: true },
    orderBy: { transactionDate: "asc" },
  });

  const hasIntentData = txs.length >= 3;

  // Fallback: income filtered to likely client receipts.
  // Refunds (category "refund") are reversed user purchases, never a client payment.
  // The minimum amount (5) eliminates bank interest credits, cashback rounding,
  // and other micro-transactions that would otherwise appear as bogus client names.
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
    return { clients: [], totalRevenue: 0, currentCount: 0, followUpCount: 0, previousCount: 0, hasIntentData: false };
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

  const map: Record<string, { name: string; txs: { amount: number; date: Date; description: string }[] }> = {};
  for (const tx of txs) {
    const { name } = extractClientName(tx.description, tx.category);
    const key = name.toUpperCase();
    if (!map[key]) map[key] = { name, txs: [] };
    map[key].txs.push({ amount: Number(tx.amount), date: new Date(tx.transactionDate), description: tx.description });
  }

  const profiles: ClientRiskProfile[] = Object.values(map).map(c => {
    const sorted = [...c.txs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const totalRev  = sorted.reduce((s, t) => s + t.amount, 0);
    const first     = sorted[0].date;
    const last      = sorted[sorted.length - 1].date;
    const currentGapDays = Math.max(0, Math.floor((today.getTime() - last.getTime()) / 86_400_000));
    const monthsActive = Math.max(1, Math.round((last.getTime() - first.getTime()) / (30 * 86_400_000))) + 1;

    let avgIntervalDays: number | null = null;
    if (sorted.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(Math.floor((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 86_400_000));
      }
      avgIntervalDays = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
    }

    const revenueContributionPct = totalRevenue > 0 ? Math.round((totalRev / totalRevenue) * 100) : 0;
    const avgPayment   = Math.round(totalRev / sorted.length);
    const largestPayment = Math.max(...sorted.map(t => t.amount));

    const monthlyRevenue: MonthlyRevenue[] = months6.map(m => ({
      ...m,
      amount: sorted
        .filter(t => t.date.getUTCFullYear() === m.year && t.date.getUTCMonth() + 1 === m.month)
        .reduce((s, t) => s + t.amount, 0),
    }));

    const { trend, trendPct } = computeTrend(monthlyRevenue);
    const status = computeStatus(avgIntervalDays, currentGapDays);
    const lifecycle: ClientLifecycle = status === "previous" ? "previous" : "current";
    const dependencyRisk = computeDependencyRisk(revenueContributionPct);

    const recentMonthlyAvg = ((monthlyRevenue[3]?.amount ?? 0) + (monthlyRevenue[4]?.amount ?? 0) + (monthlyRevenue[5]?.amount ?? 0)) / 3;
    const priorMonthlyAvg  = ((monthlyRevenue[0]?.amount ?? 0) + (monthlyRevenue[1]?.amount ?? 0) + (monthlyRevenue[2]?.amount ?? 0)) / 3;

    const partial: PartialProfile = {
      name: c.name,
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
    };

    const reliabilityScore = computeReliabilityScore(partial);
    return { ...partial, reliabilityScore, insights: buildInsights(partial), actions: buildActions(partial) };
  });

  profiles.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    clients:      profiles,
    totalRevenue,
    currentCount:  profiles.filter(p => p.lifecycle === "current").length,
    followUpCount: profiles.filter(p => p.status === "yellow" || p.status === "red").length,
    previousCount: profiles.filter(p => p.lifecycle === "previous").length,
    hasIntentData,
  };
}
