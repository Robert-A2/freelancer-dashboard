// Financial Intelligence Engine V2
// Every insight names exact months, years, and amounts — no generic "last 6 months" language.
// What happened · Why it happened · What action improves the outcome.
//
// Insights are returned as { key, values } descriptors (see insight-types.ts) and
// rendered locale-aware via t.rich() — no hardcoded English strings here.

import type {
  CategoryTrend,
  YearlySnapshot,
  MonthlySeasonality,
  MonthPoint,
} from "./analytics-engine";
import type { Insight, RankedInsight, InsightValue } from "./insight-types";
import { cat } from "./insight-types";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

export type { CategoryTrend, YearlySnapshot, MonthlySeasonality, MonthPoint };
export type { RankedInsight } from "./insight-types";

export interface RecentTx {
  description: string;
  amount: number;
  type: string;
  category: string;
}

// Semantic grouping for historical insights — tagged at generation time
// (where the meaning is unambiguous) so the UI can rank and group by theme
// instead of guessing from the rendered sentence.
export type InsightCategory = "growth" | "cashflow" | "spending" | "seasonality" | "clients";

export interface DashboardIntelligence {
  snapshotSummary: Insight | null;
  snapshotContext: Insight[];
  comparisonInterpretation: Insight | null;
  trajectoryInsight: Insight | null;
  trajectoryDetails: Insight[];
  forecastReasons: Insight[];
  forecastImprovements: Insight[];
  cashflowDeficitReason: Insight | null;
  healthStatus: "healthy" | "watch" | "at-risk";
  healthStatusExplanation: Insight | null;
  businessTrendDirection: "improving" | "stable" | "weakening";
  biggestRisk: Insight | null;
  biggestOpportunity: Insight | null;
  seasonalInsights: Insight[];
  notableTransactions: Insight[];
}

// ── Formatters ─────────────────────────────────────────────────────────────

// Mirrors the old eur() helper's Math.abs() behaviour, locale-aware.
function fmtAmt(n: number, locale: Locale): string {
  return formatCurrency(Math.abs(n), locale);
}

const pct = (current: number, base: number): number => {
  if (base === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - base) / Math.abs(base)) * 100);
};

const avg = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// e.g. monthYearLabel(2024, 3, "en", "long") → "March 2024" / monthYearLabel(2024, 3, "fr", "long") → "mars 2024"
function monthYearLabel(year: number, month: number, locale: Locale, style: "long" | "short" = "long"): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  });
}

// ── Trend helpers ──────────────────────────────────────────────────────────

function trendDir(values: number[]): "up" | "down" | "stable" {
  if (values.length < 3) return "stable";
  const half = Math.ceil(values.length / 2);
  const change = pct(avg(values.slice(-half)), avg(values.slice(0, half)));
  if (change > 5) return "up";
  if (change < -5) return "down";
  return "stable";
}

