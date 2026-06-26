// Demo Engine — in-memory versions of analytics-engine, forecast-engine,
// client-risk-engine, financial-life-engine, and intelligence-engine.
// Uses the exact same algorithms as the real engines, but operates on the
// in-memory demo transaction array instead of the database.

import type { DemoTransaction } from "./transactions";
import { DEMO_TRANSACTIONS, DEMO_REF_DATE, DEMO_PERSONA } from "./transactions";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import {
  generateDashboardIntelligence,
  buildHistoricalInsights,
  type RankedInsight,
} from "@/lib/intelligence-engine";
import type {
  MonthPoint,
  CategoryTrend,
  YearlySnapshot,
  MonthlySeasonality,
  IncomeConcentration,
  CategoryInsights,
} from "@/lib/analytics-engine";
import type { ForecastResult } from "@/lib/forecast-engine";
import type { FinancialLifeIntelligence } from "@/lib/financial-life-engine";
import type {
  ClientRiskProfile,
  ClientRiskCenterData,
  MonthlyRevenue,
} from "@/lib/client-risk-engine";
import { extractClientName, normalizeForAlias, UNIDENTIFIED_SOURCE } from "@/lib/client-identity";
import type { ClientConfidence } from "@/lib/client-identity";

// ── Helpers ───────────────────────────────────────────────────────────────────

