import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ── Public result type ────────────────────────────────────────────────────────

export interface ConfidenceReason {
  key: string;
  params?: Record<string, string | number>;
}

export interface ForecastResult {
  projectedIncome:   number;
  projectedExpenses: number;
  projectedSavings:  number;
  projectedCashflow: number;
  forecastPeriod: string;
  basedOnMonths: number;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  confidenceReasons: ConfidenceReason[];
  seasonallyAdjusted: boolean;
  generatedAt: Date;

  // Intent-aware projections (null when intent coverage < 80%)
  projectedBusinessRevenue: number | null;
  projectedBusinessCosts:   number | null;
  projectedBusinessProfit:  number | null;
  projectedPersonalSpend:   number | null;
  projectedDebtService:     number | null;
  projectedTrueNetCashflow: number | null;

  // Data quality signals
  hasIncompleteDataWarning: boolean;
  recurringExpensesTotal: number;
  recurringExpenseCategories: { category: string; monthlyAvg: number }[];
  gapFraction: number;
  classifiedPct: number;

  // Seasonal adjustment detail — null when no adjustment was applied
  incomeSeasonalFactor:  number | null;   // raw ratio, e.g. 1.18 means +18%
  expenseSeasonalFactor: number | null;
  seasonalBlend:         number | null;   // blend fraction used (0.30 or 0.50)

  // Weighted-average breakdown for income (for UI transparency)
  last3Avg:   number;   // avg of most recent 3 months (3× weight)
  mid6Avg:    number;   // avg of months 4–9 from end (2× weight)
  olderAvg:   number;   // avg of all older months (1× weight)
  last3Count: number;
  mid6Count:  number;
  olderCount: number;

  // Incomplete-data warning — the exact numbers that triggered the check
  incompleteDataRecentAvg:      number | null;
  incompleteDataHistoricAvg:    number | null;
  incompleteDataRecentMonths:   number | null;
  incompleteDataHistoricMonths: number | null;
}

// ── Intent group constants ────────────────────────────────────────────────────

const BUSINESS_REVENUE_INTENTS = new Set(["freelance_income", "salary"]);
const BUSINESS_COST_INTENTS    = new Set(["business_expense", "tax_payment", "subscription"]);
const DEBT_SERVICE_INTENTS     = new Set(["loan_repayment"]);
const PERSONAL_SPEND_INTENTS   = new Set(["personal_expense", "family_support"]);
const PASSIVE_REFUND_INTENTS   = new Set(["passive_income", "refund"]);

// ── Statistical helpers ───────────────────────────────────────────────────────

// Weighted average — most recent 3 months weight 3, next 6 weight 2, older weight 1.
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

// Breaks down the weighted average into its three tiers so the UI can
// show exactly which months contributed what, at what weight.
function computeWeightBreakdown(values: number[]): {
  last3Avg: number; last3Count: number;
  mid6Avg:  number; mid6Count:  number;
  olderAvg: number; olderCount: number;
} {
  const n     = values.length;
  const last3 = values.slice(Math.max(0, n - 3));
  const mid6  = values.slice(Math.max(0, n - 9), Math.max(0, n - 3));
  const older = values.slice(0, Math.max(0, n - 9));
  return {
    last3Avg:   simpleAvg(last3), last3Count: last3.length,
    mid6Avg:    simpleAvg(mid6),  mid6Count:  mid6.length,
    olderAvg:   simpleAvg(older), olderCount: older.length,
  };
}

function simpleAvg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function rolling3Avg(series: number[]): number {
  return simpleAvg(series.slice(-3));
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = simpleAvg(values);
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values: number[]): number {
  const mean = simpleAvg(values);
  if (mean === 0) return 0;
  return stdDev(values) / mean;
}

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

function nextPeriod(date: Date): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ── Confidence scoring ────────────────────────────────────────────────────────
// Four factors, each 0–1, combined into a single score.
// Returns the numeric score, the categorical level, and plain-English reasons.

