import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { extractClientName as _extractClientName } from "./client-identity";
export { extractClientName } from "./client-identity";

export async function recalculateMonthlyAnalytics(userId: string): Promise<void> {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    select: { transactionDate: true, amount: true, transactionType: true },
  });

  const byMonth: Record<string, { month: number; year: number; income: number; expenses: number; savings: number }> = {};

  for (const tx of transactions) {
    const d = new Date(tx.transactionDate);
    const month = d.getUTCMonth() + 1;
    const year  = d.getUTCFullYear();
    const key   = `${year}-${month}`;

    if (!byMonth[key]) byMonth[key] = { month, year, income: 0, expenses: 0, savings: 0 };

    const amount = Number(tx.amount);
    if (tx.transactionType === "income")   byMonth[key].income   += amount;
    else if (tx.transactionType === "expense") byMonth[key].expenses += amount;
    else if (tx.transactionType === "savings") byMonth[key].savings  += amount;
  }

  for (const entry of Object.values(byMonth)) {
    // Cashflow = Income − Expenses. This is the SINGLE definition of "cashflow"
    // used everywhere in the app (dashboard cards, charts, risk/health scoring,
    // forecasts, comparisons). Savings are tracked separately (totalSavings) and
    // intentionally excluded — they represent a deliberate allocation, not an
    // operating loss.
    const netCashflow = entry.income - entry.expenses;

    await prisma.monthlyAnalytics.upsert({
      where: { userId_month_year: { userId, month: entry.month, year: entry.year } },
      update: {
        totalIncome:   new Decimal(entry.income),
        totalExpenses: new Decimal(entry.expenses),
        totalSavings:  new Decimal(entry.savings),
        netCashflow:   new Decimal(netCashflow),
        createdAt:     new Date(),
      },
      create: {
        userId,
        month:         entry.month,
        year:          entry.year,
        totalIncome:   new Decimal(entry.income),
        totalExpenses: new Decimal(entry.expenses),
        totalSavings:  new Decimal(entry.savings),
        netCashflow:   new Decimal(netCashflow),
      },
    });
  }

  // Remove analytics rows for months that no longer have any transactions
  // (e.g. after deleting an import) so dashboards/forecasts don't show stale data.
  const existing = await prisma.monthlyAnalytics.findMany({
    where: { userId },
    select: { id: true, month: true, year: true },
  });
  const stale = existing.filter((e) => !byMonth[`${e.year}-${e.month}`]);
  if (stale.length > 0) {
    await prisma.monthlyAnalytics.deleteMany({ where: { id: { in: stale.map((e) => e.id) } } });
  }
}

// ── getDashboardSummary ────────────────────────────────────────────────────────
// Uses the MOST RECENT month with actual data as "current", not the wall-clock
// current month. This prevents the dashboard from showing zeros when a user's
// most recent upload doesn't extend to today.
export async function getDashboardSummary(userId: string) {
  const latestRecord = await prisma.monthlyAnalytics.findFirst({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  if (!latestRecord) {
    const recent = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: "desc" },
      take: 10,
    });
    return { current: null, previous: null, recent };
  }

  const currMonth = latestRecord.month;
  const currYear  = latestRecord.year;
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
  const prevYear  = currMonth === 1 ? currYear - 1 : currYear;

  const [current, previous, recent] = await Promise.all([
    prisma.monthlyAnalytics.findUnique({
      where: { userId_month_year: { userId, month: currMonth, year: currYear } },
    }),
    prisma.monthlyAnalytics.findUnique({
      where: { userId_month_year: { userId, month: prevMonth, year: prevYear } },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { transactionDate: "desc" },
      take: 10,
    }),
  ]);

  return { current, previous, recent };
}

export interface MonthPoint {
  month: string;
  year: number;
  monthNum: number;
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
}

