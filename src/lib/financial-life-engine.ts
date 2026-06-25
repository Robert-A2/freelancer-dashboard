// Financial Life Intelligence Engine
// Computes temporal patterns from intent-classified transactions.
// All 7 layers: savings behavior, spending habits, business health,
// client dependency (handled by client-risk-engine), cashflow reality,
// risk signals, and financial memory.

import { prisma } from "./prisma";

type IntentKey =
  | "savings_transfer"
  | "savings_withdrawal"
  | "personal_expense"
  | "family_support"
  | "freelance_income"
  | "salary"
  | "business_expense"
  | "subscription"
  | "tax_payment";

const INCOME_INTENTS: IntentKey[] = ["freelance_income", "salary"];
const SAVINGS_IN: IntentKey = "savings_transfer";
const SAVINGS_OUT: IntentKey = "savings_withdrawal";
const PERSONAL: IntentKey = "personal_expense";
const COST_INTENTS: IntentKey[] = ["business_expense", "subscription", "tax_payment"];

interface MonthBucket {
  year: number;
  month: number;
  totals: Partial<Record<IntentKey, number>>;
}

export interface FinancialLifeIntelligence {
  savings: {
    totalTransferred: number;
    totalWithdrawn: number;
    netPosition: number;
    consecutiveSavingsMonths: number;
    withdrawalsInLast6Months: number;
    monthsWithSavings: number;
  };
  spending: {
    avgMonthlyPersonal: number;
    trend: "increasing" | "stable" | "declining" | null;
    trendPct: number | null;
  };
  business: {
    avgMonthlyRevenue12m: number;
    revenueTrend: "increasing" | "stable" | "declining" | null;
    revenueTrendPct: number | null;
    costTrend: "increasing" | "stable" | "declining" | null;
  };
  memory: {
    avgMonthlyIncome12m: number;
    strongestIncomeMonth: { year: number; month: number; amount: number } | null;
    savingsHabitStartMonth: { year: number; month: number } | null;
  };
  hasEnoughData: boolean;
}

function arrayAvg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function computeTrend(
  last3: number[],
  prev3: number[]
): { trend: "increasing" | "stable" | "declining" | null; pct: number | null } {
  const lastAvg = arrayAvg(last3);
  const prevAvg = arrayAvg(prev3);

  if (lastAvg === 0 && prevAvg === 0) return { trend: null, pct: null };
  if (prevAvg === 0) return { trend: lastAvg > 0 ? "increasing" : "stable", pct: null };

  const diffPct = Math.round(((lastAvg - prevAvg) / Math.abs(prevAvg)) * 100);
  if (Math.abs(diffPct) <= 10) return { trend: "stable", pct: null };
  return { trend: diffPct > 0 ? "increasing" : "declining", pct: Math.abs(diffPct) };
}

const EMPTY: FinancialLifeIntelligence = {
  savings: {
    totalTransferred: 0,
    totalWithdrawn: 0,
    netPosition: 0,
    consecutiveSavingsMonths: 0,
    withdrawalsInLast6Months: 0,
    monthsWithSavings: 0,
  },
  spending: { avgMonthlyPersonal: 0, trend: null, trendPct: null },
  business: { avgMonthlyRevenue12m: 0, revenueTrend: null, revenueTrendPct: null, costTrend: null },
  memory: { avgMonthlyIncome12m: 0, strongestIncomeMonth: null, savingsHabitStartMonth: null },
  hasEnoughData: false,
};

