import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface ForecastResult {
  // Existing fields (unchanged — all consumers depend on these)
  projectedIncome:   number;
  projectedExpenses: number;
  projectedSavings:  number;
  projectedCashflow: number;
  forecastPeriod: string;
  basedOnMonths: number;
  confidence: "low" | "medium" | "high";
  seasonallyAdjusted: boolean;
  generatedAt: Date;

  // Intent-aware projections (null when intent coverage < 80%)
  projectedBusinessRevenue: number | null;
  projectedBusinessCosts:   number | null;
  projectedBusinessProfit:  number | null;
  projectedPersonalSpend:   number | null;
  projectedDebtService:     number | null;
  projectedTrueNetCashflow: number | null;
  // True when recent income is anomalously low vs historical — signals a missing bank account CSV
  hasIncompleteDataWarning: boolean;
}

// ── Intent group constants ────────────────────────────────────────────────────
// Mirror the groupings in analytics-engine.ts so both produce consistent buckets.

const BUSINESS_REVENUE_INTENTS = new Set(["freelance_income", "salary"]);
const BUSINESS_COST_INTENTS    = new Set(["business_expense", "tax_payment", "subscription"]);
const DEBT_SERVICE_INTENTS     = new Set(["loan_repayment"]);
const PERSONAL_SPEND_INTENTS   = new Set(["personal_expense", "family_support"]);
const PASSIVE_REFUND_INTENTS   = new Set(["passive_income", "refund"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

// Weighted average — most recent 3 months: weight 3, next 6: weight 2, older: weight 1.
function weightedAvg(values: number[]): number {
  if (values.length === 0) return 0;
  const weights = values.map((_, i) => {
    const fromEnd = values.length - 1 - i;
    if (fromEnd < 3) return 3;
    if (fromEnd < 9) return 2;
    return 1;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return values.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight;
}

function simpleAvg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Rolling 3-month average — used for stable/fixed series (debt, personal spend).
function rolling3Avg(series: number[]): number {
  return simpleAvg(series.slice(-3));
}

// Build a per-month-of-year average from all records
function buildSeasonalMap(
  records: { month: number; value: number }[]
): Record<number, { total: number; count: number }> {
  const map: Record<number, { total: number; count: number }> = {};
  for (const r of records) {
    if (!map[r.month]) map[r.month] = { total: 0, count: 0 };
    map[r.month].total += r.value;
    map[r.month].count += 1;
  }
  return map;
}

const PERIOD_RE = /^\d{4}-\d{2}$/;

// Locale-independent "YYYY-MM" for the month following `date` — formatted
// for display via `monthYearLabel()` at render time.
function nextPeriod(date: Date): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ── Stored shape for the intentBreakdown JSON column ─────────────────────────

interface StoredIntentBreakdown {
  projectedBusinessRevenue: number;
  projectedBusinessCosts:   number;
  projectedBusinessProfit:  number;
  projectedPersonalSpend:   number;
  projectedDebtService:     number;
  projectedTrueNetCashflow: number;
  hasIncompleteDataWarning: boolean;
}

export async function generateForecast(userId: string): Promise<ForecastResult | null> {
  const records = await prisma.monthlyAnalytics.findMany({
    where: { userId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  if (records.length === 0) {
    // No analytics left to forecast from — remove any stale forecast so
    // dashboards don't show projections for data that no longer exists.
    await prisma.forecast.deleteMany({ where: { userId } });
    return null;
  }

  const incomes   = records.map((r) => Number(r.totalIncome));
  const expenses  = records.map((r) => Number(r.totalExpenses));
  const savings   = records.map((r) => Number(r.totalSavings));

  let projectedIncome   = weightedAvg(incomes);
  let projectedExpenses = weightedAvg(expenses);
  const projectedSavings  = weightedAvg(savings);
  let seasonallyAdjusted  = false;

  // ── Seasonal adjustment ────────────────────────────────────────────────
  // Requires ≥24 months so each target month has appeared at least twice.
  // Blends 50% weighted average + 50% seasonally-adjusted value to avoid
  // over-correcting on limited data.
  if (records.length >= 24) {
    const now       = new Date();
    const nextMonthNum = ((now.getUTCMonth() + 1) % 12) + 1; // 1–12

    const incomeSeasonMap   = buildSeasonalMap(records.map(r => ({ month: r.month, value: Number(r.totalIncome) })));
    const expenseSeasonMap  = buildSeasonalMap(records.map(r => ({ month: r.month, value: Number(r.totalExpenses) })));

    const overallAvgIncome   = incomes.reduce((a, b) => a + b, 0) / incomes.length;
    const overallAvgExpenses = expenses.reduce((a, b) => a + b, 0) / expenses.length;

    const incSeason  = incomeSeasonMap[nextMonthNum];
    const expSeason  = expenseSeasonMap[nextMonthNum];

    if (incSeason && incSeason.count >= 2 && overallAvgIncome > 0) {
      const ratio = (incSeason.total / incSeason.count) / overallAvgIncome;
      projectedIncome = projectedIncome * 0.5 + projectedIncome * ratio * 0.5;
      seasonallyAdjusted = true;
    }

    if (expSeason && expSeason.count >= 2 && overallAvgExpenses > 0) {
      const ratio = (expSeason.total / expSeason.count) / overallAvgExpenses;
      projectedExpenses = projectedExpenses * 0.5 + projectedExpenses * ratio * 0.5;
      seasonallyAdjusted = true;
    }
  }
  // ── End seasonal adjustment ────────────────────────────────────────────

  // Cashflow = Income − Expenses (same definition as recalculateMonthlyAnalytics'
  // netCashflow). Savings are projected separately and excluded from cashflow.
  const projectedCashflow = projectedIncome - projectedExpenses;
  const n = records.length;
  const confidence: "low" | "medium" | "high" =
    n >= 12 ? "high" : n >= 4 ? "medium" : "low";

  // ── Intent-based projections ───────────────────────────────────────────────
  // Four forecast patterns, each with different algorithms suited to how
  // that type of spend/income actually behaves.
  //
  // Pattern 1 — Business revenue (freelance_income, salary):
  //   Weighted average — handles variability and seasonality of client work.
  // Pattern 2 — Debt service (loan_repayment):
  //   Rolling 3-month average — fixed commitment, shouldn't vary.
  // Pattern 3 — Business costs (business_expense, tax_payment, subscription):
  //   Weighted average — low variability, recency matters more than old spend.
  // Pattern 4 — Personal spend (personal_expense, family_support):
  //   Rolling 3-month average — lifestyle-stable, recent behaviour is best predictor.
  //
  // All fields are null when intent coverage < 80%.

  let projectedBusinessRevenue: number | null = null;
  let projectedBusinessCosts:   number | null = null;
  let projectedBusinessProfit:  number | null = null;
  let projectedPersonalSpend:   number | null = null;
  let projectedDebtService:     number | null = null;
  let projectedTrueNetCashflow: number | null = null;
  let hasIncompleteDataWarning  = false;

  if (records.length >= 3) {
    const [totalTxCount, classifiedTxCount] = await Promise.all([
      prisma.transaction.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId, intent: { not: null } } }),
    ]);
    const intentCoveragePct = totalTxCount > 0 ? (classifiedTxCount / totalTxCount) * 100 : 0;

    if (intentCoveragePct >= 80) {
      const txns = await prisma.transaction.findMany({
        where: { userId, intent: { not: null } },
        select: { transactionDate: true, amount: true, intent: true },
      });

      // Aggregate per-month intent totals
      const byMonth = new Map<string, {
        bRev: number; bCost: number; debt: number; pSpend: number; passive: number;
      }>();
      for (const tx of txns) {
        const d   = new Date(tx.transactionDate);
        const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
        if (!byMonth.has(key)) byMonth.set(key, { bRev: 0, bCost: 0, debt: 0, pSpend: 0, passive: 0 });
        const m      = byMonth.get(key)!;
        const amt    = Number(tx.amount);
        const intent = tx.intent as string;
        if      (BUSINESS_REVENUE_INTENTS.has(intent)) m.bRev    += amt;
        else if (BUSINESS_COST_INTENTS.has(intent))    m.bCost   += amt;
        else if (DEBT_SERVICE_INTENTS.has(intent))     m.debt    += amt;
        else if (PERSONAL_SPEND_INTENTS.has(intent))   m.pSpend  += amt;
        else if (PASSIVE_REFUND_INTENTS.has(intent))   m.passive += amt;
      }

      // Align each series with the MonthlyAnalytics record order so all
      // algorithms operate over the same time window and month sequence.
      const revSeries     = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.bRev    ?? 0);
      const costSeries    = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.bCost   ?? 0);
      const debtSeries    = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.debt    ?? 0);
      const spendSeries   = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.pSpend  ?? 0);
      const passiveSeries = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.passive ?? 0);

      // Apply the four forecast patterns
      projectedBusinessRevenue = weightedAvg(revSeries);       // Pattern 1
      projectedDebtService     = rolling3Avg(debtSeries);      // Pattern 2
      projectedBusinessCosts   = weightedAvg(costSeries);      // Pattern 3
      projectedPersonalSpend   = rolling3Avg(spendSeries);     // Pattern 4
      const projectedPassive   = rolling3Avg(passiveSeries);

      projectedBusinessProfit  = projectedBusinessRevenue - projectedBusinessCosts;
      projectedTrueNetCashflow = projectedBusinessRevenue + projectedPassive
                               - projectedBusinessCosts   - projectedPersonalSpend
                               - projectedDebtService;

      // Incomplete data guard: flag when recent business revenue is anomalously
      // low vs historical average — the primary signal that a bank account CSV
      // is missing (income is arriving in an account that hasn't been uploaded).
      if (revSeries.length >= 6) {
        const recentRevAvg   = simpleAvg(revSeries.slice(-3));
        const historicRevAvg = simpleAvg(revSeries.slice(0, -3));
        hasIncompleteDataWarning = historicRevAvg > 0 && recentRevAvg < historicRevAvg * 0.25;
      }
    }
  }
  // ── End intent-based projections ───────────────────────────────────────────

  const now = new Date();
  const forecastPeriod = nextPeriod(now);

  const intentBreakdownJson: StoredIntentBreakdown | null =
    projectedBusinessRevenue !== null
      ? {
          projectedBusinessRevenue,
          projectedBusinessCosts:   projectedBusinessCosts!,
          projectedBusinessProfit:  projectedBusinessProfit!,
          projectedPersonalSpend:   projectedPersonalSpend!,
          projectedDebtService:     projectedDebtService!,
          projectedTrueNetCashflow: projectedTrueNetCashflow!,
          hasIncompleteDataWarning,
        }
      : null;

  // Upsert the forecast for this period (re-running within the same month
  // would otherwise hit the (userId, forecastPeriod) unique constraint),
  // then prune all but the most recent one. This keeps the table from
  // growing indefinitely without needing a schema migration.
  const forecastValues = {
    projectedIncome:   new Decimal(projectedIncome),
    projectedExpenses: new Decimal(projectedExpenses),
    projectedSavings:  new Decimal(projectedSavings),
    projectedCashflow: new Decimal(projectedCashflow),
    intentBreakdown:   intentBreakdownJson !== null
      ? (intentBreakdownJson as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    generatedAt: new Date(),
  };
  await prisma.forecast.upsert({
    where: { userId_forecastPeriod: { userId, forecastPeriod } },
    create: { userId, forecastPeriod, ...forecastValues },
    update: forecastValues,
  });

  const stale = await prisma.forecast.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    skip: 1,
    select: { id: true },
  });
  if (stale.length > 0) {
    await prisma.forecast.deleteMany({ where: { id: { in: stale.map((f) => f.id) } } });
  }

  return {
    projectedIncome, projectedExpenses, projectedSavings, projectedCashflow,
    forecastPeriod, basedOnMonths: n, confidence, seasonallyAdjusted,
    generatedAt: new Date(),
    projectedBusinessRevenue,
    projectedBusinessCosts,
    projectedBusinessProfit,
    projectedPersonalSpend,
    projectedDebtService,
    projectedTrueNetCashflow,
    hasIncompleteDataWarning,
  };
}

