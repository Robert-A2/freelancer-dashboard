// Financial Intelligence Engine V2
// Every insight names exact months, years, and amounts — no generic "last 6 months" language.
// What happened · Why it happened · What action improves the outcome.

import type {
  CategoryTrend,
  YearlySnapshot,
  MonthlySeasonality,
  MonthPoint,
} from "./analytics-engine";

export type { CategoryTrend, YearlySnapshot, MonthlySeasonality, MonthPoint };

export interface RecentTx {
  description: string;
  amount: number;
  type: string;
  category: string;
}

export interface DashboardIntelligence {
  snapshotSummary: string;
  snapshotContext: string[];
  comparisonInterpretation: string;
  trajectoryInsight: string;
  trajectoryDetails: string[];
  forecastReasons: string[];
  forecastImprovements: string[];
  cashflowDeficitReason: string | null;
  healthStatus: "healthy" | "watch" | "at-risk";
  healthStatusExplanation: string;
  businessTrendDirection: "improving" | "stable" | "weakening";
  biggestRisk: string | null;
  biggestOpportunity: string | null;
  historicalHighlights: string[];
  seasonalInsights: string[];
  categoryInsights: string[];
  notableTransactions: string[];
}

// ── Formatters ─────────────────────────────────────────────────────────────

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));

const pct = (current: number, base: number): number => {
  if (base === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - base) / Math.abs(base)) * 100);
};

const avg = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// e.g. monthLabel(2024, 3) → "March 2024"
function monthLabel(year: number, month: number, style: "long" | "short" = "long"): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IE", {
    month: style,
    year: "numeric",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Known category display overrides (handles acronyms capitalize() would mangle)
const CATEGORY_DISPLAY: Record<string, string> = {
  "ai tools": "AI tools",
};

// For sentence-start positions — capitalises first letter, preserves acronyms
function displayCat(s: string): string {
  return CATEGORY_DISPLAY[s.toLowerCase()] ?? capitalize(s);
}

