import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";

export interface ForecastResult {
  projectedIncome: number;
  projectedExpenses: number;
  projectedSavings: number;
  projectedCashflow: number;
  forecastPeriod: string;
  basedOnMonths: number;
  confidence: "low" | "medium" | "high";
  seasonallyAdjusted: boolean;
  generatedAt: Date;
}

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

export async function generateForecast(userId: string): Promise<ForecastResult | null> {
  const records = await prisma.monthlyAnalytics.findMany({
    where: { userId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  if (records.length === 0) return null;

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
    const nextMonthNum = ((now.getMonth() + 1) % 12) + 1; // 1–12

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

  const projectedCashflow = projectedIncome - projectedExpenses - projectedSavings;
  const n = records.length;
  const confidence: "low" | "medium" | "high" =
    n >= 12 ? "high" : n >= 4 ? "medium" : "low";

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const forecastPeriod = nextMonth.toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });

  // Create the new forecast, then prune all but the most recent one.
  // This keeps the table from growing indefinitely without needing a schema migration.
  await prisma.forecast.create({
    data: {
      userId,
      projectedIncome:   new Decimal(projectedIncome),
      projectedExpenses: new Decimal(projectedExpenses),
      projectedSavings:  new Decimal(projectedSavings),
      projectedCashflow: new Decimal(projectedCashflow),
      forecastPeriod,
    },
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

  return { projectedIncome, projectedExpenses, projectedSavings, projectedCashflow, forecastPeriod, basedOnMonths: n, confidence, seasonallyAdjusted, generatedAt: new Date() };
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

  return {
    projectedIncome:   Number(forecast.projectedIncome),
    projectedExpenses: Number(forecast.projectedExpenses),
    projectedSavings:  Number(forecast.projectedSavings),
    projectedCashflow: Number(forecast.projectedCashflow),
    forecastPeriod:    forecast.forecastPeriod,
    basedOnMonths:     monthsCount,
    confidence,
    seasonallyAdjusted: monthsCount >= 24,
    generatedAt: forecast.generatedAt,
  };
}