function computeConfidence(
  monthCount: number,
  incomeValues: number[],
  expenseValues: number[],
  gapFraction: number,
  classifiedPct: number
): { score: number; level: "low" | "medium" | "high"; reasons: ConfidenceReason[] } {
  const reasons: ConfidenceReason[] = [];

  // 1. History depth — 12+ months = full marks
  const depthScore = Math.min(1, monthCount / 12);

  // 2. Income volatility — stable income → higher score
  const activeIncomes = incomeValues.filter(v => v > 0);
  const incCV = activeIncomes.length >= 2 ? coefficientOfVariation(activeIncomes) : 1;
  const volatilityScore = Math.max(0, 1 - Math.min(incCV, 1.5) / 1.5);

  // 3. Gap score — penalise missing months in the date range
  const gapScore = Math.max(0, 1 - gapFraction * 2);

  // 4. Classification — % of transactions with a meaningful category assigned
  const classScore = Math.min(classifiedPct, 100) / 100;

  // Weighted composite (must sum to 1.0)
  const score = depthScore * 0.40 + volatilityScore * 0.25 + gapScore * 0.20 + classScore * 0.15;

  // Structured reason keys — translated at render time in the page
  if (monthCount === 1) {
    reasons.push({ key: "howBuilt.confidence.depth1" });
  } else if (monthCount < 4) {
    reasons.push({ key: "howBuilt.confidence.depthFew", params: { count: monthCount } });
  } else if (monthCount < 12) {
    reasons.push({ key: "howBuilt.confidence.depthGrowing", params: { count: monthCount } });
  } else {
    reasons.push({ key: "howBuilt.confidence.depthSolid", params: { count: monthCount } });
  }

  if (incCV > 0.8) {
    reasons.push({ key: "howBuilt.confidence.volatilityHigh" });
  } else if (incCV > 0.4) {
    reasons.push({ key: "howBuilt.confidence.volatilityMedium" });
  } else if (activeIncomes.length >= 3) {
    reasons.push({ key: "howBuilt.confidence.volatilityLow" });
  }

  if (gapFraction > 0.30) {
    reasons.push({ key: "howBuilt.confidence.gapHigh", params: { pct: Math.round(gapFraction * 100) } });
  } else if (gapFraction > 0.10) {
    reasons.push({ key: "howBuilt.confidence.gapMedium" });
  }

  if (classifiedPct < 60) {
    reasons.push({ key: "howBuilt.confidence.classLow",  params: { pct: Math.round(classifiedPct) } });
  } else if (classifiedPct < 85) {
    reasons.push({ key: "howBuilt.confidence.classMedium", params: { pct: Math.round(classifiedPct) } });
  } else {
    reasons.push({ key: "howBuilt.confidence.classHigh", params: { pct: Math.round(classifiedPct) } });
  }

  const level: "low" | "medium" | "high" =
    score >= 0.65 ? "high" : score >= 0.40 ? "medium" : "low";

  return { score, level, reasons };
}

// ── Recurring expense detection ───────────────────────────────────────────────
// A category is "recurring" when it appears in ≥70% of months AND its
// coefficient of variation (on non-zero months) is ≤0.50.
// Returns the total monthly floor and the category breakdown.

async function detectRecurringExpenses(
  userId: string,
  records: { year: number; month: number }[]
): Promise<{ total: number; categories: { category: string; monthlyAvg: number }[] }> {
  if (records.length < 2) return { total: 0, categories: [] };

  const txns = await prisma.transaction.findMany({
    where: { userId, transactionType: "expense" },
    select: { category: true, transactionDate: true, amount: true },
  });

  // category → month-key → total
  const catMonth = new Map<string, Map<string, number>>();
  for (const tx of txns) {
    const cat = tx.category ?? "uncategorized";
    const d   = new Date(tx.transactionDate);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    if (!catMonth.has(cat)) catMonth.set(cat, new Map());
    const m = catMonth.get(cat)!;
    m.set(key, (m.get(key) ?? 0) + Number(tx.amount));
  }

  const monthKeys   = records.map(r => `${r.year}-${r.month}`);
  const monthCount  = monthKeys.length;
  const recurring: { category: string; monthlyAvg: number }[] = [];

  for (const [category, monthMap] of catMonth) {
    const values  = monthKeys.map(k => monthMap.get(k) ?? 0);
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length < 2) continue;

    const appearanceRate = nonZero.length / monthCount;
    const cv             = coefficientOfVariation(nonZero);

    if (appearanceRate >= 0.70 && cv <= 0.50) {
      recurring.push({
        category,
        monthlyAvg: simpleAvg(nonZero),
      });
    }
  }

  return {
    total:      recurring.reduce((s, r) => s + r.monthlyAvg, 0),
    categories: recurring,
  };
}

// ── Stored JSON shape ─────────────────────────────────────────────────────────