// For mid-sentence positions — keeps lowercase except for known acronyms
function inlineCat(s: string): string {
  return CATEGORY_DISPLAY[s.toLowerCase()] ?? s;
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

function categoryYearRange(cat: CategoryTrend) {
  const years = Object.keys(cat.yearlyTotals).map(Number).sort();
  if (years.length < 2) return null;
  return {
    from: years[0],
    to: years[years.length - 1],
    fromAmt: cat.yearlyTotals[years[0]] ?? 0,
    toAmt: cat.yearlyTotals[years[years.length - 1]] ?? 0,
  };
}

// ── Seasonal helpers ───────────────────────────────────────────────────────

const QUARTERS = [
  { label: "Q1 (January – March)", months: [1, 2, 3] },
  { label: "Q2 (April – June)", months: [4, 5, 6] },
  { label: "Q3 (July – September)", months: [7, 8, 9] },
  { label: "Q4 (October – December)", months: [10, 11, 12] },
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
// These functions return the right phrase depending on income type,
// so a salaried user never sees "client payments" or "pipeline" language.

function phraseIncomeAboveAvg(it: IncomeType, currentInc: number, avgInc: number, diff: number, months: number): string {
  const base = `Income (${eur(currentInc)}) is ${diff}% above your ${months}-month average of ${eur(avgInc)}`;
  if (it === "salary") return `${base}, higher than your usual monthly amount.`;
  return `${base}, likely reflecting higher client payments than your typical month.`;
}

function phraseIncomeBelowAvg(it: IncomeType, currentInc: number, avgInc: number, diff: number, months: number): string {
  const base = `Income (${eur(currentInc)}) is ${Math.abs(diff)}% below your ${months}-month average of ${eur(avgInc)}`;
  if (it === "salary") return `${base}, lower than your usual monthly amount.`;
  return `${base}. Fewer or lower-value client payments this month.`;
}

function phraseIncomeDecline(it: IncomeType, pctDrop: number): string {
  if (it === "salary") return `Income declined ${pctDrop}% compared to last month.`;
  if (it === "mixed")  return `Income declined ${pctDrop}% compared to last month. Review both your employment income and client payments.`;
  return `Income declined ${pctDrop}% compared to last month. Fewer client payments received. Monitor your pipeline.`;
}

function phraseIncomeYoYDrop(it: IncomeType, dropPct: number, prevYear: number, prevAmt: number, lastYear: number, lastAmt: number): string {
  const base = `Income fell ${dropPct}% from ${prevYear} (${eur(prevAmt)}) to ${lastYear} (${eur(lastAmt)}).`;
  if (it === "salary") return `${base} Review whether this reflects a pay change or a gap period.`;
  if (it === "mixed")  return `${base} Consider growing your freelance income or reviewing employment terms.`;
  return `${base} Additional client revenue may be required to restore historical cashflow levels.`;
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
  incomeConcentration?: { topSourceDesc: string | null; topSourcePct: number; totalSources: number; isHighConcentration: boolean }
): DashboardIntelligence {
  // Defensive: guard against undefined inputs that can arrive at runtime
  const categories: CategoryTrend[] = _categories ?? [];
  const yearlySnapshots: YearlySnapshot[] = _yearlySnapshots ?? [];
  const seasonality: MonthlySeasonality[] = _seasonality ?? [];

  const empty: DashboardIntelligence = {
    snapshotSummary: "Upload a CSV to see your financial picture.",
    snapshotContext: [],
    comparisonInterpretation: "",
    trajectoryInsight: "",
    trajectoryDetails: [],
    forecastReasons: [],
    forecastImprovements: [],
    cashflowDeficitReason: null,
    healthStatus: "watch",
    healthStatusExplanation: "",
    businessTrendDirection: "stable",
    biggestRisk: null,
    biggestOpportunity: null,
    historicalHighlights: [],
    seasonalInsights: [],
    categoryInsights: [],
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

  const dataFrom = firstMonth ? monthLabel(firstMonth.year, firstMonth.monthNum) : null;
  const dataTo = lastMonth ? monthLabel(lastMonth.year, lastMonth.monthNum) : null;

  // ── SNAPSHOT SUMMARY ────────────────────────────────────────────────────

  const biggestExpIncrease = topChangedCategories(categories, "up", 1)[0];
  const biggestExpDecrease = topChangedCategories(categories, "down", 1)[0];

  const incUp = changes && changes.income > 2;
  const expDown = changes && changes.expenses < -2;
  const incDown = changes && changes.income < -5;
  const expUp = changes && changes.expenses > 5;
  const cashflowOk = (current.totalIncome - current.totalExpenses) >= 0;

  let snapshotSummary: string;

  if (!previous) {
    snapshotSummary = cashflowOk
      ? "First data imported. Cashflow is positive."
      : "First data imported. Expenses are exceeding income.";
  } else if (incUp && expDown) {
    snapshotSummary = "Excellent month. Income grew while expenses fell.";
  } else if (incUp && expUp) {
    snapshotSummary = biggestExpIncrease
      ? `Income increased but expenses also rose, primarily due to ${inlineCat(biggestExpIncrease.category)} costs (${eur(biggestExpIncrease.changeAmount)} more than last month).`
      : "Income grew this month, but rising expenses offset the gain.";
  } else if (incDown && expUp) {
    snapshotSummary = biggestExpIncrease
      ? `Difficult month. Income fell while ${inlineCat(biggestExpIncrease.category)} spending rose by ${eur(biggestExpIncrease.changeAmount)} compared to last month.`
      : "Difficult month. Income fell and expenses rose simultaneously.";
  } else if (!cashflowOk) {
    snapshotSummary = biggestExpIncrease
      ? `Expenses exceeded income this month, primarily due to ${inlineCat(biggestExpIncrease.category)} costs.`
      : "Expenses exceeded income this month. Cashflow is negative.";
  } else if (expUp && biggestExpIncrease) {
    snapshotSummary = `Expenses increased this month, led by ${inlineCat(biggestExpIncrease.category)} (${eur(biggestExpIncrease.changeAmount)} above last month). Cashflow remains positive.`;
  } else if (expDown && biggestExpDecrease) {
    snapshotSummary = `Good cost control. ${inlineCat(biggestExpDecrease.category)} spending fell ${eur(Math.abs(biggestExpDecrease.changeAmount))} compared to last month.`;
  } else {
    snapshotSummary = "Stable month. Finances are holding steady.";
  }

  // ── SNAPSHOT CONTEXT ────────────────────────────────────────────────────

  const snapshotContext: string[] = [];

  if (dataFrom && dataTo && active.length > 1) {
    snapshotContext.push(
      `Analysis covers ${active.length} months of data from ${dataFrom} to ${dataTo}.`
    );
  }

  if (avgIncome > 0) {
    const diff = pct(current.totalIncome, avgIncome);
    if (diff > 5) {
      snapshotContext.push(
        phraseIncomeAboveAvg(incomeType, current.totalIncome, avgIncome, diff, active.length)
      );
    } else if (diff < -5) {
      snapshotContext.push(
        phraseIncomeBelowAvg(incomeType, current.totalIncome, avgIncome, diff, active.length)
      );
    } else {
      snapshotContext.push(
        `Income is in line with your ${active.length}-month average of ${eur(avgIncome)}.`
      );
    }
  }

  if (avgExpenses > 0) {
    const diff = pct(current.totalExpenses, avgExpenses);
    const topCat = categories[0];
    if (diff > 10 && topCat) {
      snapshotContext.push(
        `Expenses (${eur(current.totalExpenses)}) are ${diff}% above your historical average. ${displayCat(topCat.category)} is your largest expense category at ${eur(topCat.currentMonthTotal)} this month.`
      );
    } else if (diff < -10) {
      snapshotContext.push(
        `Expenses (${eur(current.totalExpenses)}) are ${Math.abs(diff)}% below your historical average of ${eur(avgExpenses)}. Good cost control this month.`
      );
    }
  }

  // ── COMPARISON INTERPRETATION ────────────────────────────────────────────

  let comparisonInterpretation = "";

  if (changes && previous) {
    const { income: ic, expenses: ec } = changes;
    const driversUp = topChangedCategories(categories, "up", 2);
    const driversDown = topChangedCategories(categories, "down", 2);

    const driverText = (cats: CategoryTrend[]) =>
      cats.map((c) => `${inlineCat(c.category)} (${eur(c.changeAmount)} more)`).join(" and ");

    const driverTextDown = (cats: CategoryTrend[]) =>
      cats.map((c) => `${inlineCat(c.category)} (${eur(Math.abs(c.changeAmount))} less)`).join(" and ");

    if (ic > 5 && ec < 0) {
      comparisonInterpretation = driversDown.length
        ? `Income grew and expenses fell. Strongest monthly outcome. Cost reductions in ${driverTextDown(driversDown)}.`
        : "Income grew and expenses fell. Your best possible monthly result.";
    } else if (ic > 5 && ec > 5) {
      comparisonInterpretation = driversUp.length
        ? (ic > ec
          ? `Income grew faster than expenses (+${ic}% vs +${ec}%). Cashflow improved. Expense increase driven by ${driverText(driversUp)}.`
          : `Expenses grew faster than income (+${ec}% vs +${ic}%). Cashflow tightened, driven by ${driverText(driversUp)}.`)
        : (ic > ec
          ? `Income growth (+${ic}%) outpaced expense growth (+${ec}%). Cashflow improved.`
          : `Expenses (+${ec}%) grew faster than income (+${ic}%). Cashflow under pressure.`);
    } else if (ic < -5 && ec > 5) {
      comparisonInterpretation = driversUp.length
        ? `Income fell ${Math.abs(ic)}% while expenses rose ${ec}%, driven by ${driverText(driversUp)}. Cashflow deteriorated significantly.`
        : `Income fell while expenses rose. Cashflow deteriorated this month.`;
    } else if (ic < -5) {
      comparisonInterpretation = phraseIncomeDecline(incomeType, Math.abs(ic));
    } else if (ec > 10 && driversUp.length) {
      comparisonInterpretation = `Expenses jumped ${ec}% this month, primarily due to ${driverText(driversUp)}.`;
    } else if (changes.cashflow > 10) {
      comparisonInterpretation = "Cashflow improved meaningfully . Spending discipline or higher income compared to last month.";
    } else {
      comparisonInterpretation = "Finances were broadly stable compared to last month.";
    }
  }

  // ── TRAJECTORY — analyses the COMPLETE uploaded history, not a fixed window ─

  let trajectoryInsight = "";
  const trajectoryDetails: string[] = [];

  const spanMonths = active.length;
  const firstPoint = active[0];
  const lastPoint = active[active.length - 1];
  const growingExpCats = categories.filter((c) => c.yearOverYearTrend === "growing").slice(0, 2);

  if (spanMonths < 3) {
    trajectoryInsight = "More data needed for trend analysis . Keep uploading monthly statements.";
  } else {
    const startLabel = monthLabel(firstPoint.year, firstPoint.monthNum, "short");
    const endLabel = monthLabel(lastPoint.year, lastPoint.monthNum, "short");
    const overallIncChange = pct(lastPoint.income, firstPoint.income);
    const overallExpChange = pct(lastPoint.expenses, firstPoint.expenses);
    const avgMonthlyInc = avg(active.map((h) => h.income));
    const avgMonthlyExp = avg(active.map((h) => h.expenses));

    if (spanMonths >= 24 && yearlySnapshots.length >= 2) {
      // ── MULTI-YEAR: show year-by-year journey ─────────────────────────────
      const lastYear = yearlySnapshots[yearlySnapshots.length - 1];

      // Use first year with ≥6 months as the reliable base for % comparisons.
      // A partial first year (e.g. only Dec 2023) produces absurd growth figures.
      const reliableBase = yearlySnapshots.find((y) => y.monthCount >= 6) ?? yearlySnapshots[0];
      const yearSpan = lastYear.year - reliableBase.year;
      const totalIncGrowth = pct(lastYear.income, reliableBase.income);

      if (totalIncGrowth > 10) {
        trajectoryInsight = `Income grew ${totalIncGrowth}% over ${yearSpan} year${yearSpan !== 1 ? "s" : ""}, from ${eur(reliableBase.income)}/year in ${reliableBase.year} to ${eur(lastYear.income)}/year in ${lastYear.year}.`;
      } else if (totalIncGrowth < -10) {
        trajectoryInsight = `Income declined ${Math.abs(totalIncGrowth)}% over ${yearSpan} year${yearSpan !== 1 ? "s" : ""}, from ${eur(reliableBase.income)}/year in ${reliableBase.year} to ${eur(lastYear.income)}/year in ${lastYear.year}.`;
      } else {
        trajectoryInsight = `Income has been broadly stable over ${yearSpan} years (${reliableBase.year}–${lastYear.year}), averaging ${eur(avgMonthlyInc)}/month.`;
      }

      // Year-by-year breakdown
      yearlySnapshots.forEach((snap, i) => {
        if (i === 0) return;
        const prev = yearlySnapshots[i - 1];

        // Partial previous year makes percentages meaningless — just state the totals
        if (prev.monthCount < 6) {
          trajectoryDetails.push(
            `${snap.year}: income ${eur(snap.income)}, expenses ${eur(snap.expenses)}.`
          );
          return;
        }

        const yoyInc = pct(snap.income, prev.income);
        const yoyExp = pct(snap.expenses, prev.expenses);
        const direction =
          yoyInc > 5 ? `↑ ${yoyInc}%` : yoyInc < -5 ? `↓ ${Math.abs(yoyInc)}%` : "→ stable";
        const expNote =
          yoyExp > yoyInc + 5 && yoyExp <= 1000
            ? ` (expenses grew faster at +${yoyExp}%)`
            : yoyExp < -5
            ? ` (expenses fell ${Math.abs(yoyExp)}%)`
            : "";
        trajectoryDetails.push(
          `${snap.year}: income ${direction} to ${eur(snap.income)}${expNote}.`
        );
      });

    } else if (spanMonths >= 12) {
      // ── 12-23 MONTHS: full-year with half-year comparison ─────────────────
      if (overallIncChange > 5 && overallExpChange <= overallIncChange) {
        trajectoryInsight = `Over ${spanMonths} months (${startLabel} → ${endLabel}), income grew ${overallIncChange}%, from ${eur(firstPoint.income)} to ${eur(lastPoint.income)}.${overallExpChange > 0 ? ` Expenses also rose ${overallExpChange}%.` : " Expenses stayed controlled."}`;
      } else if (overallIncChange < -5) {
        trajectoryInsight = `Over ${spanMonths} months (${startLabel} → ${endLabel}), income declined ${Math.abs(overallIncChange)}%, from ${eur(firstPoint.income)} to ${eur(lastPoint.income)}.${growingExpCats.length ? ` ${displayCat(growingExpCats[0].category)} costs continued growing.` : ""}`;
      } else if (overallExpChange > overallIncChange + 5) {
        trajectoryInsight = `From ${startLabel} to ${endLabel}, expenses grew ${overallExpChange}% while income grew only ${overallIncChange}%. Cashflow margin is narrowing over time.`;
      } else {
        trajectoryInsight = `Over ${spanMonths} months (${startLabel} → ${endLabel}), income averaged ${eur(avgMonthlyInc)}/month and expenses averaged ${eur(avgMonthlyExp)}/month.`;
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
      const fhStart = monthLabel(firstHalf[0].year, firstHalf[0].monthNum, "short");
      const fhEnd = monthLabel(firstHalf[firstHalf.length - 1].year, firstHalf[firstHalf.length - 1].monthNum, "short");
      const shStart = monthLabel(secondHalf[0].year, secondHalf[0].monthNum, "short");
      const shEnd = monthLabel(secondHalf[secondHalf.length - 1].year, secondHalf[secondHalf.length - 1].monthNum, "short");

      trajectoryDetails.push(
        `${fhStart}–${fhEnd}: avg income ${eur(fhInc)}/month, expenses ${eur(fhExp)}/month.`
      );
      trajectoryDetails.push(
        `${shStart}–${shEnd}: avg income ${eur(shInc)}/month ${halfIncChange >= 0 ? `(+${halfIncChange}%)` : `(${halfIncChange}%)`}, expenses ${eur(shExp)}/month${halfExpChange > 5 ? ` (+${halfExpChange}%)` : ""}.`
      );

    } else {
      // ── 3-11 MONTHS: full window from first to last ───────────────────────
      if (overallIncChange > 5 && overallExpChange <= 5) {
        trajectoryInsight = `Income grew ${overallIncChange}% from ${eur(firstPoint.income)} in ${startLabel} to ${eur(lastPoint.income)} in ${endLabel}. Expenses remained under control.`;
      } else if (overallIncChange > 5 && overallExpChange > overallIncChange) {
        trajectoryInsight = `Income grew ${overallIncChange}% from ${startLabel} to ${endLabel}, but expenses grew faster at ${overallExpChange}%. Cashflow margin narrowing.`;
      } else if (overallIncChange < -5) {
        trajectoryInsight = `Income fell ${Math.abs(overallIncChange)}% from ${eur(firstPoint.income)} in ${startLabel} to ${eur(lastPoint.income)} in ${endLabel}.`;
      } else if (overallExpChange > 10 && growingExpCats.length) {
        trajectoryInsight = `Expenses rose ${overallExpChange}% from ${startLabel} to ${endLabel}, driven by ${growingExpCats.map((c) => inlineCat(c.category)).join(" and ")}. Income held at ${eur(avgMonthlyInc)}/month.`;
      } else {
        trajectoryInsight = `From ${startLabel} to ${endLabel}: income averaged ${eur(avgMonthlyInc)}/month, expenses ${eur(avgMonthlyExp)}/month.`;
      }

      if (Math.abs(overallIncChange) >= 5) {
        trajectoryDetails.push(`Income: ${eur(firstPoint.income)} in ${startLabel} → ${eur(lastPoint.income)} in ${endLabel} (${overallIncChange > 0 ? "+" : ""}${overallIncChange}%).`);
      }
      if (Math.abs(overallExpChange) >= 5) {
        trajectoryDetails.push(`Expenses: ${eur(firstPoint.expenses)} in ${startLabel} → ${eur(lastPoint.expenses)} in ${endLabel} (${overallExpChange > 0 ? "+" : ""}${overallExpChange}%).`);
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
        const r3s = monthLabel(recent3[0].year, recent3[0].monthNum, "short");
        const r3e = monthLabel(recent3[2].year, recent3[2].monthNum, "short");
        const p3s = monthLabel(prior3[0].year, prior3[0].monthNum, "short");
        const p3e = monthLabel(prior3[2].year, prior3[2].monthNum, "short");
        trajectoryDetails.push(
          `Recent momentum: income averaged ${eur(recentAvgInc)}/month in ${r3s}–${r3e} vs ${eur(priorAvgInc)}/month in ${p3s}–${p3e} (${momentum > 0 ? "+" : ""}${momentum}%).`
        );
      }
    }
  }

  // ── HEALTH STATUS ────────────────────────────────────────────────────────

  let healthStatus: "healthy" | "watch" | "at-risk" = "watch";
  let healthStatusExplanation = "";

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
      healthStatusExplanation =
        rIncDir === "up"
          ? `Cashflow positive in ${posMo} of ${totalMo} months, with income growing recently.`
          : `Cashflow positive in ${posMo} of ${totalMo} months. Your finances are stable.`;
    } else if (posMo / totalMo < 0.5 || (rExpDir === "up" && rIncDir === "down") || recentNegCount >= 4) {
      healthStatus = "at-risk";
      healthStatusExplanation =
        rExpDir === "up" && rIncDir === "down"
          ? `Income is declining while expenses are rising . Cashflow is under significant pressure.`
          : `Your cashflow was negative in ${negMo} of the last ${totalMo} months, meaning expenses exceeded income in more than half of your recorded months.`;
    } else {
      healthStatus = "watch";
      healthStatusExplanation = `Cashflow mixed. Positive in ${posMo} of ${totalMo} months, negative in ${negMo}. Monitor spending and income closely.`;
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

  let biggestRisk: string | null = null;
  let biggestOpportunity: string | null = null;

  // ── FORECAST REASONS & IMPROVEMENTS — exact window ───────────────────────

  const forecastReasons: string[] = [];
  const forecastImprovements: string[] = [];
  let cashflowDeficitReason: string | null = null;

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

    // reasons[0] — basis line (short, used as header subtext in UI)
    forecastReasons.push(
      `Based on ${totalMonths} months of history. Recent months influence the forecast more than older data.`
    );

    // reasons[1] — cashflow health stat (rendered as a visual badge in UI)
    forecastReasons.push(
      posPct >= 75
        ? `Cashflow positive in ${posMonths} of ${totalMonths} months.`
        : posPct >= 50
        ? `Cashflow positive in ${posMonths} of ${totalMonths} months. Recent trend matters most.`
        : `Cashflow was negative in ${negMonths} of ${totalMonths} months.`
    );

    // reasons[2] — income trend (short, rendered as a single plain line in UI)
    if (incTrendRecent === "up") {
      forecastReasons.push(`Income trending up, avg ${eur(recentIncAvg)}/month recently.`);
    } else if (incTrendRecent === "down") {
      forecastReasons.push(`Income declining, avg ${eur(recentIncAvg)}/month recently.`);
    } else {
      forecastReasons.push(`Income stable at ${eur(recentIncAvg)}/month recently.`);
    }

    // reasons[3] — expense pressure (optional, appended to reasons[2] line in UI)
    if (expTrendRecent === "up") {
      const growingCats = categories.filter((c) => c.yearOverYearTrend === "growing").slice(0, 1);
      forecastReasons.push(
        growingCats.length
          ? `Expenses rising, led by ${inlineCat(growingCats[0].category)}.`
          : `Expenses trending up recently.`
      );
    }

    // ── Why cashflow is negative ───────────────────────────────────────────

    if (forecast.projectedIncome - forecast.projectedExpenses < 0) {
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
      const growingNote = isGrowing ? ` This has been growing year-on-year.` : "";

      if (incDown && expUp) {
        cashflowDeficitReason = topCat
          ? `Income is declining (${eur(recentIncAvg)}/month recently) while ${inlineCat(topCat.category)} costs are rising. ${eur(topCat.currentMonthTotal)}/month (${topCatPct}% of spending). Both trends are compounding the deficit.`
          : `Income is declining while expenses are rising simultaneously. Both trends are compounding the deficit.`;
      } else if (incDown) {
        cashflowDeficitReason = `The deficit is primarily an income problem. Revenue has been declining and is now averaging ${eur(recentIncAvg)}/month, no longer covering expenses of ${eur(recentExpAvg)}/month.`;
      } else if (expUp && topCat) {
        cashflowDeficitReason = `The deficit is driven by rising expenses. ${displayCat(topCat.category)} is the largest cost at ${eur(topCat.currentMonthTotal)}/month (${topCatPct}% of spending).${growingNote} Income is stable at ${eur(recentIncAvg)}/month.`;
      } else if (topCat) {
        cashflowDeficitReason = `Expenses (${eur(recentExpAvg)}/month) are consistently exceeding income (${eur(recentIncAvg)}/month). ${displayCat(topCat.category)} is the largest expense at ${eur(topCat.currentMonthTotal)}/month (${topCatPct}% of spending).${growingNote}`;
      } else {
        cashflowDeficitReason = `Expenses (${eur(recentExpAvg)}/month) are consistently exceeding income (${eur(recentIncAvg)}/month).`;
      }
    }

    // Quantified improvements
    const subCat = categories.find((c) => c.category === "subscriptions" || c.category === "software");
    if (subCat && subCat.currentMonthTotal > 50) {
      const reduction = 50;
      forecastImprovements.push(
        `Reducing ${inlineCat(subCat.category)} spending by ${eur(reduction)}/month would improve annual cashflow by ${eur(reduction * 12)}.`
      );
    }

    if (forecast.projectedIncome - forecast.projectedExpenses < 0) {
      const deficit = Math.abs(forecast.projectedIncome - forecast.projectedExpenses);
      forecastImprovements.push(
        `To restore positive cashflow, either reduce expenses by ${eur(deficit)}/month or increase income by the same amount.`
      );
    }

    if (incTrendRecent !== "up" && yearlySnapshots.length >= 2) {
      const last = yearlySnapshots[yearlySnapshots.length - 1];
      const prev = yearlySnapshots[yearlySnapshots.length - 2];
      const yoy = pct(last.income, prev.income);
      if (yoy < 0) {
        forecastImprovements.push(
          phraseIncomeYoYDrop(incomeType, Math.abs(yoy), prev.year, prev.income, last.year, last.income)
        );
      }
    }

    if (forecast.projectedIncome - forecast.projectedExpenses >= 0 && forecastImprovements.length < 2) {
      const cashflowMargin = forecast.projectedIncome > 0
        ? Math.round(((forecast.projectedIncome - forecast.projectedExpenses) / forecast.projectedIncome) * 100)
        : 0;
      if (cashflowMargin < 20) {
        forecastImprovements.push(
          `Cashflow margin is ${cashflowMargin}% of projected income. Reducing variable expenses will strengthen your buffer during slower months.`
        );
      } else {
        forecastImprovements.push(
          `Cashflow margin is ${cashflowMargin}% of projected income — a healthy buffer. Keep fixed costs from growing faster than income.`
        );
      }
    }

    // ── BIGGEST OPPORTUNITY ───────────────────────────────────────────────
    const oppSubCat = categories.find(
      (c) => c.category === "subscriptions" || c.category === "software" || c.category === "ai tools"
    );

    if (forecast.projectedIncome - forecast.projectedExpenses < 0) {
      const deficit = Math.abs(forecast.projectedIncome - forecast.projectedExpenses);
      biggestOpportunity = `Reducing monthly expenses by ${eur(deficit)} would restore positive cashflow, an improvement of ${eur(deficit * 12)} per year.`;
    } else if (oppSubCat && oppSubCat.currentMonthTotal > 100) {
      biggestOpportunity = `Reviewing ${inlineCat(oppSubCat.category)} spending (${eur(oppSubCat.currentMonthTotal)}/month) could free up ${eur(oppSubCat.currentMonthTotal * 12)} annually.`;
    } else {
      const cashflowMarginOpp = forecast.projectedIncome > 0
        ? Math.round(((forecast.projectedIncome - forecast.projectedExpenses) / forecast.projectedIncome) * 100)
        : 0;
      if (cashflowMarginOpp < 15 && forecast.projectedIncome > 0) {
        const surplus = Math.round(forecast.projectedIncome * 0.15 - (forecast.projectedIncome - forecast.projectedExpenses));
        biggestOpportunity = `Reducing monthly expenses by ${eur(surplus)} would lift your cashflow margin to 15%, adding ${eur(surplus * 12)} in annual surplus.`;
      }
      if (!biggestOpportunity) {
        biggestOpportunity = `Maintaining consistent positive cashflow and keeping fixed costs controlled builds long-term financial resilience.`;
      }
    }
  }

  // ── HISTORICAL HIGHLIGHTS — exact years and months ───────────────────────

  const historicalHighlights: string[] = [];

  if (yearlySnapshots.length >= 2) {
    const bestIncYear = yearlySnapshots.reduce((b, y) => (y.income > b.income ? y : b));
    const highExpYear = yearlySnapshots.reduce((b, y) => (y.expenses > b.expenses ? y : b));
    const firstYear = yearlySnapshots[0];
    const lastYear = yearlySnapshots[yearlySnapshots.length - 1];

    historicalHighlights.push(`Best income year: ${bestIncYear.year}, ${eur(bestIncYear.income)} in total income.`);

    if (yearlySnapshots.length >= 3 && firstYear.year !== lastYear.year) {
      // Only use firstYear as a comparison base if it has at least 6 months of data.
      // A partial first year (e.g. only Dec 2023) produces absurd percentages.
      const firstYearIsComplete = firstYear.monthCount >= 6;

      const incGrowth = pct(lastYear.income, firstYear.income);
      if (firstYearIsComplete && Math.abs(incGrowth) >= 10 && Math.abs(incGrowth) <= 1000) {
        historicalHighlights.push(
          `Income ${incGrowth > 0 ? "grew" : "declined"} ${Math.abs(incGrowth)}% from ${firstYear.year} (${eur(firstYear.income)}) to ${lastYear.year} (${eur(lastYear.income)}).`
        );
      }

      // Show highest expense year — only attach a growth % when the base year is reliable
      if (highExpYear.year !== firstYear.year) {
        const expGrowth = pct(highExpYear.expenses, firstYear.expenses);
        const showPct = firstYearIsComplete && expGrowth >= 20 && expGrowth <= 1000;
        historicalHighlights.push(
          showPct
            ? `Highest expense year: ${highExpYear.year} at ${eur(highExpYear.expenses)}. Expenses grew ${expGrowth}% since ${firstYear.year}.`
            : `Highest expense year: ${highExpYear.year}, ${eur(highExpYear.expenses)} in total expenses.`
        );
      }
    }

    // Overall cashflow margin
    const totalInc = yearlySnapshots.reduce((s, y) => s + y.income, 0);
    const totalExp = yearlySnapshots.reduce((s, y) => s + y.expenses, 0);
    if (totalInc > 0) {
      const margin = Math.round(((totalInc - totalExp) / totalInc) * 100);
      historicalHighlights.push(
        `Overall cashflow margin from ${firstYear.year} to ${lastYear.year}: ${margin}% of income${margin >= 20 ? " — strong." : margin >= 10 ? " — healthy." : margin >= 0 ? " — tight. Watch expense growth." : " — negative overall. Expenses exceeded income across this period."}`
      );
    }

    // Cashflow streak with exact dates
    const streak = longestPositiveStreakWithDates(active);
    if (streak) {
      historicalHighlights.push(
        `Longest positive cashflow streak: ${streak.length} consecutive months (${monthLabel(streak.startYear, streak.startMonth, "short")} – ${monthLabel(streak.endYear, streak.endMonth, "short")}).`
      );
    }
  } else if (active.length >= 3 && firstMonth && lastMonth) {
    historicalHighlights.push(
      `Average monthly income from ${monthLabel(firstMonth.year, firstMonth.monthNum, "short")} to ${monthLabel(lastMonth.year, lastMonth.monthNum, "short")}: ${eur(avgIncome)}.`
    );
    historicalHighlights.push(`Average monthly expenses across this period: ${eur(avgExpenses)}.`);
    if (avgIncome > 0 && avgExpenses > 0) {
      const avgCfMargin = Math.round(((avgIncome - avgExpenses) / avgIncome) * 100);
      historicalHighlights.push(
        `Average cashflow margin: ${avgCfMargin}% of income — ${avgCfMargin >= 20 ? "strong." : avgCfMargin >= 10 ? "healthy." : avgCfMargin >= 0 ? "tight." : "negative (expenses exceeded income on average)."}`
      );
    }
  }

  // Best income month from all history
  if (active.length >= 3) {
    const best = active.reduce((b, h) => (h.income > b.income ? h : b));
    if (best.income > 0) {
      historicalHighlights.push(
        `Best income month on record: ${monthLabel(best.year, best.monthNum, "short")} at ${eur(best.income)}.`
      );
    }
  }

  // ── CASHFLOW CONSISTENCY CHECK ────────────────────────────────────────────
  {
    const recentActive6 = active.slice(-6);
    const recentNegCount = recentActive6.filter(h => h.income - h.expenses < 0).length;
    if (recentNegCount >= 3 && active.length >= 6) {
      historicalHighlights.push(
        `Cashflow was negative in ${recentNegCount} of the last 6 months. Building a 2–3 month expense reserve would protect against future income gaps.`
      );
    }

    // Flag if cashflow margin deteriorated year-over-year
    if (yearlySnapshots.length >= 2) {
      const lastY = yearlySnapshots[yearlySnapshots.length - 1];
      const prevY = yearlySnapshots[yearlySnapshots.length - 2];
      const lastMargin = lastY.income > 0 ? (lastY.income - lastY.expenses) / lastY.income : 0;
      const prevMargin = prevY.income > 0 ? (prevY.income - prevY.expenses) / prevY.income : 0;
      if (prevMargin > 0.1 && lastMargin < prevMargin * 0.5) {
        historicalHighlights.push(
          `Cashflow margin fell from ${Math.round(prevMargin * 100)}% in ${prevY.year} to ${Math.round(lastMargin * 100)}% in ${lastY.year}. Expenses are growing faster than income.`
        );
      }
    }
  }

  // ── INCOME GAP DETECTION ──────────────────────────────────────────────────
  // Months where the user had expenses but zero income.
  // These are genuine coverage gaps — the user was spending with no earnings.
  {
    const incomeGaps = history.filter((h) => h.income === 0 && h.expenses > 0);
    if (incomeGaps.length >= 1 && active.length >= 6) {
      const recentGaps = incomeGaps.filter((h) => {
        const d = new Date(h.year, h.monthNum - 1);
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
        return d >= twelveMonthsAgo;
      });
      const totalGaps = incomeGaps.length;
      const avgExpInGap = avg(incomeGaps.map((h) => h.expenses));

      if (recentGaps.length >= 1) {
        historicalHighlights.push(
          `Income gap${totalGaps !== 1 ? "s" : ""} detected: ${totalGaps} month${totalGaps !== 1 ? "s" : ""} with expenses but no income recorded (avg ${eur(avgExpInGap)}/month in gaps). A 2–3 month income reserve would cover future gaps.`
        );
      }
    }
  }

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

  // Recent income gaps (last 12 months)
  const recentIncomeGaps = history.filter((h) => {
    if (h.income !== 0 || h.expenses === 0) return false;
    const d = new Date(h.year, h.monthNum - 1);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    return d >= twelveMonthsAgo;
  });

  if (riskIncDir === "down" && riskExpDir === "up") {
    biggestRisk = "Income is declining while expenses are rising. The gap between them is widening.";
  } else if (topGrowingRisk) {
    const riskRange = categoryYearRange(topGrowingRisk);
    if (riskRange && riskRange.fromAmt > 0) {
      const growth = pct(riskRange.toAmt, riskRange.fromAmt);
      biggestRisk = growth >= 20
        ? `${displayCat(topGrowingRisk.category)} costs grew ${growth}% from ${riskRange.from} to ${riskRange.to} . The fastest growing expense category.`
        : `${displayCat(topGrowingRisk.category)} spending is trending upward year-on-year and may continue to pressure cashflow.`;
    } else {
      biggestRisk = `${displayCat(topGrowingRisk.category)} spending is trending upward year-on-year.`;
    }
  } else if (incomeConcentration?.isHighConcentration) {
    // Client concentration — the most dangerous freelancer-specific structural risk
    biggestRisk = `${incomeConcentration.topSourcePct}% of income over the last 12 months came from a single source. If this source stops, cashflow will be significantly impacted. Diversifying income sources reduces this risk.`;
  } else if (recentIncomeGaps.length >= 1) {
    const avgExp = avg(recentIncomeGaps.map((h) => h.expenses));
    biggestRisk = `${recentIncomeGaps.length} month${recentIncomeGaps.length !== 1 ? "s" : ""} in the last 12 months had expenses but no income (avg ${eur(avgExp)}/month in those months). Building a 2–3 month income reserve would protect against future gaps.`;
  } else if (uncatPctVal > 15) {
    biggestRisk = `${uncatPctVal}% of expenses are uncategorised . Hidden spending patterns may be affecting cashflow without being visible.`;
  } else if (riskIncDir === "down") {
    biggestRisk = `Income has been declining recently, averaging ${eur(avg(riskWin.map((h) => h.income)))}/month over the last ${riskWin.length} months.`;
  }

  // ── SEASONAL INSIGHTS — specific months and quarters ─────────────────────

  const seasonalInsights: string[] = [];

  const activeSeason = seasonality.filter((s) => s.sampleCount >= 2 && s.avgIncome > 0);

  if (activeSeason.length >= 4) {
    const quarterData = QUARTERS.map((q) => ({
      label: q.label,
      ...quarterAvg(seasonality, q.months),
    })).filter((q) => q.income > 0);

    if (quarterData.length >= 2) {
      const peakQ = quarterData.reduce((b, q) => (q.income > b.income ? q : b));
      const lowestQ = quarterData.reduce((b, q) => (q.income < b.income ? q : b));

      if (peakQ.label !== lowestQ.label && pct(peakQ.income, lowestQ.income) > 10) {
        seasonalInsights.push(
          `Income peaks in ${peakQ.label} (averaging ${eur(peakQ.income)}/month historically) and is lowest in ${lowestQ.label} (averaging ${eur(lowestQ.income)}/month).`
        );
      }

      const peakExpQ = quarterData.reduce((b, q) => (q.expenses > b.expenses ? q : b));
      if (peakExpQ.expenses > 0 && pct(peakExpQ.expenses, avg(quarterData.map((q) => q.expenses))) > 15) {
        seasonalInsights.push(
          `Expenses are highest in ${peakExpQ.label} (avg ${eur(peakExpQ.expenses)}/month) . Plan cashflow buffer for this period.`
        );
      }
    }

    // Best and worst income months across history
    const peak = activeSeason.reduce((b, s) => (s.avgIncome > b.avgIncome ? s : b));
    const lowest = activeSeason.reduce((b, s) => (s.avgIncome < b.avgIncome ? s : b));
    if (peak.monthName !== lowest.monthName) {
      seasonalInsights.push(
        `${peak.monthName} is historically your strongest income month (avg ${eur(peak.avgIncome)}); ${lowest.monthName} is typically your weakest (avg ${eur(lowest.avgIncome)}).`
      );
    }
  }

  // ── CATEGORY INSIGHTS — exact years and growth amounts ───────────────────

  const categoryInsights: string[] = [];

  for (const cat of categories.slice(0, 6)) {
    const range = categoryYearRange(cat);
    if (!range) continue;

    const { from, to, fromAmt, toAmt } = range;
    if (from === to) continue;

    const totalGrowth = pct(toAmt, fromAmt);

    if (cat.yearOverYearTrend === "growing" && totalGrowth >= 20) {
      categoryInsights.push(
        `${displayCat(cat.category)} costs grew from ${eur(fromAmt)} in ${from} to ${eur(toAmt)} in ${to} (+${totalGrowth}% over ${to - from} year${to - from !== 1 ? "s" : ""}).`
      );
    } else if (cat.yearOverYearTrend === "declining" && totalGrowth <= -20) {
      categoryInsights.push(
        `${displayCat(cat.category)} costs fell from ${eur(fromAmt)} in ${from} to ${eur(toAmt)} in ${to} (${totalGrowth}% reduction over ${to - from} year${to - from !== 1 ? "s" : ""}).`
      );
    } else if (toAmt > fromAmt * 2) {
      categoryInsights.push(
        `${displayCat(cat.category)} expenses more than doubled from ${eur(fromAmt)} in ${from} to ${eur(toAmt)} in ${to}.`
      );
    }
  }

  // Subscription growth check with exact years
  const subCat = categories.find((c) => c.category === "subscriptions" || c.category === "software");
  if (subCat) {
    const years = Object.keys(subCat.yearlyTotals).map(Number).sort();
    if (years.length >= 3) {
      const growingEveryYear = years.every((y, i) => {
        if (i === 0) return true;
        return (subCat.yearlyTotals[y] ?? 0) >= (subCat.yearlyTotals[years[i - 1]] ?? 0);
      });
      if (growingEveryYear) {
        categoryInsights.push(
          `${displayCat(subCat.category)} costs have increased every year from ${years[0]} (${eur(subCat.yearlyTotals[years[0]] ?? 0)}) to ${years[years.length - 1]} (${eur(subCat.yearlyTotals[years[years.length - 1]] ?? 0)}).`
        );
      }
    }
  }

  // ── NOTABLE TRANSACTIONS ─────────────────────────────────────────────────

  const notableTransactions: string[] = [];

  if (recentTxs.length > 0) {
    const incomes = recentTxs.filter((t) => t.type === "income");
    const expenses = recentTxs.filter((t) => t.type === "expense");

    if (incomes.length > 0) {
      const largest = incomes.reduce((m, t) => (t.amount > m.amount ? t : m), incomes[0]);
      notableTransactions.push(`Largest payment received: ${largest.description} (${eur(largest.amount)}).`);
    }

    if (expenses.length > 0) {
      const largest = expenses.reduce((m, t) => (t.amount > m.amount ? t : m), expenses[0]);
      notableTransactions.push(`Largest expense: ${largest.description} (${eur(largest.amount)}).`);
    }

    const recurring = recentTxs.filter(
      (t) =>
        t.type === "expense" &&
        (t.category === "subscriptions" || t.category === "software" || t.description.toLowerCase().includes("subscription"))
    );
    if (recurring.length > 0) {
      const total = recurring.reduce((s, t) => s + t.amount, 0);
      notableTransactions.push(
        `${recurring.length} recurring charge${recurring.length !== 1 ? "s" : ""} detected, ${eur(total)} in total. Review annually to avoid subscription creep.`
      );
    }

    if (avgExpenses > 0) {
      const high = expenses.filter((t) => t.amount > avgExpenses * 0.4 && t.amount > 200);
      if (high.length > 0) {
        notableTransactions.push(
          `High-value expense flagged: ${high[0].description} (${eur(high[0].amount)}), above typical single-transaction threshold.`
        );
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
    historicalHighlights,
    seasonalInsights,
    categoryInsights,
    notableTransactions,
  };
}