// ── getHistoricalData ──────────────────────────────────────────────────────────
// Builds a monthly timeline from the first data point to the LAST data point
// (not to today). This prevents trailing zero-value months that distort charts
// and mislead the intelligence engine into thinking income collapsed.
export async function getHistoricalData(userId: string, months: number): Promise<MonthPoint[]> {
  const locale = (await getLocale()) as Locale;

  // Find the boundaries of actual data
  const [firstRecord, lastRecord] = await Promise.all([
    prisma.monthlyAnalytics.findFirst({
      where: { userId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
    prisma.monthlyAnalytics.findFirst({
      where: { userId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!firstRecord || !lastRecord) return [];

  // End at the last month with data (never beyond it) — use UTC midnight
  const end = new Date(Date.UTC(lastRecord.year, lastRecord.month - 1, 1));

  // Start: either months ago from end, or the very first data point
  const firstStart = new Date(Date.UTC(firstRecord.year, firstRecord.month - 1, 1));
  const startFromMonthsAgo = months < 999
    ? new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1))
    : firstStart;

  const since = startFromMonthsAgo > firstStart ? startFromMonthsAgo : firstStart;

  const records = await prisma.monthlyAnalytics.findMany({
    where: {
      userId,
      OR: [
        { year: { gt: since.getUTCFullYear() } },
        { year: since.getUTCFullYear(), month: { gte: since.getUTCMonth() + 1 } },
      ],
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  // Build a Map for O(1) lookup instead of O(n) find() inside the loop
  const recordMap = new Map(records.map(r => [`${r.year}-${r.month}`, r]));

  const result: MonthPoint[] = [];
  const cursor = new Date(since);

  while (cursor <= end) {
    const m     = cursor.getUTCMonth() + 1;
    const y     = cursor.getUTCFullYear();
    const label = cursor.toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "2-digit", timeZone: "UTC" });
    const rec   = recordMap.get(`${y}-${m}`);

    result.push({
      month:    label,
      year:     y,
      monthNum: m,
      income:   rec ? Number(rec.totalIncome)   : 0,
      expenses: rec ? Number(rec.totalExpenses) : 0,
      savings:  rec ? Number(rec.totalSavings)  : 0,
      cashflow: rec ? Number(rec.netCashflow)   : 0,
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return result;
}

// ── getMonthlyComparison ───────────────────────────────────────────────────────
// Uses most-recent-data month as "current", not wall-clock month.
// Also returns the actual month labels so the UI displays the right dates.
export async function getMonthlyComparison(userId: string) {
  const locale = (await getLocale()) as Locale;

  const latestRecord = await prisma.monthlyAnalytics.findFirst({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const zero = { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };

  if (!latestRecord) {
    return { current: null, previous: null, changes: null, currLabel: "", prevLabel: "" };
  }

  const currMonth = latestRecord.month;
  const currYear  = latestRecord.year;
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
  const prevYear  = currMonth === 1 ? currYear - 1 : currYear;

  const [current, previous] = await Promise.all([
    prisma.monthlyAnalytics.findUnique({
      where: { userId_month_year: { userId, month: currMonth, year: currYear } },
    }),
    prisma.monthlyAnalytics.findUnique({
      where: { userId_month_year: { userId, month: prevMonth, year: prevYear } },
    }),
  ]);

  const curr = current
    ? { totalIncome: Number(current.totalIncome), totalExpenses: Number(current.totalExpenses), totalSavings: Number(current.totalSavings), netCashflow: Number(current.netCashflow) }
    : zero;

  const prev = previous
    ? { totalIncome: Number(previous.totalIncome), totalExpenses: Number(previous.totalExpenses), totalSavings: Number(previous.totalSavings), netCashflow: Number(previous.netCashflow) }
    : zero;

  function changePct(c: number, p: number): number {
    if (p === 0) return c > 0 ? 100 : 0;
    return Math.round(((c - p) / Math.abs(p)) * 100);
  }

  // Human-readable labels for the actual months being compared (UTC so the
  // integer year/month values are never shifted by the server's local timezone)
  const currLabel = new Date(Date.UTC(currYear, currMonth - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" });
  const prevLabel = new Date(Date.UTC(prevYear, prevMonth - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" });

  return {
    current: curr,
    previous: prev,
    currLabel,
    prevLabel,
    changes: {
      income:   changePct(curr.totalIncome,   prev.totalIncome),
      expenses: changePct(curr.totalExpenses, prev.totalExpenses),
      savings:  changePct(curr.totalSavings,  prev.totalSavings),
      cashflow: changePct(curr.netCashflow,   prev.netCashflow),
    },
  };
}

// ── Category insights ──────────────────────────────────────────────────────────

export interface CategoryTrend {
  category: string;
  totalAllTime: number;
  yearlyTotals: Record<number, number>;
  currentMonthTotal: number;
  previousMonthTotal: number;
  changeAmount: number;
  changePct: number;
  yearOverYearTrend: "growing" | "declining" | "stable";
}

export interface YearlySnapshot {
  year: number;
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
  monthCount: number;
}

export interface MonthlySeasonality {
  monthOfYear: number;
  monthName: string;
  avgIncome: number;
  avgExpenses: number;
  sampleCount: number;
}

export interface CategoryInsights {
  topExpenseCategories: CategoryTrend[];
  yearlySnapshots: YearlySnapshot[];
  seasonality: MonthlySeasonality[];
}

export async function getCategoryInsights(userId: string): Promise<CategoryInsights> {
  const latestRecord = await prisma.monthlyAnalytics.findFirst({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const currMonth = latestRecord?.month ?? (new Date().getMonth() + 1);
  const currYear  = latestRecord?.year  ?? new Date().getFullYear();
  const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
  const prevYear  = currMonth === 1 ? currYear - 1 : currYear;

  const expenses = await prisma.transaction.findMany({
    where: { userId, transactionType: "expense" },
    select: { category: true, amount: true, transactionDate: true },
  });

  const catMap: Record<string, { total: number; yearly: Record<number, number>; currentMonth: number; previousMonth: number }> = {};

  for (const tx of expenses) {
    const amount = Number(tx.amount);
    const d      = new Date(tx.transactionDate);
    const year   = d.getUTCFullYear();
    const month  = d.getUTCMonth() + 1;
    const cat    = tx.category || "uncategorized";

    if (!catMap[cat]) catMap[cat] = { total: 0, yearly: {}, currentMonth: 0, previousMonth: 0 };
    catMap[cat].total += amount;
    catMap[cat].yearly[year] = (catMap[cat].yearly[year] ?? 0) + amount;

    if (year === currYear  && month === currMonth) catMap[cat].currentMonth  += amount;
    if (year === prevYear  && month === prevMonth) catMap[cat].previousMonth += amount;
  }

  const topExpenseCategories: CategoryTrend[] = Object.entries(catMap)
    .filter(([, d]) => d.total > 0)
    .map(([category, data]) => {
      const years = Object.keys(data.yearly).map(Number).sort();
      let yearOverYearTrend: CategoryTrend["yearOverYearTrend"] = "stable";
      if (years.length >= 2) {
        const last = data.yearly[years[years.length - 1]] ?? 0;
        const prev = data.yearly[years[years.length - 2]] ?? 0;
        const pctYoY = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        if (pctYoY > 10)  yearOverYearTrend = "growing";
        else if (pctYoY < -10) yearOverYearTrend = "declining";
      }
      const changeAmount = data.currentMonth - data.previousMonth;
      const changePct = data.previousMonth > 0
        ? Math.round(((data.currentMonth - data.previousMonth) / data.previousMonth) * 100)
        : 0;
      return { category, totalAllTime: data.total, yearlyTotals: data.yearly, currentMonthTotal: data.currentMonth, previousMonthTotal: data.previousMonth, changeAmount, changePct, yearOverYearTrend };
    })
    .sort((a, b) => b.totalAllTime - a.totalAllTime)
    .slice(0, 10);

  const monthly = await prisma.monthlyAnalytics.findMany({
    where: { userId },
    select: { year: true, month: true, totalIncome: true, totalExpenses: true, totalSavings: true, netCashflow: true },
  });

  const yearMap: Record<number, YearlySnapshot> = {};
  for (const r of monthly) {
    if (!yearMap[r.year]) yearMap[r.year] = { year: r.year, income: 0, expenses: 0, savings: 0, cashflow: 0, monthCount: 0 };
    yearMap[r.year].income   += Number(r.totalIncome);
    yearMap[r.year].expenses += Number(r.totalExpenses);
    yearMap[r.year].savings  += Number(r.totalSavings);
    yearMap[r.year].cashflow += Number(r.netCashflow);
    yearMap[r.year].monthCount += 1;
  }
  const yearlySnapshots = Object.values(yearMap).sort((a, b) => a.year - b.year);

  const seasonMapFull: Record<number, { income: number; expenses: number; count: number }> = {};
  for (const r of monthly) {
    if (!seasonMapFull[r.month]) seasonMapFull[r.month] = { income: 0, expenses: 0, count: 0 };
    seasonMapFull[r.month].income   += Number(r.totalIncome);
    seasonMapFull[r.month].expenses += Number(r.totalExpenses);
    seasonMapFull[r.month].count    += 1;
  }

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const seasonality: MonthlySeasonality[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const d = seasonMapFull[m];
    return { monthOfYear: m, monthName: MONTH_NAMES[i], avgIncome: d ? d.income / d.count : 0, avgExpenses: d ? d.expenses / d.count : 0, sampleCount: d?.count ?? 0 };
  });

  return { topExpenseCategories, yearlySnapshots, seasonality };
}

// ── Categorization health ──────────────────────────────────────────────────────

export interface CategorizationHealth {
  totalCount: number;
  categorizedPct: number;
  uncategorizedPct: number;
  uncategorizedCount: number;
  topUncategorizedMerchants: { description: string; count: number }[];
  topCorrectedMerchants: { description: string; count: number }[];
  // Intent understanding health
  needsReviewCount: number;  // transfers flagged as "meaning unclear" — need user clarification
  topNeedsReviewMerchants: { description: string; count: number }[];
}

export async function getCategorizationHealth(userId: string): Promise<CategorizationHealth> {
  const [totalCount, uncategorizedCount, uncategorizedGroups, correctionGroups, needsReviewCount, needsReviewGroups] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId, category: "uncategorized" } }),
    prisma.transaction.groupBy({
      by: ["description"],
      where: { userId, category: "uncategorized" },
      _count: { description: true },
      orderBy: { _count: { description: "desc" } },
      take: 10,
    }),
    prisma.categoryCorrection.groupBy({
      by: ["description"],
      where: { userId },
      _count: { description: true },
      orderBy: { _count: { description: "desc" } },
      take: 10,
    }),
    prisma.transaction.count({ where: { userId, needsReview: true } }),
    prisma.transaction.groupBy({
      by: ["description"],
      where: { userId, needsReview: true },
      _count: { description: true },
      orderBy: { _count: { description: "desc" } },
      take: 10,
    }),
  ]);

  const uncategorizedPct = totalCount > 0 ? (uncategorizedCount / totalCount) * 100 : 0;

  return {
    totalCount,
    categorizedPct:   Math.round((100 - uncategorizedPct) * 10) / 10,
    uncategorizedPct: Math.round(uncategorizedPct * 10) / 10,
    uncategorizedCount,
    topUncategorizedMerchants: uncategorizedGroups.map((g) => ({ description: g.description, count: g._count.description })),
    topCorrectedMerchants:     correctionGroups.map((g) => ({ description: g.description, count: g._count.description })),
    needsReviewCount,
    topNeedsReviewMerchants:   needsReviewGroups.map((g) => ({ description: g.description, count: g._count.description })),
  };
}

// ── Income concentration ───────────────────────────────────────────────────────

export interface IncomeConcentration {
  topSourceDesc: string | null;
  topSourcePct: number;
  totalSources: number;
  isHighConcentration: boolean;
}

export async function getIncomeConcentration(userId: string): Promise<IncomeConcentration> {
  // Anchor to the user's most recent transaction, not to today.
  // A user whose data ends Dec 2024 visiting in 2026 would get zero results
  // if we used `new Date() - 1 year` as the cutoff.
  const latestTx = await prisma.transaction.findFirst({
    where: { userId, transactionType: "income" },
    orderBy: { transactionDate: "desc" },
    select: { transactionDate: true },
  });

  if (!latestTx) return { topSourceDesc: null, topSourcePct: 0, totalSources: 0, isHighConcentration: false };

  const since = new Date(latestTx.transactionDate);
  since.setFullYear(since.getFullYear() - 1);

  const incomeTxs = await prisma.transaction.findMany({
    where: { userId, transactionType: "income", transactionDate: { gte: since } },
    select: { description: true, amount: true },
  });

  if (incomeTxs.length < 3) return { topSourceDesc: null, topSourcePct: 0, totalSources: 0, isHighConcentration: false };

  const total = incomeTxs.reduce((s, t) => s + Number(t.amount), 0);
  if (total === 0) return { topSourceDesc: null, topSourcePct: 0, totalSources: 0, isHighConcentration: false };

  const bySource: Record<string, number> = {};
  for (const tx of incomeTxs) {
    const key = tx.description.slice(0, 35).replace(/\d+/g, "").replace(/[^A-Z a-z]/g, " ").trim().toUpperCase().replace(/\s+/g, " ");
    if (key.length >= 3) bySource[key] = (bySource[key] ?? 0) + Number(tx.amount);
  }

  const sorted = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
  const top    = sorted[0];
  const topPct = top ? Math.round((top[1] / total) * 100) : 0;

  return { topSourceDesc: top?.[0] ?? null, topSourcePct: topPct, totalSources: sorted.length, isHighConcentration: topPct >= 50 && sorted.length <= 4 };
}

// ── Client insights ───────────────────────────────────────────────────────────
// Groups income transactions by normalised client/source name and builds a
// complete picture of revenue concentration, client growth, and activity.

export interface ClientProfile {
  name: string;
  isPaymentProcessor: boolean;   // Stripe, PayPal, Upwork etc.
  totalRevenue: number;
  revenueShare: number;          // % of total income
  paymentCount: number;
  firstPayment: string;          // ISO date string
  lastPayment: string;           // ISO date string
  daysSinceLastPayment: number;
  currentYearRevenue: number;
  previousYearRevenue: number;
  yoyGrowth: number | null;      // % year-over-year change
  isNew: boolean;                // first payment was this calendar year
  isInactive: boolean;           // established client gone quiet (90+ days)
  avgPaymentSize: number;
  monthsActive: number;
}

export interface ClientInsightsData {
  clients: ClientProfile[];
  totalRevenue: number;
  topClientShare: number;
  hasConcentrationRisk: boolean;
  activeClients: number;
  avgClientsPerMonth: number;
  newClientsThisYear: ClientProfile[];
  inactiveClients: ClientProfile[];
  diversification: "concentrated" | "moderate" | "diversified";
}

export async function getClientInsights(userId: string): Promise<ClientInsightsData | null> {
  // Primary: intent-classified income only (most accurate client signal).
  // Fall back to filtered income when the user has fewer than 3 classified transactions.
  let allTxs = await prisma.transaction.findMany({
    where: { userId, intent: { in: ["freelance_income", "salary"] } },
    select: { description: true, amount: true, transactionDate: true, category: true },
    orderBy: { transactionDate: "asc" },
  });

  if (allTxs.length < 3) {
    // Fallback: exclude refunds (reversed purchases, not client income) and
    // amounts below €5 (bank interest, cashback rounding, micro-credits).
    allTxs = await prisma.transaction.findMany({
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

  if (allTxs.length < 3) return null;

  // Anchor all date logic to the user's LAST transaction date, not to today.
  // This ensures "inactive", "new", and "active" are meaningful even when the
  // user's data ends months or years before the current date.
  const lastTxDate = allTxs[allTxs.length - 1].transactionDate ?? new Date();
  const refDate    = new Date(lastTxDate);
  const thisYear   = refDate.getUTCFullYear();
  const prevYear   = thisYear - 1;
  const ninetyDaysAgo = new Date(refDate.getTime() - 90 * 86_400_000);

  // Group by normalised client name
  const map: Record<string, { name: string; isProcessor: boolean; txs: { amount: number; date: Date }[] }> = {};

  for (const tx of allTxs) {
    const { name, isProcessor } = _extractClientName(tx.description, tx.category);
    const key = name.toUpperCase();
    if (!map[key]) map[key] = { name, isProcessor, txs: [] };
    map[key].txs.push({ amount: Number(tx.amount), date: new Date(tx.transactionDate) });
  }

  const totalRevenue = allTxs.reduce((s, t) => s + Number(t.amount), 0);

  const profiles: ClientProfile[] = Object.values(map).map(c => {
    const { txs } = c;
    const total  = txs.reduce((s, t) => s + t.amount, 0);
    const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime());
    const first  = sorted[0].date;
    const last   = sorted[sorted.length - 1].date;
    const daysSince = Math.floor((refDate.getTime() - last.getTime()) / 86_400_000);

    const currYr = txs.filter(t => t.date.getUTCFullYear() === thisYear).reduce((s, t) => s + t.amount, 0);
    const prevYr = txs.filter(t => t.date.getUTCFullYear() === prevYear).reduce((s, t) => s + t.amount, 0);
    const yoyGrowth = prevYr > 0 ? Math.round(((currYr - prevYr) / prevYr) * 100) : null;

    const isNew = first.getUTCFullYear() === thisYear;
    const uniqueMonths = new Set(txs.map(t => `${t.date.getUTCFullYear()}-${t.date.getUTCMonth()}`)).size;
    const isInactive  = txs.length >= 3 && uniqueMonths >= 2 && last < ninetyDaysAgo && !isNew;

    const firstMs = first.getTime();
    const lastMs  = last.getTime();
    const monthsActive = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth()) + 1;

    return {
      name: c.name,
      isPaymentProcessor: c.isProcessor,
      totalRevenue: total,
      revenueShare: totalRevenue > 0 ? Math.round((total / totalRevenue) * 100) : 0,
      paymentCount: txs.length,
      firstPayment: first.toISOString(),
      lastPayment: last.toISOString(),
      daysSinceLastPayment: daysSince,
      currentYearRevenue: currYr,
      previousYearRevenue: prevYr,
      yoyGrowth,
      isNew,
      isInactive,
      avgPaymentSize: Math.round(total / txs.length),
      monthsActive,
    };
  });

  profiles.sort((a, b) => b.totalRevenue - a.totalRevenue);

  const topShare = profiles[0]?.revenueShare ?? 0;
  const activeCl = profiles.filter(p => p.daysSinceLastPayment <= 90).length;

  // Average unique payers per month
  const monthPayerMap: Record<string, Set<string>> = {};
  for (const tx of allTxs) {
    const d = new Date(tx.transactionDate);
    const mk = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const { name } = _extractClientName(tx.description, tx.category);
    if (!monthPayerMap[mk]) monthPayerMap[mk] = new Set();
    monthPayerMap[mk].add(name.toUpperCase());
  }
  const monthCounts = Object.values(monthPayerMap).map(s => s.size);
  const avgPerMonth = monthCounts.length
    ? Math.round((monthCounts.reduce((a, b) => a + b, 0) / monthCounts.length) * 10) / 10
    : 0;

  const nonProc = profiles.filter(p => !p.isPaymentProcessor);
  const diversification: ClientInsightsData["diversification"] =
    nonProc.length === 0 ? "concentrated" :
    topShare >= 70 ? "concentrated" :
    topShare >= 40 ? "moderate" : "diversified";

  return {
    clients:            profiles.slice(0, 10),
    totalRevenue,
    topClientShare:     topShare,
    hasConcentrationRisk: topShare >= 50,
    activeClients:      activeCl,
    avgClientsPerMonth: avgPerMonth,
    newClientsThisYear: profiles.filter(p => p.isNew && !p.isPaymentProcessor),
    inactiveClients:    profiles.filter(p => p.isInactive).slice(0, 5),
    diversification,
  };
}

// ── Data coverage (single source of truth for analysis range) ─────────────────
// All pages derive the displayed date range from this function, which queries
// the Transaction table directly — never MonthlyAnalytics, never inferred dates.

export interface DataCoverage {
  count: number;
  earliest: Date | null;
  latest: Date | null;
  years: number;
  months: number;
  rangeLabel: string | null;   // "January 2023 – January 2024"
}

function fmtUTCMonth(date: Date, locale: Locale): string {
  return date.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function getDataCoverage(userId: string): Promise<DataCoverage> {
  const locale = (await getLocale()) as Locale;

  const agg = await prisma.transaction.aggregate({
    where: { userId },
    _count: { id: true },
    _min:   { transactionDate: true },
    _max:   { transactionDate: true },
  });

  const count    = agg._count.id;
  const earliest = agg._min.transactionDate;
  const latest   = agg._max.transactionDate;

  if (!earliest || !latest || count === 0) {
    return { count, earliest: null, latest: null, years: 0, months: 0, rangeLabel: null };
  }

  const msPerYear  = 1000 * 60 * 60 * 24 * 365.25;
  const msPerMonth = msPerYear / 12;
  const span       = latest.getTime() - earliest.getTime();

  const fromLabel = fmtUTCMonth(earliest, locale);
  const toLabel   = fmtUTCMonth(latest, locale);
  const rangeLabel = fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;

  return {
    count,
    earliest,
    latest,
    years: Math.floor(span / msPerYear),
    months: Math.round(span / msPerMonth),
    rangeLabel,
  };
}

// ── Intent breakdown ──────────────────────────────────────────────────────────
// Computes intent-aware financial metrics from the Transaction table directly
// (not from MonthlyAnalytics). Amounts are stored as absolute positive values;
// direction (revenue / cost / neutral) is determined by the intent bucket.
//
// Returns null-safe values: all monetary fields are 0 when no classified
// transactions exist. `hasEnoughDataForDisplay` tells the UI whether to show
// intent KPIs or a "back-fill required" prompt.

// Intent groupings used to derive financial metrics.
const BUSINESS_REVENUE_INTENTS  = new Set(["freelance_income", "salary"]);
const BUSINESS_COST_INTENTS     = new Set(["business_expense", "tax_payment", "subscription"]);
const PERSONAL_SPEND_INTENTS    = new Set(["personal_expense", "family_support"]);
const DEBT_SERVICE_INTENTS      = new Set(["loan_repayment"]);
const SAVINGS_INTENTS           = new Set(["savings_transfer"]);
const SAVINGS_WITHDRAWAL_INTENTS= new Set(["savings_withdrawal"]);
const INVESTMENT_INTENTS        = new Set(["investment"]);
const OWNER_DRAW_INTENTS        = new Set(["owner_draw"]);
const PASSIVE_INCOME_INTENTS    = new Set(["passive_income"]);
const REFUND_INTENTS            = new Set(["refund"]);

// Minimum intent coverage % before intent KPIs are considered reliable.
const MIN_COVERAGE_PCT = 80;

export interface IntentBreakdown {
  // ── Business P&L ────────────────────────────────────────────────────────
  businessRevenue:  number;
  businessCosts:    number;
  businessProfit:   number;
  profitMarginPct:  number | null;  // null when revenue = 0

  // ── Personal financial activity ──────────────────────────────────────────
  personalSpend:    number;  // personal_expense + family_support
  familySupport:    number;  // extracted separately — was invisible as "transfer"
  debtService:      number;  // loan_repayment — was invisible as "transfer"
  totalObligations: number;  // personalSpend + debtService

  // ── Wealth allocation (within-ecosystem, do not affect cashflow) ─────────
  savingsMovement:    number;  // savings_transfer: money deployed to savings
  savingsWithdrawal:  number;  // savings_withdrawal: money returned from savings
  investmentFlow:     number;
  ownerDraw:          number;

  // ── Other income ─────────────────────────────────────────────────────────
  passiveIncome:    number;
  refunds:          number;

  // ── True net cashflow (corrects the transfer blind spot) ─────────────────
  // = (businessRevenue + passiveIncome + refunds) − (businessCosts + personalSpend + debtService)
  trueNetCashflow:  number;

  // ── Full intent distribution ──────────────────────────────────────────────
  distribution: Array<{
    intent:      string | null;
    count:       number;
    totalAmount: number;
  }>;

  // ── Transfer-type transaction breakdown ───────────────────────────────────
  // Shows what the previously-invisible "transfer" bucket actually contains.
  transferBreakdown: {
    totalCount:  number;
    totalAmount: number;
    byIntent: Array<{
      intent:      string | null;
      count:       number;
      totalAmount: number;
    }>;
  };

  // ── Coverage ──────────────────────────────────────────────────────────────
  totalTransactions:       number;
  intentClassifiedCount:   number;
  intentCoveragePct:       number;
  hasEnoughDataForDisplay: boolean;

  // ── Needs-review queue ────────────────────────────────────────────────────
  needsReviewCount:        number;
  topNeedsReviewMerchants: Array<{ description: string; count: number }>;
}

export async function getIntentBreakdown(
  userId: string,
  year?: number,
  month?: number,
): Promise<IntentBreakdown> {
  // Build date range filter — UTC-consistent with how parseDate() stores dates.
  const dateFilter =
    year !== undefined && month !== undefined
      ? { transactionDate: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } }
      : year !== undefined
      ? { transactionDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }
      : {};

  const base = { userId, ...dateFilter };

  // Run all queries in parallel — independent of each other.
  const [
    byIntentRows,
    transferByIntentRows,
    totalCount,
    classifiedCount,
    needsReviewCount,
    topNeedsReviewGroups,
  ] = await Promise.all([
    // Full distribution across all intent values (including null)
    prisma.transaction.groupBy({
      by: ["intent"],
      where: base,
      _sum:   { amount: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Transfer-type transactions broken down by intent
    prisma.transaction.groupBy({
      by: ["intent"],
      where: { ...base, transactionType: "transfer" },
      _sum:   { amount: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.transaction.count({ where: base }),
    prisma.transaction.count({ where: { ...base, intent: { not: null } } }),
    prisma.transaction.count({ where: { ...base, needsReview: true } }),
    prisma.transaction.groupBy({
      by: ["description"],
      where: { ...base, needsReview: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  // Helper: sum amount for a set of intents from the groupBy result.
  const sumIntents = (intents: Set<string>): number =>
    byIntentRows
      .filter((r) => r.intent !== null && intents.has(r.intent))
      .reduce((acc, r) => acc + Number(r._sum?.amount ?? 0), 0);

  const businessRevenue = sumIntents(BUSINESS_REVENUE_INTENTS);
  const businessCosts   = sumIntents(BUSINESS_COST_INTENTS);
  const businessProfit  = businessRevenue - businessCosts;
  const profitMarginPct = businessRevenue > 0
    ? Math.round((businessProfit / businessRevenue) * 1000) / 10  // 1 decimal
    : null;

  // family_support is inside PERSONAL_SPEND_INTENTS; extract it separately so
  // the response exposes the formerly-invisible transfer amount explicitly.
  const familySupport = byIntentRows
    .filter((r) => r.intent === "family_support")
    .reduce((acc, r) => acc + Number(r._sum?.amount ?? 0), 0);

  const personalSpend    = sumIntents(PERSONAL_SPEND_INTENTS);
  const debtService      = sumIntents(DEBT_SERVICE_INTENTS);
  const totalObligations = personalSpend + debtService;

  const savingsMovement    = sumIntents(SAVINGS_INTENTS);
  const savingsWithdrawal  = sumIntents(SAVINGS_WITHDRAWAL_INTENTS);
  const investmentFlow     = sumIntents(INVESTMENT_INTENTS);
  const ownerDraw        = sumIntents(OWNER_DRAW_INTENTS);
  const passiveIncome    = sumIntents(PASSIVE_INCOME_INTENTS);
  const refunds          = sumIntents(REFUND_INTENTS);

  const trueNetCashflow =
    (businessRevenue + passiveIncome + refunds) -
    (businessCosts + personalSpend + debtService);

  const distribution = byIntentRows.map((r) => ({
    intent:      r.intent,
    count:       r._count?.id ?? 0,
    totalAmount: Math.round(Number(r._sum?.amount ?? 0) * 100) / 100,
  }));

  const transferTotalCount  = transferByIntentRows.reduce((a, r) => a + (r._count?.id ?? 0), 0);
  const transferTotalAmount = transferByIntentRows.reduce((a, r) => a + Number(r._sum?.amount ?? 0), 0);

  const intentCoveragePct = totalCount > 0
    ? Math.round((classifiedCount / totalCount) * 1000) / 10
    : 0;

  return {
    businessRevenue:  Math.round(businessRevenue * 100) / 100,
    businessCosts:    Math.round(businessCosts   * 100) / 100,
    businessProfit:   Math.round(businessProfit  * 100) / 100,
    profitMarginPct,

    personalSpend:    Math.round(personalSpend    * 100) / 100,
    familySupport:    Math.round(familySupport     * 100) / 100,
    debtService:      Math.round(debtService       * 100) / 100,
    totalObligations: Math.round(totalObligations  * 100) / 100,

    savingsMovement:   Math.round(savingsMovement    * 100) / 100,
    savingsWithdrawal: Math.round(savingsWithdrawal  * 100) / 100,
    investmentFlow:    Math.round(investmentFlow      * 100) / 100,
    ownerDraw:         Math.round(ownerDraw           * 100) / 100,

    passiveIncome:    Math.round(passiveIncome      * 100) / 100,
    refunds:          Math.round(refunds            * 100) / 100,

    trueNetCashflow:  Math.round(trueNetCashflow    * 100) / 100,

    distribution,

    transferBreakdown: {
      totalCount:  transferTotalCount,
      totalAmount: Math.round(transferTotalAmount * 100) / 100,
      byIntent: transferByIntentRows.map((r) => ({
        intent:      r.intent,
        count:       r._count?.id ?? 0,
        totalAmount: Math.round(Number(r._sum?.amount ?? 0) * 100) / 100,
      })),
    },

    totalTransactions:       totalCount,
    intentClassifiedCount:   classifiedCount,
    intentCoveragePct,
    hasEnoughDataForDisplay: intentCoveragePct >= MIN_COVERAGE_PCT,

    needsReviewCount,
    topNeedsReviewMerchants: topNeedsReviewGroups.map((g) => ({
      description: g.description,
      count:       g._count?.id ?? 0,
    })),
  };
}
