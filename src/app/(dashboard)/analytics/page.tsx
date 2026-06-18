import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import {
  getHistoricalData, getCategoryInsights, getClientInsights, getDataCoverage, getIncomeConcentration,
  getCategorizationHealth,
} from "@/lib/analytics-engine";
import { buildHistoricalInsights } from "@/lib/intelligence-engine";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/utils/finance";
import CashflowChart from "@/components/analytics/CashflowChart";
import ClientInsights from "@/components/analytics/ClientInsights";
import FinancialStory from "@/components/analytics/FinancialStory";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ExpenseBreakdown from "@/components/analytics/ExpenseBreakdown";
import type { BreakdownItem } from "@/components/analytics/ExpenseBreakdown";
import Link from "next/link";

export const dynamic = "force-dynamic";

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function ChangeChip({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#D9707015] text-[#D97070]"}`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("analytics");
  const tm = await getTranslations("metrics");
  const tCategories = await getTranslations("categories");
  const locale = (await getLocale()) as Locale;

  // Anchor YTD to the user's most recent data year, not the current calendar year.
  // A user with data ending Dec 2024 visiting in 2026 would otherwise see €0 for both years.
  const latestDataRecord = await prisma.monthlyAnalytics.findFirst({
    where: { userId: user.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true, month: true },
  });

  const now          = new Date();
  const dataYear     = latestDataRecord?.year  ?? now.getUTCFullYear();
  const prevYear     = dataYear - 1;
  // Cap at the latest data month — never inflate to 12 for a past year
  const dataMonthMax = latestDataRecord?.month ?? now.getUTCMonth() + 1;
  // "Year to date" is only accurate when the data includes the current calendar year
  const ytdSectionLabel = dataYear === now.getUTCFullYear() ? t("ytdSection.yearToDate") : t("ytdSection.annualComparison");

  // Exactly 12 months ending at the last data month — UTC midnight
  const incSince = new Date(Date.UTC(dataYear, dataMonthMax - 12, 1));

  const [chartData, categoryInsights, categoryBreakdown, incomeBySource, ytdThis, ytdPrev, clientInsights, coverage, concentration, categorizationHealth] =
    await Promise.all([
      getHistoricalData(user.id, 999),
      getCategoryInsights(user.id),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, transactionType: "expense" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, transactionType: "income", transactionDate: { gte: incSince } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 8,
      }),
      prisma.monthlyAnalytics.aggregate({
        where: { userId: user.id, year: dataYear, month: { lte: dataMonthMax } },
        _sum: { totalIncome: true, totalExpenses: true, totalSavings: true, netCashflow: true },
      }),
      prisma.monthlyAnalytics.aggregate({
        where: { userId: user.id, year: prevYear, month: { lte: dataMonthMax } },
        _sum: { totalIncome: true, totalExpenses: true, totalSavings: true, netCashflow: true },
      }),
      getClientInsights(user.id),
      getDataCoverage(user.id),
      getIncomeConcentration(user.id),
      getCategorizationHealth(user.id),
    ]);

  const hasData = chartData.some(d => d.income > 0 || d.expenses > 0);
  const nonZeroMonths = chartData.filter((d) => d.income > 0 || d.expenses > 0).length;

  const rankedInsights = buildHistoricalInsights(
    chartData,
    categoryInsights.topExpenseCategories,
    categoryInsights.yearlySnapshots,
    categoryInsights.seasonality,
    concentration,
    locale
  );

  const ytdInc  = Number(ytdThis._sum.totalIncome   ?? 0);
  const ytdExp  = Number(ytdThis._sum.totalExpenses  ?? 0);
  const prevInc  = Number(ytdPrev._sum.totalIncome   ?? 0);
  const prevExp  = Number(ytdPrev._sum.totalExpenses ?? 0);

  // Cashflow = netCashflow (Income − Expenses) — single definition shared with
  // the dashboard, charts, risk/health scoring, and forecasts.
  const ytdCash  = Number(ytdThis._sum.netCashflow ?? 0);
  const prevCash = Number(ytdPrev._sum.netCashflow ?? 0);

  // Cashflow margin: % of income kept after expenses, for both years
  const ytdMargin  = ytdInc  > 0 ? Math.round((ytdCash  / ytdInc)  * 100) : null;
  const prevMargin = prevInc > 0 ? Math.round((prevCash / prevInc) * 100) : null;

  // The prior-year window is only a fair comparison if data coverage actually
  // extends back that far. Otherwise a partial prior year (e.g. data starting
  // mid-year) compares a full window against a sliver and produces wildly
  // inflated % changes (e.g. 6 months of data vs. 1 month).
  const prevYearStart = new Date(Date.UTC(prevYear, 0, 1));
  const showPrevYearComparison = prevInc > 0 && !!coverage.earliest && coverage.earliest <= prevYearStart;

  const ytdStartMonthLabel = new Date(Date.UTC(dataYear, 0, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "long", timeZone: "UTC" });
  const ytdEndMonthLabel   = new Date(Date.UTC(dataYear, dataMonthMax - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "long", timeZone: "UTC" });

  const totalExpenses = categoryBreakdown.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);
  const totalIncSrc   = incomeBySource.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);

  return (
    <div className="space-y-8 md:space-y-10">

      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {!hasData && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">{t("emptyState.heading")}</h2>
          <p className="text-[#7BA8C4] mb-6 max-w-sm mx-auto">{t("emptyState.body")}</p>
          <Link href="/upload" className="btn-primary inline-block">{t("emptyState.cta")}</Link>
        </div>
      )}

      {hasData && (
        <>
          {/* ── 1. Year-to-date vs prior year ─────────────────────────────── */}
          <CollapsibleSection
            label={ytdSectionLabel}
            title={showPrevYearComparison
              ? t("ytdSection.titleVs", { dataYear: String(dataYear), prevYear: String(prevYear) })
              : dataMonthMax === 1
                ? t("ytdSection.titleCurrentSingle", { month: ytdStartMonthLabel, dataYear: String(dataYear) })
                : t("ytdSection.titleCurrent", { startMonth: ytdStartMonthLabel, endMonth: ytdEndMonthLabel, dataYear: String(dataYear) })}
            subtitle={showPrevYearComparison
              ? t("ytdSection.subtitle", { endMonth: ytdEndMonthLabel })
              : t("ytdSection.subtitleCurrent")}
          >
            <div className="card">
              {!showPrevYearComparison && (
                <p className="text-xs text-[#6A97B4] mb-4">{t("ytdSection.noComparisonYet")}</p>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { key: "income",   label: tm("income"),   curr: ytdInc,  prev: prevInc,  color: "text-[#4CC4A4]", invert: false },
                  { key: "expenses", label: tm("expenses"), curr: ytdExp,  prev: prevExp,  color: "text-[#D4A254]", invert: true  },
                  { key: "cashflow", label: tm("cashflow"), curr: ytdCash, prev: prevCash, color: ytdCash >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]", invert: false },
                ].map((item) => {
                  const change = showPrevYearComparison ? pctChange(item.curr, item.prev) : null;
                  const displayVal    = formatCurrency(item.curr, locale);
                  const prevDisplayVal = t("ytdSection.lastYr", { amount: formatCurrency(item.prev, locale) });
                  return (
                    <div key={item.key} className="bg-[#1A3048] rounded-xl p-4">
                      <p className="label mb-1">{item.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${item.color} mb-1`}>{displayVal}</p>
                      <div className="flex items-center gap-2">
                        {change !== null && <ChangeChip value={change} invert={item.invert} />}
                        {showPrevYearComparison && <span className="text-xs text-[#6A97B4]">{prevDisplayVal}</span>}
                      </div>
                    </div>
                  );
                })}
                {/* Margin — shown as a fourth cell alongside the three currency metrics */}
                <div className="bg-[#1A3048] rounded-xl p-4">
                  <p className="label mb-1">{tm("margin")}</p>
                  <p className={`text-lg font-bold tabular-nums mb-1 ${
                    ytdMargin === null ? "text-[#6A97B4]"
                      : ytdMargin >= 30 ? "text-[#4CC4A4]"
                      : ytdMargin >= 10 ? "text-[#D4A254]"
                      : "text-[#D97070]"
                  }`}>
                    {ytdMargin !== null ? `${ytdMargin}%` : "—"}
                  </p>
                  <div className="flex items-center gap-2">
                    {ytdMargin !== null && prevMargin !== null && showPrevYearComparison && (
                      <ChangeChip value={ytdMargin - prevMargin} />
                    )}
                    {prevMargin !== null && showPrevYearComparison && (
                      <span className="text-xs text-[#6A97B4]">{t("ytdSection.marginLastYr", { pct: String(prevMargin) })}</span>
                    )}
                    {ytdMargin !== null && !showPrevYearComparison && (
                      <span className="text-xs text-[#6A97B4]">{t("ytdSection.ofIncomeKept")}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* ── 2. Cashflow chart with intelligence ───────────────────────── */}
          <CollapsibleSection label={t("cashflowSection.label")} title={t("cashflowSection.title")}>
            <CashflowChart data={chartData} hideHeader />
          </CollapsibleSection>

          {/* ── 3. Income sources + Expense breakdown ─────────────────────── */}
          <CollapsibleSection label={t("breakdownsSection.label")} title={t("breakdownsSection.title")}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              <ExpenseBreakdown
                type="income"
                since={incSince.toISOString()}
                breakdown={incomeBySource.map((src): BreakdownItem => {
                  const amount = Number(src._sum.amount ?? 0);
                  const pct = totalIncSrc > 0 ? Math.round((amount / totalIncSrc) * 100) : 0;
                  return { category: src.category, total: amount, pct, trend: null };
                })}
                labels={{
                  title:    t("breakdownsSection.incomeSources"),
                  subtitle: t("breakdownsSection.last12Months"),
                  empty:    t("breakdownsSection.noIncomeData"),
                }}
              />

              <ExpenseBreakdown
                breakdown={categoryBreakdown.map((cat): BreakdownItem => {
                  const amount = Number(cat._sum.amount ?? 0);
                  const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
                  const trend = categoryInsights.topExpenseCategories.find(c => c.category === cat.category);
                  return {
                    category: cat.category,
                    total: amount,
                    pct,
                    trend: trend?.yearOverYearTrend === "growing"
                      ? "growing"
                      : trend?.yearOverYearTrend === "declining"
                      ? "declining"
                      : "stable",
                  };
                })}
                labels={{
                  title:    t("breakdownsSection.expenseBreakdown"),
                  subtitle: t("breakdownsSection.allTime"),
                  empty:    t("breakdownsSection.noExpenseData"),
                }}
              />
            </div>
          </CollapsibleSection>

          {/* ── 3b. Categorization health ─────────────────────────────────── */}
          <CollapsibleSection
            label={t("categorizationSection.label")}
            title={t("categorizationSection.title")}
            subtitle={t("categorizationSection.subtitle")}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
              <div className="card lg:col-span-1">
                <p className="label mb-1">{t("categorizationSection.categorized")}</p>
                <p className="text-3xl font-bold text-[#4CC4A4] mb-1">{categorizationHealth.categorizedPct}%</p>
                <p className="text-xs text-[#6A97B4]">
                  {t("categorizationSection.uncategorizedSummary", {
                    uncategorized: categorizationHealth.uncategorizedCount,
                    total: categorizationHealth.totalCount,
                    pct: String(categorizationHealth.uncategorizedPct),
                  })}
                </p>
                <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-[#4CC4A4] rounded-full opacity-70" style={{ width: `${categorizationHealth.categorizedPct}%` }} />
                </div>
                {categorizationHealth.uncategorizedCount > 0 && (
                  <Link href="/history?confidence=low" className="inline-block mt-4 text-sm text-[#3AB5A0] hover:text-[#4CC4A4] font-medium transition-colors">
                    {t("categorizationSection.reviewUncategorized")}
                  </Link>
                )}
              </div>

              <div className="card lg:col-span-1">
                <p className="label mb-1">{t("categorizationSection.mostCommonUncategorized")}</p>
                <p className="text-xs text-[#6A97B4] mb-4">{t("categorizationSection.worthManualFix")}</p>
                {categorizationHealth.topUncategorizedMerchants.length === 0 ? (
                  <p className="text-[#7BA8C4] text-sm">{t("categorizationSection.nothingUncategorized")}</p>
                ) : (
                  <ul className="space-y-2">
                    {categorizationHealth.topUncategorizedMerchants.map((m) => (
                      <li key={m.description} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#A8C6E0] truncate">{m.description}</span>
                        <span className="text-[#6A97B4] flex-shrink-0">{m.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card lg:col-span-1">
                <p className="label mb-1">{t("categorizationSection.mostCorrectedMerchants")}</p>
                <p className="text-xs text-[#6A97B4] mb-4">{t("categorizationSection.manualFixesSubtitle")}</p>
                {categorizationHealth.topCorrectedMerchants.length === 0 ? (
                  <p className="text-[#7BA8C4] text-sm">{t("categorizationSection.noCorrectionsYet")}</p>
                ) : (
                  <ul className="space-y-2">
                    {categorizationHealth.topCorrectedMerchants.map((m) => (
                      <li key={m.description} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#A8C6E0] truncate">{m.description}</span>
                        <span className="text-[#6A97B4] flex-shrink-0">{m.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* ── 4. Client Insights ────────────────────────────────────────── */}
          {clientInsights && (
            <CollapsibleSection
              label={t("clientSection.label")}
              title={t("clientSection.title")}
              subtitle={t("clientSection.subtitle")}
            >
              <ClientInsights data={clientInsights} />
            </CollapsibleSection>
          )}

          {/* ── 5. Financial Story — full ranked & grouped historical insights ── */}
          {rankedInsights.length > 0 && (
            <div id="financial-story">
              <CollapsibleSection
                label={t("storySection.label")}
                title={t("storySection.title")}
                subtitle={t("storySection.subtitle")}
              >
                <FinancialStory insights={rankedInsights} totalMonths={nonZeroMonths} />
              </CollapsibleSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}