interface StreakResult {
  length: number;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

function longestPositiveStreakWithDates(history: MonthPoint[]): StreakResult | null {
  let maxLen = 0, maxStart = -1, maxEnd = -1;
  let cur = 0, curStart = -1;

  for (let i = 0; i < history.length; i++) {
    if (history[i].cashflow >= 0) {
      if (cur === 0) curStart = i;
      cur++;
      if (cur > maxLen) { maxLen = cur; maxStart = curStart; maxEnd = i; }
    } else {
      cur = 0;
    }
  }

  if (maxLen < 3 || maxStart < 0) return null;
  return {
    length: maxLen,
    startYear: history[maxStart].year,
    startMonth: history[maxStart].monthNum,
    endYear: history[maxEnd].year,
    endMonth: history[maxEnd].monthNum,
  };
}

// ── Category helpers ───────────────────────────────────────────────────────

function topChangedCategories(
  categories: CategoryTrend[],
  direction: "up" | "down",
  limit = 2
): CategoryTrend[] {
  return categories
    .filter((c) => direction === "up" ? c.changeAmount > 5 : c.changeAmount < -5)
    .sort((a, b) =>
      direction === "up" ? b.changeAmount - a.changeAmount : a.changeAmount - b.changeAmount
    )
    .slice(0, limit);
}

function categoryYearRange(c: CategoryTrend) {
  const years = Object.keys(c.yearlyTotals).map(Number).sort((a, b) => a - b);
  if (years.length < 2) return null;
  return {
    from: years[0],
    to: years[years.length - 1],
    fromAmt: c.yearlyTotals[years[0]] ?? 0,
    toAmt: c.yearlyTotals[years[years.length - 1]] ?? 0,
  };
}

// ── Seasonal helpers ───────────────────────────────────────────────────────

const QUARTERS = [
  { id: "q1", months: [1, 2, 3] },
  { id: "q2", months: [4, 5, 6] },
  { id: "q3", months: [7, 8, 9] },
  { id: "q4", months: [10, 11, 12] },
];

function quarterAvg(
  seasonality: MonthlySeasonality[],
  months: number[]
): { income: number; expenses: number } {
  const rel = seasonality.filter((s) => months.includes(s.monthOfYear) && s.sampleCount > 0);
  return { income: avg(rel.map((s) => s.avgIncome)), expenses: avg(rel.map((s) => s.avgExpenses)) };
}

// ── Income type detection ──────────────────────────────────────────────────
// Determines whether the user's income pattern looks like a freelancer
// (variable, multi-source) or an employee (stable salary). This shapes the
// language used throughout the intelligence layer so it stays accurate and
// relevant regardless of who uploads the CSV.

type IncomeType = "freelance" | "salary" | "mixed" | "unknown";

const SALARY_CATEGORIES   = new Set(["salary"]);
const FREELANCE_CATEGORIES = new Set([
  "stripe", "paypal", "client payment", "invoice payment", "freelance platform",
]);

function detectIncomeType(recentTxs: RecentTx[], active: MonthPoint[]): IncomeType {
  const incomeTxs = recentTxs.filter((t) => t.type === "income");
  const salaryHits   = incomeTxs.filter((t) => SALARY_CATEGORIES.has(t.category)).length;
  const freelanceHits = incomeTxs.filter((t) => FREELANCE_CATEGORIES.has(t.category)).length;

  // Income variance is the strongest signal.
  // Salary = near-identical every month (CV < 5%).
  // Freelance = highly variable month-to-month (CV > 25%).
  const withIncome = active.filter((h) => h.income > 0);
  if (withIncome.length >= 3) {
    const avgInc  = avg(withIncome.map((h) => h.income));
    const variance = withIncome.reduce((s, h) => s + (h.income - avgInc) ** 2, 0) / withIncome.length;
    const cv = avgInc > 0 ? (Math.sqrt(variance) / avgInc) * 100 : 100;

    if (cv < 5)  return salaryHits > 0 || freelanceHits === 0 ? "salary"   : "mixed";
    if (cv > 35 && salaryHits === 0)                           return "freelance";
  }

  if (salaryHits > 0 && freelanceHits === 0) return "salary";
  if (freelanceHits > 0 && salaryHits === 0) return "freelance";
  if (salaryHits > 0 && freelanceHits > 0)   return "mixed";
  return "unknown";
}

// ── Language helpers ───────────────────────────────────────────────────────
// These return Insight descriptors with an `incomeType` select tag, so a
// salaried user never sees "client payments" or "pipeline" language.

function phraseIncomeAboveAvg(it: IncomeType, currentInc: number, avgInc: number, diff: number, months: number, locale: Locale): Insight {
  return {
    key: "insights.context.incomeAboveAvg",
    values: {
      incomeType: it === "salary" ? "salary" : "other",
      current: fmtAmt(currentInc, locale),
      pct: String(diff),
      months,
      avg: fmtAmt(avgInc, locale),
    },
  };
}

function phraseIncomeBelowAvg(it: IncomeType, currentInc: number, avgInc: number, diff: number, months: number, locale: Locale): Insight {
  return {
    key: "insights.context.incomeBelowAvg",
    values: {
      incomeType: it === "salary" ? "salary" : "other",
      current: fmtAmt(currentInc, locale),
      pct: String(Math.abs(diff)),
      months,
      avg: fmtAmt(avgInc, locale),
    },
  };
}

function phraseIncomeDecline(it: IncomeType, pctDrop: number): Insight {
  return {
    key: "insights.comparison.incomeDecline",
    values: { incomeType: it, pct: String(pctDrop) },
  };
}

function phraseIncomeYoYDrop(it: IncomeType, dropPct: number, prevYear: number, prevAmt: number, lastYear: number, lastAmt: number, locale: Locale): Insight {
  return {
    key: "insights.forecast.incomeYoYDrop",
    values: {
      incomeType: it,
      pct: String(dropPct),
      prevYear: String(prevYear),
      prevAmount: fmtAmt(prevAmt, locale),
      lastYear: String(lastYear),
      lastAmount: fmtAmt(lastAmt, locale),
    },
  };
}

// ── Historical insights — ranked and grouped by theme ─────────────────────
// Tagged with a category at the exact point each insight is generated (where
// its meaning is unambiguous), then sorted by decision-impact priority so
// consumers can show "the top N that matter" instead of a wall of text.

const INSIGHT_CATEGORY_PRIORITY: Record<InsightCategory, number> = {
  growth: 1,
  cashflow: 2,
  spending: 3,
  seasonality: 4,
  clients: 5,
};

export function buildHistoricalInsights(
  history: MonthPoint[],
  categories: CategoryTrend[],
  yearlySnapshots: YearlySnapshot[],
  seasonality: MonthlySeasonality[],
  incomeConcentration: { topSourceDesc: string | null; topSourcePct: number; totalSources: number; isHighConcentration: boolean } | undefined,
  locale: Locale
): RankedInsight[] {
  const active = history.filter((h) => h.income > 0 || h.expenses > 0);
  const avgIncome = avg(active.map((h) => h.income));
  const avgExpenses = avg(active.map((h) => h.expenses));
  const firstMonth = active[0] ?? null;
  const lastMonth = active[active.length - 1] ?? null;

  const insights: RankedInsight[] = [];
  const push = (category: InsightCategory, insight: Insight) => insights.push({ ...insight, category });

  // ── Historical highlights — exact years and months ─────────────────────

  if (yearlySnapshots.length >= 2) {
    const bestIncYear = yearlySnapshots.reduce((b, y) => (y.income > b.income ? y : b));
    const highExpYear = yearlySnapshots.reduce((b, y) => (y.expenses > b.expenses ? y : b));
    const firstYear = yearlySnapshots[0];
    const lastYear = yearlySnapshots[yearlySnapshots.length - 1];

    push("growth", {
      key: "insights.bestIncomeYear",
      values: { year: String(bestIncYear.year), amount: fmtAmt(bestIncYear.income, locale) },
    });

    if (yearlySnapshots.length >= 3 && firstYear.year !== lastYear.year) {
      // Only use firstYear as a comparison base if it has at least 6 months of data.
      // A partial first year (e.g. only Dec 2023) produces absurd percentages.
      const firstYearIsComplete = firstYear.monthCount >= 6;

      const incGrowth = pct(lastYear.income, firstYear.income);
      if (firstYearIsComplete && Math.abs(incGrowth) >= 10 && Math.abs(incGrowth) <= 1000) {
        push("growth", {
          key: "insights.incomeGrowthYearly",
          values: {
            direction: incGrowth > 0 ? "grew" : "declined",
            pct: String(Math.abs(incGrowth)),
            fromYear: String(firstYear.year),
            fromAmount: fmtAmt(firstYear.income, locale),
            toYear: String(lastYear.year),
            toAmount: fmtAmt(lastYear.income, locale),
          },
        });
      }

      // Show highest expense year — only attach a growth % when the base year is reliable
      if (highExpYear.year !== firstYear.year) {
        const expGrowth = pct(highExpYear.expenses, firstYear.expenses);
        const showPct = firstYearIsComplete && expGrowth >= 20 && expGrowth <= 1000;
        push("spending", {
          key: "insights.highestExpenseYear",
          values: {
            withGrowth: showPct ? "yes" : "no",
            year: String(highExpYear.year),
            amount: fmtAmt(highExpYear.expenses, locale),
            pct: String(expGrowth),
            baseYear: String(firstYear.year),
          },
        });
      }
    }

    // Overall cashflow margin
    const totalInc = yearlySnapshots.reduce((s, y) => s + y.income, 0);
    const totalExp = yearlySnapshots.reduce((s, y) => s + y.expenses, 0);
    if (totalInc > 0) {
      const margin = Math.round(((totalInc - totalExp) / totalInc) * 100);
      const tier = margin >= 20 ? "strong" : margin >= 10 ? "healthy" : margin >= 0 ? "tight" : "negative";
      push("cashflow", {
        key: "insights.overallCashflowMargin",
        values: { fromYear: String(firstYear.year), toYear: String(lastYear.year), pct: String(margin), tier },
      });
    }

    // Cashflow streak with exact dates
    const streak = longestPositiveStreakWithDates(active);
    if (streak) {
      push("cashflow", {
        key: "insights.longestPositiveStreak",
        values: {
          count: streak.length,
          startMonth: monthYearLabel(streak.startYear, streak.startMonth, locale, "short"),
          endMonth: monthYearLabel(streak.endYear, streak.endMonth, locale, "short"),
        },
      });
    }
  } else if (active.length >= 3 && firstMonth && lastMonth) {
    push("growth", {
      key: "insights.avgMonthlyIncomeRange",
      values: {
        startMonth: monthYearLabel(firstMonth.year, firstMonth.monthNum, locale, "short"),
        endMonth: monthYearLabel(lastMonth.year, lastMonth.monthNum, locale, "short"),
        amount: fmtAmt(avgIncome, locale),
      },
    });
    push("spending", {
      key: "insights.avgMonthlyExpenses",
      values: { amount: fmtAmt(avgExpenses, locale) },
    });
    if (avgIncome > 0 && avgExpenses > 0) {
      const avgCfMargin = Math.round(((avgIncome - avgExpenses) / avgIncome) * 100);
      const tier = avgCfMargin >= 20 ? "strong" : avgCfMargin >= 10 ? "healthy" : avgCfMargin >= 0 ? "tight" : "negative";
      push("cashflow", {
        key: "insights.avgCashflowMargin",
        values: { pct: String(avgCfMargin), tier },
      });
    }
  }

  // Best income month from all history
  if (active.length >= 3) {
    const best = active.reduce((b, h) => (h.income > b.income ? h : b));
    if (best.income > 0) {
      push("growth", {
        key: "insights.bestIncomeMonth",
        values: { month: monthYearLabel(best.year, best.monthNum, locale, "short"), amount: fmtAmt(best.income, locale) },
      });
    }
  }

  // ── Cashflow consistency check ──────────────────────────────────────────
  {
    const recentActive6 = active.slice(-6);
    const recentNegCount = recentActive6.filter(h => h.cashflow < 0).length;
    if (recentNegCount >= 3 && active.length >= 6) {
      push("cashflow", {
        key: "insights.negativeCashflowRecent",
        values: { count: recentNegCount },
      });
    }

    // Flag if cashflow margin deteriorated year-over-year
    if (yearlySnapshots.length >= 2) {
      const lastY = yearlySnapshots[yearlySnapshots.length - 1];
      const prevY = yearlySnapshots[yearlySnapshots.length - 2];
      const lastMargin = lastY.income > 0 ? lastY.cashflow / lastY.income : 0;
      const prevMargin = prevY.income > 0 ? prevY.cashflow / prevY.income : 0;
      if (prevMargin > 0.1 && lastMargin < prevMargin * 0.5) {
        push("cashflow", {
          key: "insights.cashflowMarginDeclined",
          values: {
            prevPct: String(Math.round(prevMargin * 100)),
            prevYear: String(prevY.year),
            lastPct: String(Math.round(lastMargin * 100)),
            lastYear: String(lastY.year),
          },
        });
      }
    }
  }

  // ── Income gap detection ─────────────────────────────────────────────────
  // Months where the user had expenses but zero income.
  // These are genuine coverage gaps — the user was spending with no earnings.
  {
    const incomeGaps = history.filter((h) => h.income === 0 && h.expenses > 0);
    if (incomeGaps.length >= 1 && active.length >= 6) {
      const lastOrd = lastMonth ? lastMonth.year * 12 + lastMonth.monthNum : 0;
      const recentGaps = lastMonth ? incomeGaps.filter((h) => {
        return h.year * 12 + h.monthNum >= lastOrd - 11;
      }) : [];
      const totalGaps = incomeGaps.length;
      const avgExpInGap = avg(incomeGaps.map((h) => h.expenses));

      if (recentGaps.length >= 1) {
        push("cashflow", {
          key: "insights.incomeGapsDetected",
          values: { count: totalGaps, amount: fmtAmt(avgExpInGap, locale) },
        });
      }
    }
  }

  // ── Seasonal insights — specific months and quarters ────────────────────

  const activeSeason = seasonality.filter((s) => s.sampleCount >= 2 && s.avgIncome > 0);

  if (activeSeason.length >= 4) {
    const quarterData = QUARTERS.map((q) => ({
      id: q.id,
      ...quarterAvg(seasonality, q.months),
    })).filter((q) => q.income > 0);

    if (quarterData.length >= 2) {
      const peakQ = quarterData.reduce((b, q) => (q.income > b.income ? q : b));
      const lowestQ = quarterData.reduce((b, q) => (q.income < b.income ? q : b));

      if (peakQ.id !== lowestQ.id && pct(peakQ.income, lowestQ.income) > 10) {
        push("seasonality", {
          key: "insights.seasonalIncomePeak",
          values: {
            peakQuarter: peakQ.id,
            peakAmount: fmtAmt(peakQ.income, locale),
            lowQuarter: lowestQ.id,
            lowAmount: fmtAmt(lowestQ.income, locale),
          },
        });
      }

      const peakExpQ = quarterData.reduce((b, q) => (q.expenses > b.expenses ? q : b));
      if (peakExpQ.expenses > 0 && pct(peakExpQ.expenses, avg(quarterData.map((q) => q.expenses))) > 15) {
        push("seasonality", {
          key: "insights.seasonalExpensePeak",
          values: { quarter: peakExpQ.id, amount: fmtAmt(peakExpQ.expenses, locale) },
        });
      }
    }

    // Best and worst income months across history
    const peak = activeSeason.reduce((b, s) => (s.avgIncome > b.avgIncome ? s : b));
    const lowest = activeSeason.reduce((b, s) => (s.avgIncome < b.avgIncome ? s : b));
    if (peak.monthName !== lowest.monthName) {
      push("seasonality", {
        key: "insights.seasonalStrongestWeakestMonth",
        values: {
          peakMonth: String(peak.monthOfYear),
          peakAmount: fmtAmt(peak.avgIncome, locale),
          lowMonth: String(lowest.monthOfYear),
          lowAmount: fmtAmt(lowest.avgIncome, locale),
        },
      });
    }
  }

  // ── Category insights — exact years and growth amounts ──────────────────

  for (const c of categories.slice(0, 6)) {
    const range = categoryYearRange(c);
    if (!range) continue;

    const { from, to, fromAmt, toAmt } = range;
    if (from === to) continue;

    const totalGrowth = pct(toAmt, fromAmt);
    const years = to - from;

    // Cap the cited percentage at 1000% — beyond that, a tiny `fromAmt` base
    // (e.g. one €20 fee in the first year) produces a technically-correct but
    // absurd-sounding "grew 1600%" headline. Fall through to "more than doubled"
    // instead, which conveys the same signal without an inflated number.
    if (c.yearOverYearTrend === "growing" && totalGrowth >= 20 && totalGrowth <= 1000) {
      push("spending", {
        key: "insights.categoryGrew",
        values: { category: cat(c.category), fromAmount: fmtAmt(fromAmt, locale), fromYear: String(from), toAmount: fmtAmt(toAmt, locale), toYear: String(to), pct: String(totalGrowth), years },
      });
    } else if (c.yearOverYearTrend === "declining" && totalGrowth <= -20) {
      push("spending", {
        key: "insights.categoryFell",
        values: { category: cat(c.category), fromAmount: fmtAmt(fromAmt, locale), fromYear: String(from), toAmount: fmtAmt(toAmt, locale), toYear: String(to), pct: String(Math.abs(totalGrowth)), years },
      });
    } else if (toAmt > fromAmt * 2) {
      push("spending", {
        key: "insights.categoryDoubled",
        values: { category: cat(c.category), fromAmount: fmtAmt(fromAmt, locale), fromYear: String(from), toAmount: fmtAmt(toAmt, locale), toYear: String(to) },
      });
    }
  }

  // Subscription growth check with exact years
  const subCat = categories.find((c) => c.category === "subscriptions" || c.category === "software");
  if (subCat) {
    const years = Object.keys(subCat.yearlyTotals).map(Number).sort((a, b) => a - b);
    if (years.length >= 3) {
      const growingEveryYear = years.every((y, i) => {
        if (i === 0) return true;
        return (subCat.yearlyTotals[y] ?? 0) >= (subCat.yearlyTotals[years[i - 1]] ?? 0);
      });
      if (growingEveryYear) {
        push("spending", {
          key: "insights.categorySubscriptionsGrewEveryYear",
          values: {
            category: cat(subCat.category),
            fromYear: String(years[0]),
            fromAmount: fmtAmt(subCat.yearlyTotals[years[0]] ?? 0, locale),
            toYear: String(years[years.length - 1]),
            toAmount: fmtAmt(subCat.yearlyTotals[years[years.length - 1]] ?? 0, locale),
          },
        });
      }
    }
  }

  // ── Client concentration ─────────────────────────────────────────────────
  if (incomeConcentration && incomeConcentration.totalSources > 0) {
    if (incomeConcentration.isHighConcentration) {
      push("clients", {
        key: "insights.clientConcentration",
        values: {
          pct: String(incomeConcentration.topSourcePct),
          hasSource: incomeConcentration.topSourceDesc ? "yes" : "no",
          source: incomeConcentration.topSourceDesc ?? "",
        },
      });
    } else {
      push("clients", {
        key: "insights.incomeReasonablyDiversified",
        values: { pct: String(incomeConcentration.topSourcePct), total: incomeConcentration.totalSources },
      });
    }
  }

  // Stable sort (guaranteed in Node/ES2019+) keeps each category's insights in
  // their original importance-order while grouping by decision-impact priority.
  return [...insights].sort((a, b) => INSIGHT_CATEGORY_PRIORITY[a.category] - INSIGHT_CATEGORY_PRIORITY[b.category]);
}

// ── Main export ────────────────────────────────────────────────────────────

export function generateDashboardIntelligence(
  current: { totalIncome: number; totalExpenses: number; totalSavings: number; netCashflow: number } | null,
  previous: { totalIncome: number; totalExpenses: number; totalSavings: number; netCashflow: number } | null,
  changes: { income: number; expenses: number; savings: number; cashflow: number } | null,
  history: MonthPoint[],
  recentTxs: RecentTx[],
  forecast: {
    projectedIncome: number;
    projectedExpenses: number;
    projectedSavings: number;
    projectedCashflow: number;
    basedOnMonths: number;
  } | null,
  _categories: CategoryTrend[],
  _yearlySnapshots: YearlySnapshot[],
  _seasonality: MonthlySeasonality[],
  // Optional: income concentration data from DB query
  incomeConcentration: { topSourceDesc: string | null; topSourcePct: number; totalSources: number; isHighConcentration: boolean } | undefined,
  locale: Locale
): DashboardIntelligence {
  // Defensive: guard against undefined inputs that can arrive at runtime
  const categories: CategoryTrend[] = _categories ?? [];
  const yearlySnapshots: YearlySnapshot[] = _yearlySnapshots ?? [];
  const seasonality: MonthlySeasonality[] = _seasonality ?? [];

  const empty: DashboardIntelligence = {
    snapshotSummary: { key: "insights.snapshot.uploadPrompt" },
    snapshotContext: [],
    comparisonInterpretation: null,
    trajectoryInsight: null,
    trajectoryDetails: [],
    forecastReasons: [],
    forecastImprovements: [],
    cashflowDeficitReason: null,
    healthStatus: "watch",
    healthStatusExplanation: null,
    businessTrendDirection: "stable",
    biggestRisk: null,
    biggestOpportunity: null,
    seasonalInsights: [],
    notableTransactions: [],
  };

  if (!current) return empty;

  // Active = months that have any data
  const active = history.filter((h) => h.income > 0 || h.expenses > 0);
  const allIncomes = active.map((h) => h.income);
  const allExpenses = active.map((h) => h.expenses);
  const avgIncome = avg(allIncomes);
  const avgExpenses = avg(allExpenses);

  // Detect income type — shapes language throughout the intelligence layer
  const incomeType = detectIncomeType(recentTxs, active);

  // First and last month in the dataset
  const firstMonth = active[0] ?? null;
  const lastMonth = active[active.length - 1] ?? null;

  // ── SNAPSHOT SUMMARY ────────────────────────────────────────────────────

  const biggestExpIncrease = topChangedCategories(categories, "up", 1)[0];
  const biggestExpDecrease = topChangedCategories(categories, "down", 1)[0];

  const incUp = changes && changes.income > 2;
  const expDown = changes && changes.expenses < -2;
  const incDown = changes && changes.income < -5;
  const expUp = changes && changes.expenses > 5;
  const cashflowOk = current.netCashflow >= 0;

  let snapshotSummary: Insight;

  if (!previous) {
    snapshotSummary = { key: "insights.snapshot.firstUpload", values: { cashflowOk: cashflowOk ? "positive" : "negative" } };
  } else if (incUp && expDown) {
    snapshotSummary = { key: "insights.snapshot.excellentMonth" };
  } else if (incUp && expUp) {
    snapshotSummary = biggestExpIncrease
      ? { key: "insights.snapshot.incomeUpExpensesUp", values: { hasCategory: "yes", category: cat(biggestExpIncrease.category), amount: fmtAmt(biggestExpIncrease.changeAmount, locale) } }
      : { key: "insights.snapshot.incomeUpExpensesUp", values: { hasCategory: "no" } };
  } else if (incDown && expUp) {
    snapshotSummary = biggestExpIncrease
      ? { key: "insights.snapshot.incomeDownExpensesUp", values: { hasCategory: "yes", category: cat(biggestExpIncrease.category), amount: fmtAmt(biggestExpIncrease.changeAmount, locale) } }
      : { key: "insights.snapshot.incomeDownExpensesUp", values: { hasCategory: "no" } };
  } else if (!cashflowOk) {
    snapshotSummary = biggestExpIncrease
      ? { key: "insights.snapshot.expensesExceedIncome", values: { hasCategory: "yes", category: cat(biggestExpIncrease.category) } }
      : { key: "insights.snapshot.expensesExceedIncome", values: { hasCategory: "no" } };
  } else if (expUp && biggestExpIncrease) {
    snapshotSummary = { key: "insights.snapshot.expensesIncreasedLed", values: { category: cat(biggestExpIncrease.category), amount: fmtAmt(biggestExpIncrease.changeAmount, locale) } };
  } else if (expDown && biggestExpDecrease) {
    snapshotSummary = { key: "insights.snapshot.goodCostControl", values: { category: cat(biggestExpDecrease.category), amount: fmtAmt(Math.abs(biggestExpDecrease.changeAmount), locale) } };
  } else {
    snapshotSummary = { key: "insights.snapshot.stableMonth" };
  }

  // ── SNAPSHOT CONTEXT ────────────────────────────────────────────────────

  const snapshotContext: Insight[] = [];

  if (firstMonth && lastMonth && active.length > 1) {
    snapshotContext.push({
      key: "insights.context.analysisCovers",
      values: {
        months: active.length,
        fromMonth: monthYearLabel(firstMonth.year, firstMonth.monthNum, locale, "long"),
        toMonth: monthYearLabel(lastMonth.year, lastMonth.monthNum, locale, "long"),
      },
    });
  }

  if (avgIncome > 0) {
    const diff = pct(current.totalIncome, avgIncome);
    if (diff > 5) {
      snapshotContext.push(phraseIncomeAboveAvg(incomeType, current.totalIncome, avgIncome, diff, active.length, locale));
    } else if (diff < -5) {
      snapshotContext.push(phraseIncomeBelowAvg(incomeType, current.totalIncome, avgIncome, diff, active.length, locale));
    } else {
      snapshotContext.push({ key: "insights.context.incomeInLine", values: { months: active.length, avg: fmtAmt(avgIncome, locale) } });
    }
  }

  if (avgExpenses > 0) {
    const diff = pct(current.totalExpenses, avgExpenses);
    const topCat = categories[0];
    if (diff > 10 && topCat) {
      snapshotContext.push({
        key: "insights.context.expensesAboveAvgTopCat",
        values: { current: fmtAmt(current.totalExpenses, locale), pct: String(diff), category: cat(topCat.category), amount: fmtAmt(topCat.currentMonthTotal, locale) },
      });
    } else if (diff < -10) {
      snapshotContext.push({
        key: "insights.context.expensesBelowAvg",
        values: { current: fmtAmt(current.totalExpenses, locale), pct: String(Math.abs(diff)), avg: fmtAmt(avgExpenses, locale) },
      });
    }
  }

  // ── COMPARISON INTERPRETATION ────────────────────────────────────────────

  let comparisonInterpretation: Insight | null = null;

  if (changes && previous) {
    const { income: ic, expenses: ec } = changes;
    const driversUp = topChangedCategories(categories, "up", 2);
    const driversDown = topChangedCategories(categories, "down", 2);

    const driverValues = (cats: CategoryTrend[], useAbs: boolean): Record<string, InsightValue> => {
      const values: Record<string, InsightValue> = { driverCount: cats.length === 0 ? "0" : cats.length === 1 ? "1" : "2" };
      if (cats[0]) { values.cat1 = cat(cats[0].category); values.amt1 = fmtAmt(useAbs ? Math.abs(cats[0].changeAmount) : cats[0].changeAmount, locale); }
      if (cats[1]) { values.cat2 = cat(cats[1].category); values.amt2 = fmtAmt(useAbs ? Math.abs(cats[1].changeAmount) : cats[1].changeAmount, locale); }
      return values;
    };

    if (ic > 5 && ec < 0) {
      comparisonInterpretation = { key: "insights.comparison.incomeUpExpensesDown", values: driverValues(driversDown, true) };
    } else if (ic > 5 && ec > 5) {
      if (ic > ec) {
        comparisonInterpretation = driversUp.length
          ? { key: "insights.comparison.incomeOutpacesExpensesWithDrivers", values: { ...driverValues(driversUp, false), icPct: String(ic), ecPct: String(ec) } }
          : { key: "insights.comparison.incomeOutpacesExpenses", values: { icPct: String(ic), ecPct: String(ec) } };
      } else {
        comparisonInterpretation = driversUp.length
          ? { key: "insights.comparison.expensesOutpaceIncomeWithDrivers", values: { ...driverValues(driversUp, false), icPct: String(ic), ecPct: String(ec) } }
          : { key: "insights.comparison.expensesOutpaceIncome", values: { icPct: String(ic), ecPct: String(ec) } };
      }
    } else if (ic < -5 && ec > 5) {
      comparisonInterpretation = { key: "insights.comparison.incomeDownExpensesUp", values: { ...driverValues(driversUp, false), icPct: String(Math.abs(ic)), ecPct: String(ec) } };
    } else if (ic < -5) {
      comparisonInterpretation = phraseIncomeDecline(incomeType, Math.abs(ic));
    } else if (ec > 10 && driversUp.length) {
      comparisonInterpretation = { key: "insights.comparison.expensesJumped", values: { ...driverValues(driversUp, false), ecPct: String(ec) } };
    } else if (changes.cashflow > 10) {
      comparisonInterpretation = { key: "insights.comparison.cashflowImprovedMeaningfully" };
    } else {
      comparisonInterpretation = { key: "insights.comparison.stable" };
    }
  }

  // ── TRAJECTORY — analyses the COMPLETE uploaded history, not a fixed window ─

  let trajectoryInsight: Insight | null = null;
  const trajectoryDetails: Insight[] = [];

  const spanMonths = active.length;
  const firstPoint = active[0];
  const lastPoint = active[active.length - 1];
  const growingExpCats = categories.filter((c) => c.yearOverYearTrend === "growing").slice(0, 2);

  if (spanMonths < 3) {
    trajectoryInsight = { key: "insights.trajectory.moreDataNeeded" };
  } else {
    const startMonth = monthYearLabel(firstPoint.year, firstPoint.monthNum, locale, "short");
    const endMonth = monthYearLabel(lastPoint.year, lastPoint.monthNum, locale, "short");
    const overallIncChange = pct(lastPoint.income, firstPoint.income);
    const overallExpChange = pct(lastPoint.expenses, firstPoint.expenses);
    const avgMonthlyInc = avg(active.map((h) => h.income));
    const avgMonthlyExp = avg(active.map((h) => h.expenses));

    if (spanMonths >= 24 && yearlySnapshots.length >= 2) {
      // ── MULTI-YEAR: show year-by-year journey ─────────────────────────────
      const lastYear = yearlySnapshots[yearlySnapshots.length - 1];

      // Use first year with ≥6 months as the reliable base for % comparisons.
      const reliableBase = yearlySnapshots.find((y) => y.monthCount >= 6) ?? yearlySnapshots[0];
      const yearSpan = lastYear.year - reliableBase.year;
      const totalIncGrowth = pct(lastYear.income, reliableBase.income);

      trajectoryInsight = {
        key: "insights.trajectory.multiYear",
        values: {
          direction: totalIncGrowth > 10 ? "grew" : totalIncGrowth < -10 ? "declined" : "stable",
          pct: String(Math.abs(totalIncGrowth)),
          years: yearSpan,
          fromYear: String(reliableBase.year),
          fromAmount: fmtAmt(reliableBase.income, locale),
          toYear: String(lastYear.year),
          toAmount: fmtAmt(lastYear.income, locale),
          avgAmount: fmtAmt(avgMonthlyInc, locale),
        },
      };

      // Year-by-year breakdown
      yearlySnapshots.forEach((snap, i) => {
        if (i === 0) return;
        const prev = yearlySnapshots[i - 1];

        // Partial previous year makes percentages meaningless — just state the totals
        if (prev.monthCount < 6) {
          trajectoryDetails.push({
            key: "insights.trajectory.yearSummaryPartial",
            values: { year: String(snap.year), income: fmtAmt(snap.income, locale), expenses: fmtAmt(snap.expenses, locale) },
          });
          return;
        }

        const yoyInc = pct(snap.income, prev.income);
        const yoyExp = pct(snap.expenses, prev.expenses);
        const direction = yoyInc > 5 ? "up" : yoyInc < -5 ? "down" : "stable";
        const expNote =
          yoyExp > yoyInc + 5 && yoyExp <= 1000 ? "faster"
          : yoyExp < -5 ? "fell"
          : "none";
        trajectoryDetails.push({
          key: "insights.trajectory.yearOverYear",
          values: {
            year: String(snap.year),
            direction,
            pct: String(Math.abs(yoyInc)),
            income: fmtAmt(snap.income, locale),
            expNote,
            expPct: String(Math.abs(yoyExp)),
          },
        });
      });

    } else if (spanMonths >= 12) {
      // ── 12-23 MONTHS: full-year with half-year comparison ─────────────────
      if (overallIncChange > 5 && overallExpChange <= overallIncChange) {
        trajectoryInsight = {
          key: "insights.trajectory.growthWithExpenseNote",
          values: {
            months: spanMonths, startMonth, endMonth,
            pct: String(overallIncChange),
            fromAmount: fmtAmt(firstPoint.income, locale),
            toAmount: fmtAmt(lastPoint.income, locale),
            expNote: overallExpChange > 0 ? "rose" : "controlled",
            expPct: String(overallExpChange),
          },
        };
      } else if (overallIncChange < -5) {
        trajectoryInsight = {
          key: "insights.trajectory.declineOverPeriod",
          values: {
            months: spanMonths, startMonth, endMonth,
            pct: String(Math.abs(overallIncChange)),
            fromAmount: fmtAmt(firstPoint.income, locale),
            toAmount: fmtAmt(lastPoint.income, locale),
            hasGrowingCat: growingExpCats.length ? "yes" : "no",
            category: growingExpCats.length ? cat(growingExpCats[0].category) : "",
          },
        };
      } else if (overallExpChange > overallIncChange + 5) {
        trajectoryInsight = {
          key: "insights.trajectory.expensesOutpacingIncome",
          values: { startMonth, endMonth, expPct: String(overallExpChange), incPct: String(overallIncChange) },
        };
      } else {
        trajectoryInsight = {
          key: "insights.trajectory.stableAverages",
          values: { months: spanMonths, startMonth, endMonth, avgIncome: fmtAmt(avgMonthlyInc, locale), avgExpenses: fmtAmt(avgMonthlyExp, locale) },
        };
      }

      // Compare first half to second half
      const mid = Math.floor(spanMonths / 2);
      const firstHalf = active.slice(0, mid);
      const secondHalf = active.slice(mid);
      const fhInc = avg(firstHalf.map((h) => h.income));
      const shInc = avg(secondHalf.map((h) => h.income));
      const fhExp = avg(firstHalf.map((h) => h.expenses));
      const shExp = avg(secondHalf.map((h) => h.expenses));
      const halfIncChange = pct(shInc, fhInc);
      const halfExpChange = pct(shExp, fhExp);
      const fhStart = monthYearLabel(firstHalf[0].year, firstHalf[0].monthNum, locale, "short");
      const fhEnd = monthYearLabel(firstHalf[firstHalf.length - 1].year, firstHalf[firstHalf.length - 1].monthNum, locale, "short");
      const shStart = monthYearLabel(secondHalf[0].year, secondHalf[0].monthNum, locale, "short");
      const shEnd = monthYearLabel(secondHalf[secondHalf.length - 1].year, secondHalf[secondHalf.length - 1].monthNum, locale, "short");

      trajectoryDetails.push({
        key: "insights.trajectory.firstHalf",
        values: { startMonth: fhStart, endMonth: fhEnd, avgIncome: fmtAmt(fhInc, locale), avgExpenses: fmtAmt(fhExp, locale) },
      });
      trajectoryDetails.push({
        key: "insights.trajectory.secondHalf",
        values: {
          startMonth: shStart, endMonth: shEnd,
          avgIncome: fmtAmt(shInc, locale),
          incSign: halfIncChange >= 0 ? "pos" : "neg",
          incChange: String(Math.abs(halfIncChange)),
          avgExpenses: fmtAmt(shExp, locale),
          expNote: halfExpChange > 5 ? "higher" : "none",
          expChange: String(halfExpChange),
        },
      });

    } else {
      // ── 3-11 MONTHS: full window from first to last ───────────────────────
      if (overallIncChange > 5 && overallExpChange <= 5) {
        trajectoryInsight = {
          key: "insights.trajectory.growthControlled",
          values: { pct: String(overallIncChange), fromAmount: fmtAmt(firstPoint.income, locale), startMonth, toAmount: fmtAmt(lastPoint.income, locale), endMonth },
        };
      } else if (overallIncChange > 5 && overallExpChange > overallIncChange) {
        trajectoryInsight = {
          key: "insights.trajectory.growthButExpensesFaster",
          values: { incPct: String(overallIncChange), startMonth, endMonth, expPct: String(overallExpChange) },
        };
      } else if (overallIncChange < -5) {
        trajectoryInsight = {
          key: "insights.trajectory.decline",
          values: { pct: String(Math.abs(overallIncChange)), fromAmount: fmtAmt(firstPoint.income, locale), startMonth, toAmount: fmtAmt(lastPoint.income, locale), endMonth },
        };
      } else if (overallExpChange > 10 && growingExpCats.length) {
        trajectoryInsight = {
          key: "insights.trajectory.expensesRoseDrivenBy",
          values: {
            expPct: String(overallExpChange), startMonth, endMonth,
            driverCount: growingExpCats.length === 1 ? "1" : "2",
            cat1: cat(growingExpCats[0].category),
            ...(growingExpCats[1] ? { cat2: cat(growingExpCats[1].category) } : {}),
            avgIncome: fmtAmt(avgMonthlyInc, locale),
          },
        };
      } else {
        trajectoryInsight = {
          key: "insights.trajectory.averagesOverPeriod",
          values: { startMonth, endMonth, avgIncome: fmtAmt(avgMonthlyInc, locale), avgExpenses: fmtAmt(avgMonthlyExp, locale) },
        };
      }

      if (Math.abs(overallIncChange) >= 5) {
        trajectoryDetails.push({
          key: "insights.trajectory.incomeChange",
          values: {
            fromAmount: fmtAmt(firstPoint.income, locale), startMonth, toAmount: fmtAmt(lastPoint.income, locale), endMonth,
            sign: overallIncChange > 0 ? "pos" : "neg", pct: String(Math.abs(overallIncChange)),
          },
        });
      }
      if (Math.abs(overallExpChange) >= 5) {
        trajectoryDetails.push({
          key: "insights.trajectory.expenseChange",
          values: {
            fromAmount: fmtAmt(firstPoint.expenses, locale), startMonth, toAmount: fmtAmt(lastPoint.expenses, locale), endMonth,
            sign: overallExpChange > 0 ? "pos" : "neg", pct: String(Math.abs(overallExpChange)),
          },
        });
      }
    }

    // For ALL spans ≥ 6 months: recent 3-month momentum vs prior 3 months
    if (spanMonths >= 6) {
      const recent3 = active.slice(-3);
      const prior3 = active.slice(-6, -3);
      const recentAvgInc = avg(recent3.map((h) => h.income));
      const priorAvgInc = avg(prior3.map((h) => h.income));
      const momentum = pct(recentAvgInc, priorAvgInc);
      if (Math.abs(momentum) >= 10) {
        trajectoryDetails.push({
          key: "insights.trajectory.recentMomentum",
          values: {
            recentAvg: fmtAmt(recentAvgInc, locale),
            recentStart: monthYearLabel(recent3[0].year, recent3[0].monthNum, locale, "short"),
            recentEnd: monthYearLabel(recent3[2].year, recent3[2].monthNum, locale, "short"),
            priorAvg: fmtAmt(priorAvgInc, locale),
            priorStart: monthYearLabel(prior3[0].year, prior3[0].monthNum, locale, "short"),
            priorEnd: monthYearLabel(prior3[2].year, prior3[2].monthNum, locale, "short"),
            sign: momentum > 0 ? "pos" : "neg",
            pct: String(Math.abs(momentum)),
          },
        });
      }
    }
  }

  // ── HEALTH STATUS ────────────────────────────────────────────────────────

  let healthStatus: "healthy" | "watch" | "at-risk" = "watch";
  let healthStatusExplanation: Insight | null = null;

  if (active.length >= 3) {
    const totalMo = active.length;
    const posMo = active.filter((h) => h.cashflow >= 0).length;
    const negMo = totalMo - posMo;
    const recentWin = active.slice(-Math.min(6, active.length));
    const recentNegCount = recentWin.filter((h) => h.cashflow < 0).length;
    const rIncDir = trendDir(recentWin.map((h) => h.income));
    const rExpDir = trendDir(recentWin.map((h) => h.expenses));

    if (posMo / totalMo >= 0.7 && recentNegCount <= 1 && rIncDir !== "down") {
      healthStatus = "healthy";
      healthStatusExplanation = rIncDir === "up"
        ? { key: "insights.health.healthyGrowing", values: { posMo, totalMo } }
        : { key: "insights.health.healthyStable", values: { posMo, totalMo } };
    } else if (posMo / totalMo < 0.5 || (rExpDir === "up" && rIncDir === "down") || recentNegCount >= 4) {
      healthStatus = "at-risk";
      healthStatusExplanation = rExpDir === "up" && rIncDir === "down"
        ? { key: "insights.health.atRiskSqueeze" }
        : { key: "insights.health.atRiskNegative", values: { negMo, totalMo } };
    } else {
      healthStatus = "watch";
      healthStatusExplanation = negMo === 0
        ? { key: "insights.health.watchIncomeSlowing", values: { posMo, totalMo } }
        : { key: "insights.health.watchMixed", values: { posMo, totalMo, negMo } };
    }
  }

  // ── BUSINESS TREND DIRECTION ──────────────────────────────────────────────

  let businessTrendDirection: "improving" | "stable" | "weakening" = "stable";

  if (active.length >= 6) {
    const mid = Math.floor(active.length / 2);
    const fh = active.slice(0, mid);
    const sh = active.slice(mid);
    const fhInc = avg(fh.map((h) => h.income));
    const shInc = avg(sh.map((h) => h.income));
    const fhExp = avg(fh.map((h) => h.expenses));
    const shExp = avg(sh.map((h) => h.expenses));
    const incCh = pct(shInc, fhInc);
    const expCh = pct(shExp, fhExp);
    if (incCh > 5 && incCh > expCh) businessTrendDirection = "improving";
    else if (expCh > incCh + 5 || incCh < -5) businessTrendDirection = "weakening";
  } else if (yearlySnapshots.length >= 2) {
    const relBase = yearlySnapshots.find((y) => y.monthCount >= 6) ?? yearlySnapshots[0];
    const lastSnap = yearlySnapshots[yearlySnapshots.length - 1];
    const incG = pct(lastSnap.income, relBase.income);
    const expG = pct(lastSnap.expenses, relBase.expenses);
    if (incG > 5 && incG > expG) businessTrendDirection = "improving";
    else if (expG > incG + 5 || incG < -5) businessTrendDirection = "weakening";
  }

  // ── BIGGEST RISK / OPPORTUNITY — declared here, populated below ───────────

  let biggestRisk: Insight | null = null;
  let biggestOpportunity: Insight | null = null;

  // ── FORECAST REASONS & IMPROVEMENTS — exact window ───────────────────────

  const forecastReasons: Insight[] = [];
  const forecastImprovements: Insight[] = [];
  let cashflowDeficitReason: Insight | null = null;

  if (forecast && active.length >= 2) {
    // Forecast uses ALL months with recent weighting — describe the full history
    const totalMonths = active.length;
    const posMonths = active.filter((h) => h.cashflow >= 0).length;
    const negMonths = totalMonths - posMonths;
    const posPct = Math.round((posMonths / totalMonths) * 100);

    // Recent 3-month trend for context
    const recent3 = active.slice(-3);
    const prior3 = active.length >= 6 ? active.slice(-6, -3) : [];
    const recentIncAvg = avg(recent3.map((h) => h.income));
    const incTrendRecent = prior3.length
      ? trendDir([...prior3.map((h) => h.income), ...recent3.map((h) => h.income)])
      : "stable";
    const expTrendRecent = prior3.length
      ? trendDir([...prior3.map((h) => h.expenses), ...recent3.map((h) => h.expenses)])
      : "stable";

    // reasons[0] — basis line (header subtext in UI)
    forecastReasons.push({ key: "insights.forecast.basis", values: { months: totalMonths } });

    // reasons[1] — cashflow health stat (rendered as a visual badge in UI)
    forecastReasons.push(
      posPct >= 75
        ? { key: "insights.forecast.cashflowPositiveHigh", values: { posMonths, totalMonths } }
        : posPct >= 50
        ? { key: "insights.forecast.cashflowPositiveMedium", values: { posMonths, totalMonths } }
        : { key: "insights.forecast.cashflowNegative", values: { negMonths, totalMonths } }
    );

    // reasons[2] — income trend (rendered as a single plain line in UI)
    forecastReasons.push(
      incTrendRecent === "up"
        ? { key: "insights.forecast.incomeTrendingUp", values: { amount: fmtAmt(recentIncAvg, locale) } }
        : incTrendRecent === "down"
        ? businessTrendDirection === "improving"
          // A recent 3-month dip doesn't contradict an "Improving" overall
          // trend — frame it as a short-term pullback, not a standalone decline.
          ? { key: "insights.forecast.incomeDipWithinGrowth", values: { amount: fmtAmt(recentIncAvg, locale) } }
          : { key: "insights.forecast.incomeDeclining", values: { amount: fmtAmt(recentIncAvg, locale) } }
        : { key: "insights.forecast.incomeStable", values: { amount: fmtAmt(recentIncAvg, locale) } }
    );

    // reasons[3] — expense pressure (optional, rendered as a separate line in UI)
    if (expTrendRecent === "up") {
      const growingCats = categories.filter((c) => c.yearOverYearTrend === "growing").slice(0, 1);
      forecastReasons.push(
        growingCats.length
          ? { key: "insights.forecast.expensesRisingLed", values: { category: cat(growingCats[0].category) } }
          : { key: "insights.forecast.expensesRisingGeneral" }
      );
    }

    // ── Why cashflow is negative ───────────────────────────────────────────

    if (forecast.projectedCashflow < 0) {
      const recentExpAvg = avg(recent3.map((h) => h.expenses));

      // Top categories by actual spending this month, then by recent average
      const topCurrentCats = categories
        .filter((c) => c.currentMonthTotal > 0)
        .sort((a, b) => b.currentMonthTotal - a.currentMonthTotal)
        .slice(0, 2);

      const topCat = topCurrentCats[0] ?? null;
      const incDown = incTrendRecent === "down";
      const expUp = expTrendRecent === "up";

      const topCatPct = topCat && recentExpAvg > 0
        ? Math.round((topCat.currentMonthTotal / recentExpAvg) * 100)
        : 0;
      const isGrowing = topCat?.yearOverYearTrend === "growing";

      if (incDown && expUp) {
        cashflowDeficitReason = topCat
          ? { key: "insights.forecast.deficitBothTrends", values: { recentIncome: fmtAmt(recentIncAvg, locale), category: cat(topCat.category), amount: fmtAmt(topCat.currentMonthTotal, locale), pct: String(topCatPct) } }
          : { key: "insights.forecast.deficitBothTrendsGeneral" };
      } else if (incDown) {
        cashflowDeficitReason = { key: "insights.forecast.deficitIncomeProblem", values: { recentIncome: fmtAmt(recentIncAvg, locale), recentExpenses: fmtAmt(recentExpAvg, locale) } };
      } else if (expUp && topCat) {
        cashflowDeficitReason = { key: "insights.forecast.deficitExpenseDriven", values: { category: cat(topCat.category), amount: fmtAmt(topCat.currentMonthTotal, locale), pct: String(topCatPct), growing: isGrowing ? "yes" : "no", recentIncome: fmtAmt(recentIncAvg, locale) } };
      } else if (topCat) {
        cashflowDeficitReason = { key: "insights.forecast.deficitExpensesExceedIncome", values: { recentExpenses: fmtAmt(recentExpAvg, locale), recentIncome: fmtAmt(recentIncAvg, locale), category: cat(topCat.category), amount: fmtAmt(topCat.currentMonthTotal, locale), pct: String(topCatPct), growing: isGrowing ? "yes" : "no" } };
      } else {
        cashflowDeficitReason = { key: "insights.forecast.deficitGeneral", values: { recentExpenses: fmtAmt(recentExpAvg, locale), recentIncome: fmtAmt(recentIncAvg, locale) } };
      }
    }

    // Cashflow margin — gates the cost-cutting suggestion below and drives
    // the marginLow/marginHealthy message.
    const cashflowMargin = forecast.projectedIncome > 0
      ? Math.round((forecast.projectedCashflow / forecast.projectedIncome) * 100)
      : 0;

    // Quantified improvements
    const subCat = categories.find((c) => c.category === "subscriptions" || c.category === "software");
    // Only suggest cutting discretionary tooling costs when margin isn't
    // already healthy — "cut your subscriptions" reads as generic noise when
    // cashflow is comfortable, and the reduction amount should scale with
    // actual spend rather than a flat figure.
    if (subCat && subCat.currentMonthTotal > 50 && cashflowMargin < 30) {
      const reduction = Math.round(subCat.currentMonthTotal * 0.3);
      forecastImprovements.push({
        key: "insights.forecast.reduceSubscriptions",
        values: { category: cat(subCat.category), reduction: fmtAmt(reduction, locale), annual: fmtAmt(reduction * 12, locale) },
      });
    }

    if (forecast.projectedCashflow < 0) {
      const deficit = Math.abs(forecast.projectedCashflow);
      forecastImprovements.push({ key: "insights.forecast.restoreCashflow", values: { amount: fmtAmt(deficit, locale) } });
    }

    if (incTrendRecent !== "up" && yearlySnapshots.length >= 2) {
      const last = yearlySnapshots[yearlySnapshots.length - 1];
      const prev = yearlySnapshots[yearlySnapshots.length - 2];
      const yoy = pct(last.income, prev.income);
      if (yoy < 0) {
        forecastImprovements.push(
          phraseIncomeYoYDrop(incomeType, Math.abs(yoy), prev.year, prev.income, last.year, last.income, locale)
        );
      }
    }

    if (forecast.projectedCashflow >= 0 && forecastImprovements.length < 2) {
      forecastImprovements.push(
        cashflowMargin < 20
          ? { key: "insights.forecast.marginLow", values: { pct: String(cashflowMargin) } }
          : { key: "insights.forecast.marginHealthy", values: { pct: String(cashflowMargin) } }
      );
    }

    // ── BIGGEST OPPORTUNITY ───────────────────────────────────────────────
    const oppSubCat = categories.find(
      (c) => c.category === "subscriptions" || c.category === "software" || c.category === "ai tools"
    );

    if (forecast.projectedCashflow < 0) {
      const deficit = Math.abs(forecast.projectedCashflow);
      biggestOpportunity = { key: "insights.opportunity.restoreCashflow", values: { amount: fmtAmt(deficit, locale), annual: fmtAmt(deficit * 12, locale) } };
    } else if (oppSubCat && oppSubCat.currentMonthTotal > 100) {
      biggestOpportunity = { key: "insights.opportunity.reviewSubscriptions", values: { category: cat(oppSubCat.category), monthly: fmtAmt(oppSubCat.currentMonthTotal, locale), annual: fmtAmt(oppSubCat.currentMonthTotal * 12, locale) } };
    } else {
      const cashflowMarginOpp = forecast.projectedIncome > 0
        ? Math.round((forecast.projectedCashflow / forecast.projectedIncome) * 100)
        : 0;
      if (cashflowMarginOpp < 15 && forecast.projectedIncome > 0) {
        const surplus = Math.round(forecast.projectedIncome * 0.15 - forecast.projectedCashflow);
        biggestOpportunity = { key: "insights.opportunity.increaseMargin", values: { amount: fmtAmt(surplus, locale), annual: fmtAmt(surplus * 12, locale) } };
      }
      if (!biggestOpportunity) {
        biggestOpportunity = { key: "insights.opportunity.maintainConsistency" };
      }
    }
  }

  // ── HISTORICAL INSIGHTS — ranked and grouped by theme ────────────────────
  // Generated once via the shared builder so the Dashboard and Analytics
  // pages render identical, consistently-categorised insights.

  const rankedInsights = buildHistoricalInsights(history, categories, yearlySnapshots, seasonality, incomeConcentration, locale);
  const seasonalInsights: Insight[] = rankedInsights
    .filter((r) => r.category === "seasonality")
    .map(({ key, values }) => ({ key, values }));

  // ── BIGGEST RISK ──────────────────────────────────────────────────────────
  // Priority order: structural (income+expense squeeze) → growing category →
  // income concentration → income gaps → uncategorised → income decline.

  const riskWin = active.slice(-Math.min(6, active.length));
  const riskIncDir = trendDir(riskWin.map((h) => h.income));
  const riskExpDir = trendDir(riskWin.map((h) => h.expenses));
  const topGrowingRisk = categories
    .filter((c) => c.yearOverYearTrend === "growing" && c.category !== "uncategorized")
    .sort((a, b) => b.totalAllTime - a.totalAllTime)[0];
  const uncatForRisk = categories.find((c) => c.category === "uncategorized");
  const totalExpAllTime = categories.reduce((s, c) => s + c.totalAllTime, 0);
  const uncatPctVal = uncatForRisk && totalExpAllTime > 0
    ? Math.round((uncatForRisk.totalAllTime / totalExpAllTime) * 100) : 0;

  // Recent income gaps — anchored to last data point, not wall-clock today
  const lastOrdinal = lastMonth ? lastMonth.year * 12 + lastMonth.monthNum : 0;
  const recentIncomeGaps = lastMonth ? history.filter((h) => {
    if (h.income !== 0 || h.expenses === 0) return false;
    return h.year * 12 + h.monthNum >= lastOrdinal - 11;
  }) : [];

  if (riskIncDir === "down" && riskExpDir === "up") {
    biggestRisk = { key: "insights.risk.incomeExpenseSqueeze" };
  } else if (topGrowingRisk) {
    const riskRange = categoryYearRange(topGrowingRisk);
    if (riskRange && riskRange.fromAmt > 0) {
      const growth = pct(riskRange.toAmt, riskRange.fromAmt);
      biggestRisk = growth >= 20
        ? { key: "insights.risk.categoryFastestGrowing", values: { category: cat(topGrowingRisk.category), pct: String(growth), fromYear: String(riskRange.from), toYear: String(riskRange.to) } }
        : { key: "insights.risk.categoryTrendingUp", values: { category: cat(topGrowingRisk.category) } };
    } else {
      biggestRisk = { key: "insights.risk.categoryTrendingUpBrief", values: { category: cat(topGrowingRisk.category) } };
    }
  } else if (incomeConcentration?.isHighConcentration) {
    // Client concentration — the most dangerous freelancer-specific structural risk
    biggestRisk = { key: "insights.risk.clientConcentration", values: { pct: String(incomeConcentration.topSourcePct) } };
  } else if (recentIncomeGaps.length >= 1) {
    const avgExp = avg(recentIncomeGaps.map((h) => h.expenses));
    biggestRisk = { key: "insights.risk.incomeGaps", values: { count: recentIncomeGaps.length, amount: fmtAmt(avgExp, locale) } };
  } else if (uncatPctVal > 15) {
    biggestRisk = { key: "insights.risk.uncategorizedSpending", values: { pct: String(uncatPctVal) } };
  } else if (riskIncDir === "down" && businessTrendDirection !== "improving") {
    // Don't flag a recent dip as the "biggest risk" when the broader trend is
    // still positive — that contradicts an "Improving"/"growing" headline.
    biggestRisk = { key: "insights.risk.incomeDeclining", values: { amount: fmtAmt(avg(riskWin.map((h) => h.income)), locale), months: riskWin.length } };
  }

  // ── NOTABLE TRANSACTIONS ─────────────────────────────────────────────────

  const notableTransactions: Insight[] = [];

  if (recentTxs.length > 0) {
    const incomes = recentTxs.filter((t) => t.type === "income");
    const expenses = recentTxs.filter((t) => t.type === "expense");

    if (incomes.length > 0) {
      const largest = incomes.reduce((m, t) => (t.amount > m.amount ? t : m), incomes[0]);
      notableTransactions.push({ key: "insights.notable.largestIncome", values: { description: largest.description, amount: fmtAmt(largest.amount, locale) } });
    }

    if (expenses.length > 0) {
      const largest = expenses.reduce((m, t) => (t.amount > m.amount ? t : m), expenses[0]);
      notableTransactions.push({ key: "insights.notable.largestExpense", values: { description: largest.description, amount: fmtAmt(largest.amount, locale) } });
    }

    const recurring = recentTxs.filter(
      (t) =>
        t.type === "expense" &&
        (t.category === "subscriptions" || t.category === "software" || t.description.toLowerCase().includes("subscription"))
    );
    if (recurring.length > 0) {
      const total = recurring.reduce((s, t) => s + t.amount, 0);
      notableTransactions.push({ key: "insights.notable.recurringCharges", values: { count: recurring.length, amount: fmtAmt(total, locale) } });
    }

    if (avgExpenses > 0) {
      const high = expenses.filter((t) => t.amount > avgExpenses * 0.4 && t.amount > 200);
      if (high.length > 0) {
        notableTransactions.push({ key: "insights.notable.highValueExpense", values: { description: high[0].description, amount: fmtAmt(high[0].amount, locale) } });
      }
    }
  }

  return {
    snapshotSummary,
    snapshotContext,
    comparisonInterpretation,
    trajectoryInsight,
    trajectoryDetails,
    forecastReasons,
    forecastImprovements,
    cashflowDeficitReason,
    healthStatus,
    healthStatusExplanation,
    businessTrendDirection,
    biggestRisk,
    biggestOpportunity,
    seasonalInsights,
    notableTransactions,
  };
}