export async function getLatestForecast(userId: string): Promise<ForecastResult | null> {
  const forecast = await prisma.forecast.findFirst({
    where: { userId },
    orderBy: { generatedAt: "desc" },
  });

  if (!forecast) return null;

  const monthsCount = await prisma.monthlyAnalytics.count({ where: { userId } });
  const confidence: "low" | "medium" | "high" =
    monthsCount >= 12 ? "high" : monthsCount >= 4 ? "medium" : "low";

  // Rows written before the "YYYY-MM" format was introduced still hold a
  // locale-formatted string (e.g. "March 2027") — derive the period from
  // generatedAt instead until the next generateForecast() overwrites it.
  const forecastPeriod = PERIOD_RE.test(forecast.forecastPeriod)
    ? forecast.forecastPeriod
    : nextPeriod(forecast.generatedAt);

  const ib = forecast.intentBreakdown as StoredIntentBreakdown | null;

  return {
    projectedIncome:   Number(forecast.projectedIncome),
    projectedExpenses: Number(forecast.projectedExpenses),
    projectedSavings:  Number(forecast.projectedSavings),
    projectedCashflow: Number(forecast.projectedCashflow),
    forecastPeriod,
    basedOnMonths:     monthsCount,
    confidence,
    seasonallyAdjusted: monthsCount >= 24,
    generatedAt: forecast.generatedAt,
    projectedBusinessRevenue: ib?.projectedBusinessRevenue ?? null,
    projectedBusinessCosts:   ib?.projectedBusinessCosts   ?? null,
    projectedBusinessProfit:  ib?.projectedBusinessProfit  ?? null,
    projectedPersonalSpend:   ib?.projectedPersonalSpend   ?? null,
    projectedDebtService:     ib?.projectedDebtService     ?? null,
    projectedTrueNetCashflow: ib?.projectedTrueNetCashflow ?? null,
    hasIncompleteDataWarning: ib?.hasIncompleteDataWarning ?? false,
  };
}