interface StoredBreakdown {
  projectedBusinessRevenue: number;
  projectedBusinessCosts:   number;
  projectedBusinessProfit:  number;
  projectedPersonalSpend:   number;
  projectedDebtService:     number;
  projectedTrueNetCashflow: number;
  hasIncompleteDataWarning: boolean;
  confidenceScore:          number;
  confidenceReasons:        ConfidenceReason[];
  recurringExpensesTotal:   number;
  gapFraction:              number;
  classifiedPct:            number;

  // Transparency fields added for full traceability
  seasonallyAdjusted:         boolean;
  incomeSeasonalFactor:       number | null;
  expenseSeasonalFactor:      number | null;
  seasonalBlend:              number | null;
  recurringExpenseCategories: { category: string; monthlyAvg: number }[];
  last3Avg:                   number;
  mid6Avg:                    number;
  olderAvg:                   number;
  last3Count:                 number;
  mid6Count:                  number;
  olderCount:                 number;
  incompleteDataRecentAvg:      number | null;
  incompleteDataHistoricAvg:    number | null;
  incompleteDataRecentMonths:   number | null;
  incompleteDataHistoricMonths: number | null;
}

// ── generateForecast ──────────────────────────────────────────────────────────

export async function generateForecast(userId: string): Promise<ForecastResult | null> {
  const records = await prisma.monthlyAnalytics.findMany({
    where:   { userId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  if (records.length === 0) {
    await prisma.forecast.deleteMany({ where: { userId } });
    return null;
  }

  const incomes  = records.map(r => Number(r.totalIncome));
  const expenses = records.map(r => Number(r.totalExpenses));
  const savings  = records.map(r => Number(r.totalSavings));

  let projectedIncome   = weightedAvg(incomes);
  let projectedExpenses = weightedAvg(expenses);
  const projectedSavings  = weightedAvg(savings);
  let seasonallyAdjusted  = false;

  // Weighted-average breakdown for income — stored so the UI can show
  // exactly how each tier contributed, making the weighting fully auditable.
  const incomeBreakdown = computeWeightBreakdown(incomes);

  // ── 1. Recurring expense floor ─────────────────────────────────────────────
  const recurringResult  = await detectRecurringExpenses(userId, records);
  const recurringFloor   = recurringResult.total;

  // Anchor expense projection so it never drops below stable fixed costs
  if (records.length >= 3 && recurringFloor > 0) {
    projectedExpenses = Math.max(recurringFloor, projectedExpenses);
  }

  // ── 2. Seasonal adjustment (12+ months) ───────────────────────────────────
  // Blend factor: conservative (30%) at 12–23 months, stronger (50%) at 24+.
  // Requires ≥2 prior samples for the target calendar month before firing —
  // so in practice it first triggers once you have 2 Julys (or 2 Januaries)
  // in your data, not just 12 consecutive months.
  let incomeSeasonalFactor:  number | null = null;
  let expenseSeasonalFactor: number | null = null;
  let seasonalBlend:         number | null = null;

  if (records.length >= 12) {
    const lastRecord  = records[records.length - 1];
    const lastDate    = new Date(Date.UTC(lastRecord.year, lastRecord.month - 1, 1));
    const nextDate    = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + 1, 1));
    const nextMonthNum = nextDate.getUTCMonth() + 1; // 1–12

    const incSeasonMap  = buildSeasonalMap(records.map(r => ({ month: r.month, value: Number(r.totalIncome) })));
    const expSeasonMap  = buildSeasonalMap(records.map(r => ({ month: r.month, value: Number(r.totalExpenses) })));

    const avgIncome   = simpleAvg(incomes);
    const avgExpenses = simpleAvg(expenses);
    const blend       = records.length >= 24 ? 0.5 : 0.3;

    const incSeason = incSeasonMap[nextMonthNum];
    const expSeason = expSeasonMap[nextMonthNum];

    if (incSeason && incSeason.count >= 2 && avgIncome > 0) {
      const ratio = (incSeason.total / incSeason.count) / avgIncome;
      incomeSeasonalFactor = ratio;
      seasonalBlend = blend;
      projectedIncome = projectedIncome * (1 - blend) + projectedIncome * ratio * blend;
      seasonallyAdjusted = true;
    }

    if (expSeason && expSeason.count >= 2 && avgExpenses > 0) {
      const ratio = (expSeason.total / expSeason.count) / avgExpenses;
      expenseSeasonalFactor = ratio;
      seasonalBlend = blend;
      const seasonal = projectedExpenses * (1 - blend) + projectedExpenses * ratio * blend;
      // Don't let seasonality push below the recurring floor
      projectedExpenses = Math.max(recurringFloor, seasonal);
      seasonallyAdjusted = true;
    }
  }

  const projectedCashflow = projectedIncome - projectedExpenses;
  const n = records.length;

  // ── 3. Gap fraction ───────────────────────────────────────────────────────
  let gapFraction = 0;
  if (records.length >= 2) {
    const first = records[0];
    const last  = records[records.length - 1];
    const totalMonthsInRange = (last.year - first.year) * 12 + (last.month - first.month) + 1;
    gapFraction = totalMonthsInRange > records.length
      ? (totalMonthsInRange - records.length) / totalMonthsInRange
      : 0;
  }

  // ── 4. Classification percentage ──────────────────────────────────────────
  // Counts transactions with a real category (not the "uncategorized" fallback).
  // The previous `{ not: undefined }` was a Prisma no-op that always returned
  // totalTxCount, inflating classifiedPct to 100% regardless of actual quality.
  const [totalTxCount, classifiedTxCount] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId, category: { not: "uncategorized" } } }),
  ]);
  const classifiedPct = totalTxCount > 0 ? (classifiedTxCount / totalTxCount) * 100 : 0;

  // ── 5. Confidence score ───────────────────────────────────────────────────
  const confidenceResult = computeConfidence(n, incomes, expenses, gapFraction, classifiedPct);
  const confidence = confidenceResult.level;

  // ── 6. Incomplete data detection ─────────────────────────────────────────
  // Always compute the trigger numbers so the UI can display the exact same
  // values that caused (or didn't cause) the warning — no mismatch possible.
  let hasIncompleteDataWarning = false;
  let incompleteDataRecentAvg:      number | null = null;
  let incompleteDataHistoricAvg:    number | null = null;
  let incompleteDataRecentMonths:   number | null = null;
  let incompleteDataHistoricMonths: number | null = null;

  if (incomes.length >= 3) {
    const recentSlice  = incomes.slice(-2);
    const historicSlice = incomes.slice(0, -2);
    const recentAvg    = simpleAvg(recentSlice);
    const historicAvg  = simpleAvg(historicSlice);

    // Store these regardless of whether the warning fires
    incompleteDataRecentAvg      = recentAvg;
    incompleteDataHistoricAvg    = historicAvg;
    incompleteDataRecentMonths   = recentSlice.length;
    incompleteDataHistoricMonths = historicSlice.length;

    if (historicAvg > 200 && recentAvg < historicAvg * 0.35) {
      hasIncompleteDataWarning = true;
    }
  }
  // Single recent zero month after non-zero history
  if (incomes.length >= 2 && incomes[incomes.length - 1] === 0 && simpleAvg(incomes.slice(0, -1)) > 200) {
    hasIncompleteDataWarning = true;
    // Override the computed averages to reflect the actual trigger
    if (incompleteDataRecentAvg === null) {
      incompleteDataRecentAvg      = 0;
      incompleteDataHistoricAvg    = simpleAvg(incomes.slice(0, -1));
      incompleteDataRecentMonths   = 1;
      incompleteDataHistoricMonths = incomes.length - 1;
    }
  }

  // ── 7. Intent-based projections ───────────────────────────────────────────
  let projectedBusinessRevenue: number | null = null;
  let projectedBusinessCosts:   number | null = null;
  let projectedBusinessProfit:  number | null = null;
  let projectedPersonalSpend:   number | null = null;
  let projectedDebtService:     number | null = null;
  let projectedTrueNetCashflow: number | null = null;

  if (records.length >= 3) {
    const intentCoveragePct = totalTxCount > 0
      ? ((await prisma.transaction.count({ where: { userId, intent: { not: null } } })) / totalTxCount) * 100
      : 0;

    if (intentCoveragePct >= 80) {
      const txns = await prisma.transaction.findMany({
        where:  { userId, intent: { not: null } },
        select: { transactionDate: true, amount: true, intent: true },
      });

      const byMonth = new Map<string, { bRev: number; bCost: number; debt: number; pSpend: number; passive: number }>();
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

      const revSeries     = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.bRev    ?? 0);
      const costSeries    = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.bCost   ?? 0);
      const debtSeries    = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.debt    ?? 0);
      const spendSeries   = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.pSpend  ?? 0);
      const passiveSeries = records.map(r => byMonth.get(`${r.year}-${r.month}`)?.passive ?? 0);

      // Revenue and costs use the same recency-weighted average as the main forecast.
      // Personal spend and debt use a 3-month rolling average — these are
      // behaviour-driven and recent months are more predictive than older ones.
      projectedBusinessRevenue = weightedAvg(revSeries);
      projectedBusinessCosts   = weightedAvg(costSeries);
      projectedDebtService     = rolling3Avg(debtSeries);
      projectedPersonalSpend   = rolling3Avg(spendSeries);
      const projectedPassive   = rolling3Avg(passiveSeries);

      projectedBusinessProfit  = projectedBusinessRevenue - projectedBusinessCosts;
      projectedTrueNetCashflow = projectedBusinessRevenue + projectedPassive
                               - projectedBusinessCosts - projectedPersonalSpend
                               - projectedDebtService;
    }
  }

  // ── 8. Persist ────────────────────────────────────────────────────────────
  // Forecast period = month after the user's last data (not next calendar month).
  const lastRecord    = records[records.length - 1];
  const lastDataDate  = new Date(Date.UTC(lastRecord.year, lastRecord.month - 1, 1));
  const forecastPeriod = nextPeriod(lastDataDate);

  const storedBreakdown: StoredBreakdown = {
    projectedBusinessRevenue: projectedBusinessRevenue ?? 0,
    projectedBusinessCosts:   projectedBusinessCosts   ?? 0,
    projectedBusinessProfit:  projectedBusinessProfit  ?? 0,
    projectedPersonalSpend:   projectedPersonalSpend   ?? 0,
    projectedDebtService:     projectedDebtService     ?? 0,
    projectedTrueNetCashflow: projectedTrueNetCashflow ?? 0,
    hasIncompleteDataWarning,
    confidenceScore:          confidenceResult.score,
    confidenceReasons:        confidenceResult.reasons,
    recurringExpensesTotal:   recurringFloor,
    gapFraction,
    classifiedPct,
    // Transparency fields
    seasonallyAdjusted,
    incomeSeasonalFactor,
    expenseSeasonalFactor,
    seasonalBlend,
    recurringExpenseCategories: recurringResult.categories,
    last3Avg:   incomeBreakdown.last3Avg,
    mid6Avg:    incomeBreakdown.mid6Avg,
    olderAvg:   incomeBreakdown.olderAvg,
    last3Count: incomeBreakdown.last3Count,
    mid6Count:  incomeBreakdown.mid6Count,
    olderCount: incomeBreakdown.olderCount,
    incompleteDataRecentAvg,
    incompleteDataHistoricAvg,
    incompleteDataRecentMonths,
    incompleteDataHistoricMonths,
  };

  const forecastValues = {
    projectedIncome:   new Decimal(projectedIncome),
    projectedExpenses: new Decimal(projectedExpenses),
    projectedSavings:  new Decimal(projectedSavings),
    projectedCashflow: new Decimal(projectedCashflow),
    intentBreakdown:   storedBreakdown as unknown as Prisma.InputJsonValue,
    generatedAt:       new Date(),
  };

  await prisma.forecast.upsert({
    where:  { userId_forecastPeriod: { userId, forecastPeriod } },
    create: { userId, forecastPeriod, ...forecastValues },
    update: forecastValues,
  });

  // Keep only the most recent forecast row
  const stale = await prisma.forecast.findMany({
    where:   { userId },
    orderBy: { generatedAt: "desc" },
    skip:    1,
    select:  { id: true },
  });
  if (stale.length > 0) {
    await prisma.forecast.deleteMany({ where: { id: { in: stale.map(f => f.id) } } });
  }

  return {
    projectedIncome, projectedExpenses, projectedSavings, projectedCashflow,
    forecastPeriod, basedOnMonths: n, confidence, seasonallyAdjusted,
    confidenceScore:   confidenceResult.score,
    confidenceReasons: confidenceResult.reasons,
    generatedAt: new Date(),
    projectedBusinessRevenue,
    projectedBusinessCosts,
    projectedBusinessProfit,
    projectedPersonalSpend,
    projectedDebtService,
    projectedTrueNetCashflow,
    hasIncompleteDataWarning,
    recurringExpensesTotal:     recurringFloor,
    recurringExpenseCategories: recurringResult.categories,
    gapFraction,
    classifiedPct,
    incomeSeasonalFactor,
    expenseSeasonalFactor,
    seasonalBlend,
    last3Avg:   incomeBreakdown.last3Avg,
    mid6Avg:    incomeBreakdown.mid6Avg,
    olderAvg:   incomeBreakdown.olderAvg,
    last3Count: incomeBreakdown.last3Count,
    mid6Count:  incomeBreakdown.mid6Count,
    olderCount: incomeBreakdown.olderCount,
    incompleteDataRecentAvg,
    incompleteDataHistoricAvg,
    incompleteDataRecentMonths,
    incompleteDataHistoricMonths,
  };
}