export async function getFinancialLifeIntelligence(
  userId: string,
  accountId?: string | null,
): Promise<FinancialLifeIntelligence> {
  const transactions = await prisma.transaction.findMany({
    where: { userId, ...(accountId ? { accountId } : {}), intent: { not: null } },
    select: { transactionDate: true, amount: true, intent: true },
    orderBy: { transactionDate: "asc" },
  });

  if (transactions.length < 5) return EMPTY;

  // Group by calendar month
  const bucketMap = new Map<string, MonthBucket>();
  for (const tx of transactions) {
    const d = new Date(tx.transactionDate);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    if (!bucketMap.has(key)) bucketMap.set(key, { year, month, totals: {} });
    const bucket = bucketMap.get(key)!;
    const intent = tx.intent as IntentKey;
    bucket.totals[intent] = (bucket.totals[intent] ?? 0) + Math.abs(Number(tx.amount));
  }

  const buckets = [...bucketMap.values()].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)
  );

  if (buckets.length < 2) return EMPTY;

  // ── Layer 1: Savings behavior ────────────────────────────────────────────────
  let totalTransferred = 0;
  let totalWithdrawn = 0;
  let monthsWithSavings = 0;

  let consecutiveSavingsMonths = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if ((buckets[i].totals[SAVINGS_IN] ?? 0) > 0) {
      consecutiveSavingsMonths++;
    } else {
      break;
    }
  }

  const today = new Date();
  const last6Cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 6, 1));
  let withdrawalsInLast6Months = 0;

  for (const b of buckets) {
    const transferred = b.totals[SAVINGS_IN] ?? 0;
    const withdrawn = b.totals[SAVINGS_OUT] ?? 0;
    totalTransferred += transferred;
    totalWithdrawn += withdrawn;
    if (transferred > 0) monthsWithSavings++;

    const bDate = new Date(Date.UTC(b.year, b.month - 1, 1));
    if (bDate >= last6Cutoff && withdrawn > 0) withdrawalsInLast6Months++;
  }

  // ── Layer 2: Spending habits ─────────────────────────────────────────────────
  const personalByMonth = buckets.map(b => b.totals[PERSONAL] ?? 0);
  const last3Personal = personalByMonth.slice(-3);
  const prev3Personal = personalByMonth.slice(-6, -3);
  const spendTrend = computeTrend(last3Personal, prev3Personal);

  // ── Layer 3: Business health (temporal) ──────────────────────────────────────
  const revenueByMonth = buckets.map(b =>
    INCOME_INTENTS.reduce((s, k) => s + (b.totals[k] ?? 0), 0)
  );
  const costByMonth = buckets.map(b =>
    COST_INTENTS.reduce((s, k) => s + (b.totals[k] ?? 0), 0)
  );

  const revTrend = computeTrend(revenueByMonth.slice(-3), revenueByMonth.slice(-6, -3));
  const costTrend = computeTrend(costByMonth.slice(-3), costByMonth.slice(-6, -3));
  const avgMonthlyRevenue12m = arrayAvg(revenueByMonth.slice(-12));

  // ── Layer 7: Financial memory ────────────────────────────────────────────────
  const incomeByMonth = revenueByMonth;
  const avgMonthlyIncome12m = arrayAvg(incomeByMonth.slice(-12));

  let strongestIncomeMonth: { year: number; month: number; amount: number } | null = null;
  for (let i = 0; i < buckets.length; i++) {
    const amt = incomeByMonth[i];
    if (amt > (strongestIncomeMonth?.amount ?? 0)) {
      strongestIncomeMonth = { year: buckets[i].year, month: buckets[i].month, amount: amt };
    }
  }

  let savingsHabitStartMonth: { year: number; month: number } | null = null;
  for (const b of buckets) {
    if ((b.totals[SAVINGS_IN] ?? 0) > 0) {
      savingsHabitStartMonth = { year: b.year, month: b.month };
      break;
    }
  }

  return {
    savings: {
      totalTransferred,
      totalWithdrawn,
      netPosition: totalTransferred - totalWithdrawn,
      consecutiveSavingsMonths,
      withdrawalsInLast6Months,
      monthsWithSavings,
    },
    spending: {
      avgMonthlyPersonal: arrayAvg(personalByMonth),
      trend: spendTrend.trend,
      trendPct: spendTrend.pct,
    },
    business: {
      avgMonthlyRevenue12m,
      revenueTrend: revTrend.trend,
      revenueTrendPct: revTrend.pct,
      costTrend: costTrend.trend,
    },
    memory: {
      avgMonthlyIncome12m,
      strongestIncomeMonth,
      savingsHabitStartMonth,
    },
    hasEnoughData: true,
  };
}