function simpleAvg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function weightedAvg(values: number[]): number {
  if (values.length === 0) return 0;
  const weights = values.map((_, i) => {
    const fromEnd = values.length - 1 - i;
    if (fromEnd < 3) return 3;
    if (fromEnd < 9) return 2;
    return 1;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return values.reduce((s, v, i) => s + v * weights[i], 0) / total;
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

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
}

// ── Monthly analytics ─────────────────────────────────────────────────────────

interface MonthlyBucket {
  month: number;
  year: number;
  income: number;
  expenses: number;
  savings: number;
}

function computeMonthlyBuckets(txs: DemoTransaction[]): MonthlyBucket[] {
  const map: Record<string, MonthlyBucket> = {};

  for (const tx of txs) {
    const d     = tx.transactionDate;
    const month = d.getUTCMonth() + 1;
    const year  = d.getUTCFullYear();
    const key   = `${year}-${month}`;

    if (!map[key]) map[key] = { month, year, income: 0, expenses: 0, savings: 0 };

    if (tx.transactionType === "income")   map[key].income   += tx.amount;
    else if (tx.transactionType === "expense") map[key].expenses += tx.amount;
    else if (tx.transactionType === "savings") map[key].savings  += tx.amount;
  }

  return Object.values(map).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

// ── Historical data (mirrors getHistoricalData) ───────────────────────────────

export function computeHistoricalData(locale: Locale): MonthPoint[] {
  const buckets = computeMonthlyBuckets(DEMO_TRANSACTIONS);
  if (buckets.length === 0) return [];

  const first = buckets[0];
  const last  = buckets[buckets.length - 1];

  const end   = new Date(Date.UTC(last.year,  last.month  - 1, 1));
  const start = new Date(Date.UTC(first.year, first.month - 1, 1));

  const bucketMap = new Map(buckets.map(b => [`${b.year}-${b.month}`, b]));
  const result: MonthPoint[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const m   = cursor.getUTCMonth() + 1;
    const y   = cursor.getUTCFullYear();
    const rec = bucketMap.get(`${y}-${m}`);
    const cashflow = rec ? rec.income - rec.expenses : 0;

    result.push({
      month:           cursor.toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "2-digit", timeZone: "UTC" }),
      year:            y,
      monthNum:        m,
      income:          rec?.income   ?? 0,
      expenses:        rec?.expenses ?? 0,
      savings:         rec?.savings  ?? 0,
      cashflow,
      // Demo data has no payer engine — show income as all three tiers so charts
      // render. Real data will have these split by payer confidence.
      verifiedRevenue: rec?.income ?? 0,
      likelyRevenue:   0,
      reviewRevenue:   0,
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return result;
}

// ── Dashboard summary (mirrors getDashboardSummary) ───────────────────────────

export function computeDashboardSummary(txs: DemoTransaction[]) {
  const buckets = computeMonthlyBuckets(txs);
  if (buckets.length === 0) return { current: null, previous: null, recent: [] };

  const last = buckets[buckets.length - 1];
  const currMonth = last.month;
  const currYear  = last.year;
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
  const prevYear  = currMonth === 1 ? currYear - 1 : currYear;

  const curr = buckets.find(b => b.month === currMonth && b.year === currYear);
  const prev = buckets.find(b => b.month === prevMonth && b.year === prevYear);

  const recent = [...txs]
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())
    .slice(0, 10);

  function toMetrics(b: MonthlyBucket | undefined) {
    if (!b) return null;
    return {
      totalIncome:   b.income,
      totalExpenses: b.expenses,
      totalSavings:  b.savings,
      netCashflow:   b.income - b.expenses,
    };
  }

  return { current: toMetrics(curr), previous: toMetrics(prev), recent };
}

// ── Monthly comparison (mirrors getMonthlyComparison) ────────────────────────

export function computeMonthlyComparison(locale: Locale) {
  const buckets = computeMonthlyBuckets(DEMO_TRANSACTIONS);
  if (buckets.length === 0) {
    return { current: null, previous: null, changes: null, currLabel: "", prevLabel: "" };
  }

  const last      = buckets[buckets.length - 1];
  const currMonth = last.month;
  const currYear  = last.year;
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
  const prevYear  = currMonth === 1 ? currYear - 1 : currYear;

  const curr = buckets.find(b => b.month === currMonth && b.year === currYear);
  const prev = buckets.find(b => b.month === prevMonth && b.year === prevYear);

  function toMetrics(b: MonthlyBucket | undefined) {
    if (!b) return { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };
    return { totalIncome: b.income, totalExpenses: b.expenses, totalSavings: b.savings, netCashflow: b.income - b.expenses };
  }

  function changePct(c: number, p: number): number {
    if (p === 0) return c > 0 ? 100 : 0;
    return Math.round(((c - p) / Math.abs(p)) * 100);
  }

  const c = toMetrics(curr);
  const p = toMetrics(prev);

  const currLabel = new Date(Date.UTC(currYear, currMonth - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" });
  const prevLabel = new Date(Date.UTC(prevYear, prevMonth - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" });

  return {
    current: c,
    previous: prev ? p : null,
    currLabel,
    prevLabel,
    changes: {
      income:   changePct(c.totalIncome,   p.totalIncome),
      expenses: changePct(c.totalExpenses, p.totalExpenses),
      savings:  changePct(c.totalSavings,  p.totalSavings),
      cashflow: changePct(c.netCashflow,   p.netCashflow),
    },
  };
}

// ── Data coverage ─────────────────────────────────────────────────────────────

export function computeDataCoverage(locale: Locale) {
  const txs = DEMO_TRANSACTIONS;
  if (txs.length === 0) {
    return { count: 0, earliest: null, latest: null, years: 0, months: 0, rangeLabel: null };
  }

  const sorted    = [...txs].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
  const earliest  = sorted[0].transactionDate;
  const latest    = sorted[sorted.length - 1].transactionDate;
  const span      = latest.getTime() - earliest.getTime();
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const msPerMonth = msPerYear / 12;

  const fmt = (d: Date) => d.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" });
  const fromLabel = fmt(earliest);
  const toLabel   = fmt(latest);

  return {
    count: txs.length,
    earliest,
    latest,
    years:  Math.floor(span / msPerYear),
    months: Math.round(span / msPerMonth),
    rangeLabel: fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`,
  };
}

// ── Category insights (mirrors getCategoryInsights) ───────────────────────────

export function computeCategoryInsights(): CategoryInsights {
  const txs = DEMO_TRANSACTIONS;

  const buckets = computeMonthlyBuckets(txs);
  const last    = buckets.length ? buckets[buckets.length - 1] : null;
  const currMonth = last?.month ?? 12;
  const currYear  = last?.year  ?? 2025;
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
  const prevYear  = currMonth === 1 ? currYear - 1 : currYear;

  const expenses = txs.filter(tx => tx.transactionType === "expense");

  const catMap: Record<string, { total: number; yearly: Record<number, number>; currentMonth: number; previousMonth: number }> = {};

  for (const tx of expenses) {
    const d     = tx.transactionDate;
    const year  = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const cat   = tx.category || "uncategorized";

    if (!catMap[cat]) catMap[cat] = { total: 0, yearly: {}, currentMonth: 0, previousMonth: 0 };
    catMap[cat].total += tx.amount;
    catMap[cat].yearly[year] = (catMap[cat].yearly[year] ?? 0) + tx.amount;
    if (year === currYear  && month === currMonth) catMap[cat].currentMonth  += tx.amount;
    if (year === prevYear  && month === prevMonth) catMap[cat].previousMonth += tx.amount;
  }

  const topExpenseCategories: CategoryTrend[] = Object.entries(catMap)
    .filter(([, d]) => d.total > 0)
    .map(([category, data]) => {
      const years = Object.keys(data.yearly).map(Number).sort();
      let yearOverYearTrend: CategoryTrend["yearOverYearTrend"] = "stable";
      if (years.length >= 2) {
        const last2  = data.yearly[years[years.length - 1]] ?? 0;
        const prev2  = data.yearly[years[years.length - 2]] ?? 0;
        const pctYoY = prev2 > 0 ? ((last2 - prev2) / prev2) * 100 : 0;
        if (pctYoY > 10)  yearOverYearTrend = "growing";
        else if (pctYoY < -10) yearOverYearTrend = "declining";
      }
      const changeAmount = data.currentMonth - data.previousMonth;
      const changePct    = data.previousMonth > 0
        ? Math.round(((data.currentMonth - data.previousMonth) / data.previousMonth) * 100)
        : 0;
      return { category, totalAllTime: data.total, yearlyTotals: data.yearly, currentMonthTotal: data.currentMonth, previousMonthTotal: data.previousMonth, changeAmount, changePct, yearOverYearTrend };
    })
    .sort((a, b) => b.totalAllTime - a.totalAllTime)
    .slice(0, 10);

  // Yearly snapshots
  const yearMap: Record<number, YearlySnapshot> = {};
  for (const b of buckets) {
    if (!yearMap[b.year]) yearMap[b.year] = { year: b.year, income: 0, expenses: 0, savings: 0, cashflow: 0, monthCount: 0 };
    yearMap[b.year].income   += b.income;
    yearMap[b.year].expenses += b.expenses;
    yearMap[b.year].savings  += b.savings;
    yearMap[b.year].cashflow += b.income - b.expenses;
    yearMap[b.year].monthCount++;
  }
  const yearlySnapshots = Object.values(yearMap).sort((a, b) => a.year - b.year);

  // Seasonality
  const seasonMap: Record<number, { income: number; expenses: number; count: number }> = {};
  for (const b of buckets) {
    if (!seasonMap[b.month]) seasonMap[b.month] = { income: 0, expenses: 0, count: 0 };
    seasonMap[b.month].income   += b.income;
    seasonMap[b.month].expenses += b.expenses;
    seasonMap[b.month].count    += 1;
  }

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const seasonality: MonthlySeasonality[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const d = seasonMap[m];
    return { monthOfYear: m, monthName: MONTH_NAMES[i], avgIncome: d ? d.income / d.count : 0, avgExpenses: d ? d.expenses / d.count : 0, sampleCount: d?.count ?? 0 };
  });

  return { topExpenseCategories, yearlySnapshots, seasonality };
}

// ── Income concentration (mirrors getIncomeConcentration) ─────────────────────

export function computeIncomeConcentration(): IncomeConcentration {
  const txs = DEMO_TRANSACTIONS;

  const latestIncome = [...txs.filter(t => t.transactionType === "income")]
    .sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime())[0];

  if (!latestIncome) return { topSourceDesc: null, topSourcePct: 0, totalSources: 0, isHighConcentration: false };

  const since = new Date(latestIncome.transactionDate);
  since.setFullYear(since.getFullYear() - 1);

  const incomeTxs = txs.filter(t =>
    t.transactionType === "income" && t.transactionDate >= since
  );

  if (incomeTxs.length < 3) return { topSourceDesc: null, topSourcePct: 0, totalSources: 0, isHighConcentration: false };

  const total = incomeTxs.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return { topSourceDesc: null, topSourcePct: 0, totalSources: 0, isHighConcentration: false };

  const bySource: Record<string, number> = {};
  for (const tx of incomeTxs) {
    const key = tx.description.slice(0, 35).replace(/\d+/g, "").replace(/[^A-Z a-z]/g, " ").trim().toUpperCase().replace(/\s+/g, " ");
    if (key.length >= 3) bySource[key] = (bySource[key] ?? 0) + tx.amount;
  }

  const sorted = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
  const top    = sorted[0];
  const topPct = top ? Math.round((top[1] / total) * 100) : 0;

  return { topSourceDesc: top?.[0] ?? null, topSourcePct: topPct, totalSources: sorted.length, isHighConcentration: topPct >= 50 && sorted.length <= 4 };
}

// ── Intent breakdown (mirrors getIntentBreakdown) ─────────────────────────────

const BUSINESS_REVENUE_INTENTS  = new Set(["freelance_income", "salary"]);
const BUSINESS_COST_INTENTS     = new Set(["business_expense", "tax_payment", "subscription"]);
const PERSONAL_SPEND_INTENTS    = new Set(["personal_expense", "family_support"]);
const DEBT_SERVICE_INTENTS      = new Set(["loan_repayment"]);
const SAVINGS_INTENTS           = new Set(["savings_transfer"]);
const SAVINGS_WITHDRAWAL_INTENTS= new Set(["savings_withdrawal"]);
const PASSIVE_INCOME_INTENTS    = new Set(["passive_income"]);
const REFUND_INTENTS            = new Set(["refund"]);

export function computeIntentBreakdown() {
  const txs = DEMO_TRANSACTIONS;

  const byIntent: Record<string, { count: number; total: number }> = {};
  let totalCount = 0;
  let classifiedCount = 0;
  let needsReviewCount = 0;

  for (const tx of txs) {
    totalCount++;
    if (tx.intent) {
      classifiedCount++;
      if (!byIntent[tx.intent]) byIntent[tx.intent] = { count: 0, total: 0 };
      byIntent[tx.intent].count++;
      byIntent[tx.intent].total += tx.amount;
    }
    if (tx.needsReview) needsReviewCount++;
  }

  const intentCoveragePct = totalCount > 0 ? Math.round((classifiedCount / totalCount) * 1000) / 10 : 0;

  function sumIntents(intents: Set<string>): number {
    return Object.entries(byIntent)
      .filter(([k]) => intents.has(k))
      .reduce((s, [, v]) => s + v.total, 0);
  }

  const businessRevenue = sumIntents(BUSINESS_REVENUE_INTENTS);
  const businessCosts   = sumIntents(BUSINESS_COST_INTENTS);
  const businessProfit  = businessRevenue - businessCosts;
  const profitMarginPct = businessRevenue > 0
    ? Math.round((businessProfit / businessRevenue) * 1000) / 10
    : null;

  const personalSpend    = sumIntents(PERSONAL_SPEND_INTENTS);
  const debtService      = sumIntents(DEBT_SERVICE_INTENTS);
  const totalObligations = personalSpend + debtService;
  const familySupport    = byIntent["family_support"]?.total ?? 0;
  const savingsMovement  = sumIntents(SAVINGS_INTENTS);
  const savingsWithdrawal = sumIntents(SAVINGS_WITHDRAWAL_INTENTS);
  const passiveIncome    = sumIntents(PASSIVE_INCOME_INTENTS);
  const refunds          = sumIntents(REFUND_INTENTS);

  const trueNetCashflow =
    (businessRevenue + passiveIncome + refunds) -
    (businessCosts + personalSpend + debtService);

  const distribution = Object.entries(byIntent).map(([intent, v]) => ({
    intent,
    count: v.count,
    totalAmount: Math.round(v.total * 100) / 100,
  }));

  const transfers = txs.filter(t => t.transactionType === "transfer");
  const transferByIntent: Record<string, { count: number; total: number }> = {};
  for (const tx of transfers) {
    if (tx.intent) {
      if (!transferByIntent[tx.intent]) transferByIntent[tx.intent] = { count: 0, total: 0 };
      transferByIntent[tx.intent].count++;
      transferByIntent[tx.intent].total += tx.amount;
    }
  }

  return {
    businessRevenue:  Math.round(businessRevenue * 100) / 100,
    businessCosts:    Math.round(businessCosts   * 100) / 100,
    businessProfit:   Math.round(businessProfit  * 100) / 100,
    profitMarginPct,
    personalSpend:    Math.round(personalSpend   * 100) / 100,
    familySupport:    Math.round(familySupport   * 100) / 100,
    debtService:      Math.round(debtService     * 100) / 100,
    totalObligations: Math.round(totalObligations * 100) / 100,
    savingsMovement:  Math.round(savingsMovement  * 100) / 100,
    savingsWithdrawal: Math.round(savingsWithdrawal * 100) / 100,
    investmentFlow:   0,
    ownerDraw:        0,
    passiveIncome:    Math.round(passiveIncome   * 100) / 100,
    refunds:          Math.round(refunds         * 100) / 100,
    trueNetCashflow:  Math.round(trueNetCashflow * 100) / 100,
    distribution,
    transferBreakdown: {
      totalCount:  transfers.length,
      totalAmount: transfers.reduce((s, t) => s + t.amount, 0),
      byIntent: Object.entries(transferByIntent).map(([intent, v]) => ({
        intent,
        count: v.count,
        totalAmount: Math.round(v.total * 100) / 100,
      })),
    },
    totalTransactions:       totalCount,
    intentClassifiedCount:   classifiedCount,
    intentCoveragePct,
    hasEnoughDataForDisplay: intentCoveragePct >= 80,
    needsReviewCount,
    topNeedsReviewMerchants: [],
  };
}

// ── Forecast (mirrors generateForecast pure logic) ────────────────────────────

export function computeForecast(): ForecastResult | null {
  const txs    = DEMO_TRANSACTIONS;
  const buckets = computeMonthlyBuckets(txs);
  if (buckets.length === 0) return null;

  const incomes  = buckets.map(b => b.income);
  const expenses = buckets.map(b => b.expenses);
  const savings  = buckets.map(b => b.savings);

  let projectedIncome   = weightedAvg(incomes);
  let projectedExpenses = weightedAvg(expenses);
  const projectedSavings = weightedAvg(savings);
  let seasonallyAdjusted = false;

  // Weighted-average breakdown
  const n   = incomes.length;
  const last3  = incomes.slice(Math.max(0, n - 3));
  const mid6   = incomes.slice(Math.max(0, n - 9), Math.max(0, n - 3));
  const older  = incomes.slice(0, Math.max(0, n - 9));
  const last3Avg  = simpleAvg(last3);
  const mid6Avg   = simpleAvg(mid6);
  const olderAvg  = simpleAvg(older);

  // Recurring expense floor
  const catMonth = new Map<string, Map<string, number>>();
  for (const tx of txs.filter(t => t.transactionType === "expense")) {
    const cat = tx.category ?? "uncategorized";
    const d   = tx.transactionDate;
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    if (!catMonth.has(cat)) catMonth.set(cat, new Map());
    const m = catMonth.get(cat)!;
    m.set(key, (m.get(key) ?? 0) + tx.amount);
  }
  const monthKeys  = buckets.map(b => `${b.year}-${b.month}`);
  const monthCount = monthKeys.length;
  let recurringFloor = 0;
  const recurringExpenseCategories: { category: string; monthlyAvg: number }[] = [];

  for (const [category, monthMap] of catMonth) {
    const values  = monthKeys.map(k => monthMap.get(k) ?? 0);
    const nonZero = values.filter(v => v > 0);
    if (nonZero.length < 2) continue;
    const appearanceRate = nonZero.length / monthCount;
    const cv = coefficientOfVariation(nonZero);
    if (appearanceRate >= 0.70 && cv <= 0.50) {
      const monthlyAvg = simpleAvg(nonZero);
      recurringFloor += monthlyAvg;
      recurringExpenseCategories.push({ category, monthlyAvg });
    }
  }

  if (buckets.length >= 3 && recurringFloor > 0) {
    projectedExpenses = Math.max(recurringFloor, projectedExpenses);
  }

  // Seasonal adjustment
  let incomeSeasonalFactor:  number | null = null;
  let expenseSeasonalFactor: number | null = null;
  let seasonalBlend:         number | null = null;

  if (buckets.length >= 12) {
    const lastBucket = buckets[buckets.length - 1];
    const nextDate   = new Date(Date.UTC(lastBucket.year, lastBucket.month, 1));
    const nextMonth  = nextDate.getUTCMonth() + 1;
    const blend      = buckets.length >= 24 ? 0.5 : 0.3;

    const incSeasonMap: Record<number, { total: number; count: number }> = {};
    const expSeasonMap: Record<number, { total: number; count: number }> = {};
    for (const b of buckets) {
      if (!incSeasonMap[b.month]) incSeasonMap[b.month] = { total: 0, count: 0 };
      if (!expSeasonMap[b.month]) expSeasonMap[b.month] = { total: 0, count: 0 };
      incSeasonMap[b.month].total += b.income;
      incSeasonMap[b.month].count++;
      expSeasonMap[b.month].total += b.expenses;
      expSeasonMap[b.month].count++;
    }

    const avgIncome   = simpleAvg(incomes);
    const avgExpenses = simpleAvg(expenses);

    const incSeason = incSeasonMap[nextMonth];
    const expSeason = expSeasonMap[nextMonth];

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
      projectedExpenses = Math.max(recurringFloor, seasonal);
      seasonallyAdjusted = true;
    }
  }

  const projectedCashflow = projectedIncome - projectedExpenses;

  // Gap fraction
  let gapFraction = 0;
  if (buckets.length >= 2) {
    const firstB = buckets[0];
    const lastB  = buckets[buckets.length - 1];
    const totalMonthsInRange = (lastB.year - firstB.year) * 12 + (lastB.month - firstB.month) + 1;
    gapFraction = totalMonthsInRange > buckets.length
      ? (totalMonthsInRange - buckets.length) / totalMonthsInRange
      : 0;
  }

  // Classification percentage
  const totalTxCount      = txs.length;
  const classifiedTxCount = txs.filter(t => t.category && t.category !== "uncategorized").length;
  const classifiedPct     = totalTxCount > 0 ? (classifiedTxCount / totalTxCount) * 100 : 0;

  // Confidence
  const activeIncomes = incomes.filter(v => v > 0);
  const incCV = activeIncomes.length >= 2 ? coefficientOfVariation(activeIncomes) : 1;
  const depthScore     = Math.min(1, buckets.length / 12);
  const volatilityScore = Math.max(0, 1 - Math.min(incCV, 1.5) / 1.5);
  const gapScore        = Math.max(0, 1 - gapFraction * 2);
  const classScore      = Math.min(classifiedPct, 100) / 100;
  const confidenceScore = depthScore * 0.40 + volatilityScore * 0.25 + gapScore * 0.20 + classScore * 0.15;
  const confidence: "low" | "medium" | "high" =
    confidenceScore >= 0.65 ? "high" : confidenceScore >= 0.40 ? "medium" : "low";

  // Intent projections
  let projectedBusinessRevenue: number | null = null;
  let projectedBusinessCosts:   number | null = null;
  let projectedBusinessProfit:  number | null = null;
  let projectedPersonalSpend:   number | null = null;
  let projectedDebtService:     number | null = null;
  let projectedTrueNetCashflow: number | null = null;

  const intentCoveragePct = totalTxCount > 0
    ? (txs.filter(t => t.intent).length / totalTxCount) * 100
    : 0;

  if (buckets.length >= 3 && intentCoveragePct >= 80) {
    const byMonthIntent = new Map<string, { bRev: number; bCost: number; debt: number; pSpend: number; passive: number }>();
    for (const tx of txs.filter(t => t.intent)) {
      const d   = tx.transactionDate;
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      if (!byMonthIntent.has(key)) byMonthIntent.set(key, { bRev: 0, bCost: 0, debt: 0, pSpend: 0, passive: 0 });
      const m = byMonthIntent.get(key)!;
      const intent = tx.intent!;
      if      (BUSINESS_REVENUE_INTENTS.has(intent)) m.bRev   += tx.amount;
      else if (BUSINESS_COST_INTENTS.has(intent))    m.bCost  += tx.amount;
      else if (DEBT_SERVICE_INTENTS.has(intent))     m.debt   += tx.amount;
      else if (PERSONAL_SPEND_INTENTS.has(intent))   m.pSpend += tx.amount;
      else if (PASSIVE_INCOME_INTENTS.has(intent))   m.passive += tx.amount;
    }

    const rolling3 = (arr: number[]) => simpleAvg(arr.slice(-3));

    const revSeries   = buckets.map(b => byMonthIntent.get(`${b.year}-${b.month}`)?.bRev    ?? 0);
    const costSeries  = buckets.map(b => byMonthIntent.get(`${b.year}-${b.month}`)?.bCost   ?? 0);
    const debtSeries  = buckets.map(b => byMonthIntent.get(`${b.year}-${b.month}`)?.debt    ?? 0);
    const spendSeries = buckets.map(b => byMonthIntent.get(`${b.year}-${b.month}`)?.pSpend  ?? 0);
    const passiveSeries = buckets.map(b => byMonthIntent.get(`${b.year}-${b.month}`)?.passive ?? 0);

    projectedBusinessRevenue = weightedAvg(revSeries);
    projectedBusinessCosts   = weightedAvg(costSeries);
    projectedDebtService     = rolling3(debtSeries);
    projectedPersonalSpend   = rolling3(spendSeries);
    const projectedPassive   = rolling3(passiveSeries);

    projectedBusinessProfit  = projectedBusinessRevenue - projectedBusinessCosts;
    projectedTrueNetCashflow = projectedBusinessRevenue + projectedPassive
                             - projectedBusinessCosts - projectedPersonalSpend
                             - projectedDebtService;
  }

  // Incomplete data detection
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
    incompleteDataRecentAvg      = recentAvg;
    incompleteDataHistoricAvg    = historicAvg;
    incompleteDataRecentMonths   = recentSlice.length;
    incompleteDataHistoricMonths = historicSlice.length;
    if (historicAvg > 200 && recentAvg < historicAvg * 0.35) {
      hasIncompleteDataWarning = true;
    }
  }

  const lastBucket    = buckets[buckets.length - 1];
  const lastDataDate  = new Date(Date.UTC(lastBucket.year, lastBucket.month - 1, 1));
  const nextDate      = new Date(Date.UTC(lastDataDate.getUTCFullYear(), lastDataDate.getUTCMonth() + 1, 1));
  const forecastPeriod = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    projectedIncome, projectedExpenses, projectedSavings, projectedCashflow,
    forecastPeriod, basedOnMonths: buckets.length, confidence, seasonallyAdjusted,
    confidenceScore,
    confidenceReasons: [{ key: "howBuilt.confidence.depthSolid", params: { count: buckets.length } }],
    generatedAt: new Date(),
    projectedBusinessRevenue,
    projectedBusinessCosts,
    projectedBusinessProfit,
    projectedPersonalSpend,
    projectedDebtService,
    projectedTrueNetCashflow,
    hasIncompleteDataWarning,
    recurringExpensesTotal:     recurringFloor,
    recurringExpenseCategories,
    gapFraction,
    classifiedPct,
    incomeSeasonalFactor,
    expenseSeasonalFactor,
    seasonalBlend,
    last3Avg, mid6Avg, olderAvg,
    last3Count: last3.length, mid6Count: mid6.length, olderCount: older.length,
    incompleteDataRecentAvg,
    incompleteDataHistoricAvg,
    incompleteDataRecentMonths,
    incompleteDataHistoricMonths,
    // Demo always uses real transaction data — no raw bank inflows mixed in
    usedPayerRevenue:      true,
    excludedReviewRevenue: 0,
  };
}

// ── Client risk profiles (mirrors getClientRiskProfiles) ──────────────────────

function computeStatus(avgIntervalDays: number | null, currentGapDays: number): "current" | "watch" | "risk" | "inactive" {
  const inactiveThreshold = avgIntervalDays && avgIntervalDays > 0
    ? Math.min(Math.max(avgIntervalDays * 3, 180), 548)
    : 180;
  if (currentGapDays >= inactiveThreshold) return "inactive";
  if (avgIntervalDays === null || avgIntervalDays === 0) return "current";
  if (currentGapDays > avgIntervalDays * 1.5) return "risk";
  if (currentGapDays > avgIntervalDays * 1.2) return "watch";
  return "current";
}

function computeTrendClient(monthly: MonthlyRevenue[]): { trend: "increasing" | "stable" | "declining" | null; trendPct: number | null } {
  if (monthly.length < 6) return { trend: null, trendPct: null };
  const last3 = (monthly[3].amount + monthly[4].amount + monthly[5].amount) / 3;
  const prev3 = (monthly[0].amount + monthly[1].amount + monthly[2].amount) / 3;
  if (last3 === 0 && prev3 === 0) return { trend: null, trendPct: null };
  if (prev3 === 0) return { trend: "increasing", trendPct: null };
  const changePct = (last3 - prev3) / prev3;
  const pctAbs = Math.abs(Math.round(changePct * 100));
  if (changePct > 0.1)  return { trend: "increasing", trendPct: pctAbs };
  if (changePct < -0.1) return { trend: "declining",  trendPct: pctAbs };
  return { trend: "stable", trendPct: pctAbs };
}

export function computeClientRiskProfiles(locale: Locale): ClientRiskCenterData {
  const txs = DEMO_TRANSACTIONS;
  const refDate = DEMO_REF_DATE; // Jan 1, 2026

  // Filter to freelance income only
  const incomeTxs = txs.filter(t => t.intent === "freelance_income");

  if (incomeTxs.length === 0) {
    return { clients: [], totalRevenue: 0, currentCount: 0, followUpCount: 0, inactiveCount: 0, hasIntentData: true, unresolvedGroups: [] };
  }

  // Build 6-month window ending Dec 2025 (month before refDate)
  const months6: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 1 - i, 1));
    months6.push({
      year:  d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: d.toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "2-digit", timeZone: "UTC" }),
    });
  }

  const totalRevenue = incomeTxs.reduce((s, t) => s + t.amount, 0);

  // Group by alias-normalized client name
  const aliasGroups: Record<string, {
    names: Record<string, { count: number; confidence: ClientConfidence; isProcessor: boolean }>;
    txs: { amount: number; date: Date; description: string }[];
  }> = {};

  for (const tx of incomeTxs) {
    const result = extractClientName(tx.description, tx.category);
    const effectiveName = result.confidence === "unknown" || result.confidence === "low"
      ? UNIDENTIFIED_SOURCE : result.name;
    const aliasKey = normalizeForAlias(effectiveName);

    if (!aliasGroups[aliasKey]) aliasGroups[aliasKey] = { names: {}, txs: [] };
    const nameKey = effectiveName.toUpperCase();
    if (!aliasGroups[aliasKey].names[nameKey]) {
      aliasGroups[aliasKey].names[nameKey] = { count: 0, confidence: result.confidence, isProcessor: result.isProcessor };
    }
    aliasGroups[aliasKey].names[nameKey].count++;
    aliasGroups[aliasKey].txs.push({ amount: tx.amount, date: tx.transactionDate, description: tx.description });
  }

  const map: Record<string, { name: string; confidence: ClientConfidence; isProcessor: boolean; txs: { amount: number; date: Date; description: string }[] }> = {};
  for (const [aliasKey, group] of Object.entries(aliasGroups)) {
    const canonical = Object.entries(group.names).sort((a, b) => b[1].count - a[1].count)[0];
    const displayName = canonical[0] === UNIDENTIFIED_SOURCE.toUpperCase()
      ? UNIDENTIFIED_SOURCE
      : canonical[0].split(" ").map(w => w[0] + w.slice(1).toLowerCase()).join(" ");
    map[aliasKey] = { name: displayName, confidence: canonical[1].confidence, isProcessor: canonical[1].isProcessor, txs: group.txs };
  }

  const profiles: ClientRiskProfile[] = Object.values(map).map(c => {
    const sorted    = [...c.txs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const totalRev  = sorted.reduce((s, t) => s + t.amount, 0);
    const first     = sorted[0].date;
    const last      = sorted[sorted.length - 1].date;
    const currentGapDays = Math.max(0, Math.floor((refDate.getTime() - last.getTime()) / 86_400_000));
    const monthsActive = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth()) + 1;

    let avgIntervalDays: number | null = null;
    if (sorted.length >= 2) {
      const intervals = [];
      for (let i = 1; i < sorted.length; i++) {
        intervals.push(Math.floor((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 86_400_000));
      }
      avgIntervalDays = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length);
    }

    const revenueContributionPct = totalRevenue > 0 ? Math.round((totalRev / totalRevenue) * 100) : 0;
    const avgPayment     = Math.round(totalRev / sorted.length);
    const largestPayment = Math.max(...sorted.map(t => t.amount));

    const monthlyRevenue: MonthlyRevenue[] = months6.map(m => ({
      ...m,
      amount: sorted
        .filter(t => t.date.getUTCFullYear() === m.year && t.date.getUTCMonth() + 1 === m.month)
        .reduce((s, t) => s + t.amount, 0),
    }));

    const { trend, trendPct } = computeTrendClient(monthlyRevenue);
    const status        = computeStatus(avgIntervalDays, currentGapDays);
    const lifecycle     = status === "inactive" ? "inactive" as const : "current" as const;
    const dependencyRisk = revenueContributionPct >= 50 ? "high" as const : revenueContributionPct >= 25 ? "medium" as const : "low" as const;

    const recentMonthlyAvg = ((monthlyRevenue[3]?.amount ?? 0) + (monthlyRevenue[4]?.amount ?? 0) + (monthlyRevenue[5]?.amount ?? 0)) / 3;
    const priorMonthlyAvg  = ((monthlyRevenue[0]?.amount ?? 0) + (monthlyRevenue[1]?.amount ?? 0) + (monthlyRevenue[2]?.amount ?? 0)) / 3;

    // Insights
    const insights: ClientRiskProfile["insights"] = [];
    if (status === "current" && sorted.length >= 5 && monthsActive >= 3) {
      insights.push({ type: "reliable", params: { count: sorted.length, months: monthsActive } });
    }
    if ((status === "watch" || status === "risk") && avgIntervalDays) {
      insights.push({ type: "delayWarning", params: { avgDays: avgIntervalDays, currentGap: currentGapDays } });
    }
    if (revenueContributionPct >= 25) {
      insights.push({ type: "dependency", params: { pct: revenueContributionPct } });
    }

    // Actions
    const actions: ClientRiskProfile["actions"] = [];
    const isOverdue = avgIntervalDays !== null && currentGapDays > avgIntervalDays * 1.2;
    if (status !== "inactive" && (status === "risk" || (status === "watch" && isOverdue))) {
      actions.push({ type: "followUp" });
    }
    if (trend === "declining") actions.push({ type: "monitor" });
    if (actions.length === 0) actions.push({ type: "noAction" });

    const reliabilityScore: ClientRiskProfile["reliabilityScore"] =
      status === "inactive" ? "inactive" :
      status === "risk"     ? "risk" :
      status === "watch"    ? "watch" :
      sorted.length >= 6 && monthsActive >= 4 && trend !== "declining" ? "excellent" :
      sorted.length >= 3  ? "good" : "watch";

    return {
      name: c.name,
      payerId: null,
      canonicalName: c.name,
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
      reliabilityScore,
      recentMonthlyAvg,
      priorMonthlyAvg,
      rawDescriptions: [...new Set(sorted.map(t => t.description))],
      insights,
      actions,
    };
  });

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
    inactiveCount:    profiles.filter(p => p.lifecycle === "inactive").length,
    hasIntentData:    true,
    unresolvedGroups: [],
  };
}

// ── Financial life intelligence (mirrors getFinancialLifeIntelligence) ─────────

export function computeFinancialLifeIntelligence(): FinancialLifeIntelligence {
  const txs     = DEMO_TRANSACTIONS;
  const refDate = DEMO_REF_DATE;

  const intentTxs = txs.filter(t => t.intent);
  if (intentTxs.length < 5) {
    return {
      savings: { totalTransferred: 0, totalWithdrawn: 0, netPosition: 0, consecutiveSavingsMonths: 0, withdrawalsInLast6Months: 0, monthsWithSavings: 0 },
      spending: { avgMonthlyPersonal: 0, trend: null, trendPct: null },
      business: { avgMonthlyRevenue12m: 0, revenueTrend: null, revenueTrendPct: null, costTrend: null },
      memory: { avgMonthlyIncome12m: 0, strongestIncomeMonth: null, savingsHabitStartMonth: null },
      hasEnoughData: false,
    };
  }

  // Group by month
  const bucketMap = new Map<string, { year: number; month: number; totals: Record<string, number> }>();
  for (const tx of intentTxs) {
    const d     = tx.transactionDate;
    const year  = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key   = `${year}-${String(month).padStart(2, "0")}`;
    if (!bucketMap.has(key)) bucketMap.set(key, { year, month, totals: {} });
    const bucket = bucketMap.get(key)!;
    bucket.totals[tx.intent!] = (bucket.totals[tx.intent!] ?? 0) + tx.amount;
  }

  const buckets = [...bucketMap.values()].sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  // Savings
  let totalTransferred = 0;
  let totalWithdrawn   = 0;
  let monthsWithSavings = 0;
  let consecutiveSavingsMonths = 0;

  for (let i = buckets.length - 1; i >= 0; i--) {
    if ((buckets[i].totals["savings_transfer"] ?? 0) > 0) consecutiveSavingsMonths++;
    else break;
  }

  const last6Cutoff = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() - 6, 1));
  let withdrawalsInLast6Months = 0;

  for (const b of buckets) {
    const transferred = b.totals["savings_transfer"] ?? 0;
    const withdrawn   = b.totals["savings_withdrawal"] ?? 0;
    totalTransferred += transferred;
    totalWithdrawn   += withdrawn;
    if (transferred > 0) monthsWithSavings++;
    const bDate = new Date(Date.UTC(b.year, b.month - 1, 1));
    if (bDate >= last6Cutoff && withdrawn > 0) withdrawalsInLast6Months++;
  }

  // Spending trend
  const INCOME_INTENTS = ["freelance_income", "salary"];
  const COST_INTENTS   = ["business_expense", "subscription", "tax_payment"];

  const personalByMonth = buckets.map(b => b.totals["personal_expense"] ?? 0);
  const revenueByMonth  = buckets.map(b => INCOME_INTENTS.reduce((s, k) => s + (b.totals[k] ?? 0), 0));
  const costByMonth     = buckets.map(b => COST_INTENTS.reduce((s, k) => s + (b.totals[k] ?? 0), 0));

  function computeTrendFn(last3: number[], prev3: number[]): { trend: "increasing" | "stable" | "declining" | null; pct: number | null } {
    const lastAvg = simpleAvg(last3);
    const prevAvg = simpleAvg(prev3);
    if (lastAvg === 0 && prevAvg === 0) return { trend: null, pct: null };
    if (prevAvg === 0) return { trend: lastAvg > 0 ? "increasing" : "stable", pct: null };
    const diffPct = Math.round(((lastAvg - prevAvg) / Math.abs(prevAvg)) * 100);
    if (Math.abs(diffPct) <= 10) return { trend: "stable", pct: null };
    return { trend: diffPct > 0 ? "increasing" : "declining", pct: Math.abs(diffPct) };
  }

  const spendTrend   = computeTrendFn(personalByMonth.slice(-3), personalByMonth.slice(-6, -3));
  const revTrend     = computeTrendFn(revenueByMonth.slice(-3), revenueByMonth.slice(-6, -3));
  const costTrend    = computeTrendFn(costByMonth.slice(-3), costByMonth.slice(-6, -3));
  const avgRev12m    = simpleAvg(revenueByMonth.slice(-12));
  const avgIncome12m = simpleAvg(revenueByMonth.slice(-12));

  let strongestIncomeMonth: FinancialLifeIntelligence["memory"]["strongestIncomeMonth"] = null;
  for (let i = 0; i < buckets.length; i++) {
    const amt = revenueByMonth[i];
    if (amt > (strongestIncomeMonth?.amount ?? 0)) {
      strongestIncomeMonth = { year: buckets[i].year, month: buckets[i].month, amount: amt };
    }
  }

  let savingsHabitStartMonth: FinancialLifeIntelligence["memory"]["savingsHabitStartMonth"] = null;
  for (const b of buckets) {
    if ((b.totals["savings_transfer"] ?? 0) > 0) {
      savingsHabitStartMonth = { year: b.year, month: b.month };
      break;
    }
  }

  return {
    savings: { totalTransferred, totalWithdrawn, netPosition: totalTransferred - totalWithdrawn, consecutiveSavingsMonths, withdrawalsInLast6Months, monthsWithSavings },
    spending: { avgMonthlyPersonal: simpleAvg(personalByMonth), trend: spendTrend.trend, trendPct: spendTrend.pct },
    business: { avgMonthlyRevenue12m: avgRev12m, revenueTrend: revTrend.trend, revenueTrendPct: revTrend.pct, costTrend: costTrend.trend },
    memory: { avgMonthlyIncome12m: avgIncome12m, strongestIncomeMonth, savingsHabitStartMonth },
    hasEnoughData: true,
  };
}

// ── Categorization breakdown (for analytics page) ─────────────────────────────

export function computeCategoryBreakdown() {
  const txs = DEMO_TRANSACTIONS;

  const byCategory: Record<string, number> = {};
  for (const tx of txs.filter(t => t.transactionType === "expense")) {
    const cat = tx.category ?? "uncategorized";
    byCategory[cat] = (byCategory[cat] ?? 0) + tx.amount;
  }

  const totalExpenses = Object.values(byCategory).reduce((s, v) => s + v, 0);

  return Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, total]) => ({
      category,
      total,
      pct: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
    }));
}

export function computeIncomeBySource() {
  const txs = DEMO_TRANSACTIONS;

  const buckets = computeMonthlyBuckets(txs);
  const lastBucket = buckets.length ? buckets[buckets.length - 1] : null;
  const dataYear   = lastBucket?.year ?? 2025;
  const dataMonthMax = lastBucket?.month ?? 12;
  const incSince = new Date(Date.UTC(dataYear, dataMonthMax - 12, 1));

  const byCategory: Record<string, number> = {};
  for (const tx of txs.filter(t => t.transactionType === "income" && t.transactionDate >= incSince)) {
    const cat = tx.category ?? "uncategorized";
    byCategory[cat] = (byCategory[cat] ?? 0) + tx.amount;
  }

  const totalInc = Object.values(byCategory).reduce((s, v) => s + v, 0);

  return Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, total]) => ({
      category,
      total,
      pct: totalInc > 0 ? Math.round((total / totalInc) * 100) : 0,
    }));
}

export function computeYtdTotals() {
  const txs    = DEMO_TRANSACTIONS;
  const buckets = computeMonthlyBuckets(txs);
  const lastB   = buckets.length ? buckets[buckets.length - 1] : null;
  const dataYear    = lastB?.year  ?? 2025;
  const prevYear    = dataYear - 1;
  const dataMonthMax = lastB?.month ?? 12;

  let ytdInc = 0, ytdExp = 0, ytdCash = 0;
  let prevInc = 0, prevExp = 0, prevCash = 0;

  for (const b of buckets) {
    if (b.year === dataYear && b.month <= dataMonthMax) {
      ytdInc  += b.income;
      ytdExp  += b.expenses;
      ytdCash += b.income - b.expenses;
    }
    if (b.year === prevYear && b.month <= dataMonthMax) {
      prevInc  += b.income;
      prevExp  += b.expenses;
      prevCash += b.income - b.expenses;
    }
  }

  return { dataYear, prevYear, dataMonthMax, ytdInc, ytdExp, ytdCash, prevInc, prevExp, prevCash };
}

// ── Full demo dataset (computed once) ─────────────────────────────────────────

export interface DemoDataset {
  chartData:           MonthPoint[];
  summary:             ReturnType<typeof computeDashboardSummary>;
  comparison:          ReturnType<typeof computeMonthlyComparison>;
  coverage:            ReturnType<typeof computeDataCoverage>;
  categoryInsights:    CategoryInsights;
  concentration:       IncomeConcentration;
  intentBreakdown:     ReturnType<typeof computeIntentBreakdown>;
  forecast:            ForecastResult | null;
  financialLife:       FinancialLifeIntelligence;
  clientData:          ClientRiskCenterData;
  rankedInsights:      RankedInsight[];
  nonZeroMonths:       number;
  totalTx:             number;
  personaName:         string;
  personaFirstName:    string;
}

// Cache per locale so we don't recompute on every request
const _cache: Partial<Record<Locale, DemoDataset>> = {};

export function getDemoDataset(locale: Locale): DemoDataset {
  if (_cache[locale]) return _cache[locale]!;

  const chartData        = computeHistoricalData(locale);
  const summary          = computeDashboardSummary(DEMO_TRANSACTIONS);
  const comparison       = computeMonthlyComparison(locale);
  const coverage         = computeDataCoverage(locale);
  const categoryInsights = computeCategoryInsights();
  const concentration    = computeIncomeConcentration();
  const intentBreakdown  = computeIntentBreakdown();
  const forecast         = computeForecast();
  const financialLife    = computeFinancialLifeIntelligence();
  const clientData       = computeClientRiskProfiles(locale);
  const nonZeroMonths    = chartData.filter(d => d.income > 0 || d.expenses > 0).length;
  const totalTx          = DEMO_TRANSACTIONS.length;

  const rankedInsights = buildHistoricalInsights(
    chartData,
    categoryInsights.topExpenseCategories,
    categoryInsights.yearlySnapshots,
    categoryInsights.seasonality,
    concentration,
    locale
  );

  const dataset: DemoDataset = {
    chartData, summary, comparison, coverage, categoryInsights,
    concentration, intentBreakdown, forecast, financialLife,
    clientData, rankedInsights, nonZeroMonths, totalTx,
    personaName:      DEMO_PERSONA.name,
    personaFirstName: DEMO_PERSONA.firstName,
  };

  _cache[locale] = dataset;
  return dataset;
}