// ── getLatestForecast ─────────────────────────────────────────────────────────

export async function getLatestForecast(userId: string): Promise<ForecastResult | null> {
  const forecast = await prisma.forecast.findFirst({
    where:   { userId },
    orderBy: { generatedAt: "desc" },
  });

  if (!forecast) return null;

  const monthsCount = await prisma.monthlyAnalytics.count({ where: { userId } });

  const forecastPeriod = PERIOD_RE.test(forecast.forecastPeriod)
    ? forecast.forecastPeriod
    : nextPeriod(forecast.generatedAt);

  const ib = forecast.intentBreakdown as StoredBreakdown | null;

  // Backward-compat: if confidence score not stored, derive from month count
  const storedScore = ib?.confidenceScore ?? (monthsCount >= 12 ? 0.75 : monthsCount >= 4 ? 0.50 : 0.25);
  const confidence: "low" | "medium" | "high" =
    storedScore >= 0.65 ? "high" : storedScore >= 0.40 ? "medium" : "low";

  // `seasonallyAdjusted` is now persisted in the stored breakdown.
  // For old forecasts that pre-date this field, default to false — we can't
  // know whether the adjustment fired, so we don't claim it did.
  const seasonallyAdjusted = ib?.seasonallyAdjusted ?? false;

  return {
    projectedIncome:   Number(forecast.projectedIncome),
    projectedExpenses: Number(forecast.projectedExpenses),
    projectedSavings:  Number(forecast.projectedSavings),
    projectedCashflow: Number(forecast.projectedCashflow),
    forecastPeriod,
    basedOnMonths:     monthsCount,
    confidence,
    confidenceScore:   storedScore,
    confidenceReasons: ib?.confidenceReasons ?? [],
    seasonallyAdjusted,
    generatedAt: forecast.generatedAt,
    projectedBusinessRevenue: ib?.projectedBusinessRevenue ?? null,
    projectedBusinessCosts:   ib?.projectedBusinessCosts   ?? null,
    projectedBusinessProfit:  ib?.projectedBusinessProfit  ?? null,
    projectedPersonalSpend:   ib?.projectedPersonalSpend   ?? null,
    projectedDebtService:     ib?.projectedDebtService     ?? null,
    projectedTrueNetCashflow: ib?.projectedTrueNetCashflow ?? null,
    hasIncompleteDataWarning: ib?.hasIncompleteDataWarning ?? false,
    recurringExpensesTotal:   ib?.recurringExpensesTotal   ?? 0,
    recurringExpenseCategories: ib?.recurringExpenseCategories ?? [],
    gapFraction:              ib?.gapFraction              ?? 0,
    classifiedPct:            ib?.classifiedPct            ?? 0,
    incomeSeasonalFactor:     ib?.incomeSeasonalFactor     ?? null,
    expenseSeasonalFactor:    ib?.expenseSeasonalFactor    ?? null,
    seasonalBlend:            ib?.seasonalBlend            ?? null,
    last3Avg:                 ib?.last3Avg                 ?? 0,
    mid6Avg:                  ib?.mid6Avg                  ?? 0,
    olderAvg:                 ib?.olderAvg                 ?? 0,
    last3Count:               ib?.last3Count               ?? 0,
    mid6Count:                ib?.mid6Count                ?? 0,
    olderCount:               ib?.olderCount               ?? 0,
    incompleteDataRecentAvg:      ib?.incompleteDataRecentAvg      ?? null,
    incompleteDataHistoricAvg:    ib?.incompleteDataHistoricAvg    ?? null,
    incompleteDataRecentMonths:   ib?.incompleteDataRecentMonths   ?? null,
    incompleteDataHistoricMonths: ib?.incompleteDataHistoricMonths ?? null,
  };
}
