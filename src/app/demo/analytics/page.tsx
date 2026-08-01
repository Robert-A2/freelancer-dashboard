import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { computeCategoryBreakdown, computeIncomeBySource, computeYtdTotals, computeClientInsights, computeCategorizationHealth } from "@/lib/demo/engine";
import { formatCurrency } from "@/utils/finance";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import CashflowChart from "@/components/analytics/CashflowChart";
import ClientInsights from "@/components/analytics/ClientInsights";
import FinancialStory from "@/components/analytics/FinancialStory";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import ExpenseBreakdown from "@/components/analytics/ExpenseBreakdown";
import type { BreakdownItem } from "@/components/analytics/ExpenseBreakdown";
import BusinessIntelligence from "@/components/dashboard/BusinessIntelligence";
import Link from "next/link";

export const dynamic = "force-dynamic";

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function ChangeChip({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#E5484D15] text-[#E5484D]"}`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

export default async function DemoAnalyticsPage() {
  const t      = await getTranslations("analytics");
  const tm     = await getTranslations("metrics");
  const locale = (await getLocale()) as Locale;

  const { chartData, coverage, categoryInsights, rankedInsights, nonZeroMonths, intentBreakdown } = getDemoDataset(locale);
  const categoryBreakdown  = computeCategoryBreakdown();
  const incomeBySource     = computeIncomeBySource();
  const ytd                = computeYtdTotals();
  const clientInsights      = computeClientInsights();
  const categorizationHealth = computeCategorizationHealth();

  const hasData = chartData.some(d => d.income > 0 || d.expenses > 0);

  const { dataYear, prevYear, dataMonthMax, ytdInc, ytdExp, ytdCash, prevInc, prevExp, prevCash } = ytd;
  const ytdMargin  = ytdInc  > 0 ? Math.round((ytdCash  / ytdInc)  * 100) : null;
  const prevMargin = prevInc > 0 ? Math.round((prevCash / prevInc) * 100) : null;

  const prevYearStart = new Date(Date.UTC(prevYear, 0, 1));
  const showPrevYearComparison =
    prevInc > 0 && !!coverage.earliest && coverage.earliest <= prevYearStart;

  const ytdSectionLabel = dataYear === new Date().getUTCFullYear()
    ? t("ytdSection.yearToDate")
    : t("ytdSection.annualComparison");

  const ytdStartMonthLabel = new Date(Date.UTC(dataYear, 0, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "long", timeZone: "UTC" });
  const ytdEndMonthLabel   = new Date(Date.UTC(dataYear, dataMonthMax - 1, 1)).toLocaleDateString(INTL_LOCALES[locale], { month: "long", timeZone: "UTC" });

  const totalExpenses = categoryBreakdown.reduce((s, c) => s + c.total, 0);
  const incSinceLabel = new Date(Date.UTC(dataYear, dataMonthMax - 12, 1)).toISOString();

  return (
    <div className="space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{hasData ? t("subtitleHabits") : t("subtitle")}</p>
      </div>

      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {hasData && (
        <>
          {/* Habit verdict */}
          <div className={`px-5 py-4 rounded-xl border ${
            showPrevYearComparison && pctChange(ytdInc, prevInc) > 0 && pctChange(ytdExp, prevExp) <= pctChange(ytdInc, prevInc)
              ? "bg-[#4CC4A40A] border-[#4CC4A415]"
              : showPrevYearComparison && pctChange(ytdInc, prevInc) < -5
              ? "bg-[#E5484D0A] border-[#E5484D15]"
              : showPrevYearComparison
              ? "bg-[#D4A2540A] border-[#D4A25415]"
              : "bg-[#1A3048] border-[#243F5E]"
          }`}>
            <p className={`text-sm font-medium leading-relaxed ${
              showPrevYearComparison && pctChange(ytdInc, prevInc) > 0 && pctChange(ytdExp, prevExp) <= pctChange(ytdInc, prevInc)
                ? "text-[#4CC4A4]"
                : showPrevYearComparison && pctChange(ytdInc, prevInc) < -5
                ? "text-[#E5484D]"
                : showPrevYearComparison
                ? "text-[#D4A254]"
                : "text-[#7BA8C4]"
            }`}>
              {!showPrevYearComparison
                ? t("habitVerdict.noComparison")
                : pctChange(ytdInc, prevInc) > 0 && pctChange(ytdExp, prevExp) <= pctChange(ytdInc, prevInc)
                ? t("habitVerdict.growingIncomeStableExp", { prevYear: String(prevYear), dataYear: String(dataYear) })
                : pctChange(ytdInc, prevInc) > 0
                ? t("habitVerdict.growingIncomeGrowingExp", { prevYear: String(prevYear), dataYear: String(dataYear) })
                : pctChange(ytdInc, prevInc) < -5
                ? t("habitVerdict.decliningIncome", { prevYear: String(prevYear), dataYear: String(dataYear) })
                : t("habitVerdict.stableAll", { prevYear: String(prevYear), dataYear: String(dataYear) })}
            </p>
          </div>

          {/* ── Year-to-date comparison ────────────────────────────────────── */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { key: "income",   label: tm("income"),   curr: ytdInc,  prev: prevInc,  color: "text-[#4CC4A4]", invert: false },
                  { key: "expenses", label: tm("expenses"), curr: ytdExp,  prev: prevExp,  color: "text-[#D4A254]", invert: true  },
                  { key: "cashflow", label: tm("cashflow"), curr: ytdCash, prev: prevCash, color: ytdCash >= 0 ? "text-[#3AB5A0]" : "text-[#E5484D]", invert: false },
                ].map(item => {
                  const change = showPrevYearComparison ? pctChange(item.curr, item.prev) : null;
                  return (
                    <div key={item.key} className="bg-[#1A3048] rounded-xl p-4">
                      <p className="label mb-1">{item.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${item.color} mb-1`}>{formatCurrency(item.curr, locale)}</p>
                      {change !== null && <div className="mt-0.5"><ChangeChip value={change} invert={item.invert} /></div>}
                      {showPrevYearComparison && (
                        <p className="text-[11px] text-[#6A97B4] mt-0.5 break-words leading-tight">
                          {t("ytdSection.lastYr", { amount: formatCurrency(item.prev, locale), year: String(prevYear) })}
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="bg-[#1A3048] rounded-xl p-4">
                  <p className="label mb-1">{tm("margin")}</p>
                  <p className={`text-lg font-bold tabular-nums mb-1 ${
                    ytdMargin === null ? "text-[#6A97B4]"
                      : ytdMargin >= 30 ? "text-[#4CC4A4]"
                      : ytdMargin >= 10 ? "text-[#D4A254]"
                      : "text-[#E5484D]"
                  }`}>
                    {ytdMargin !== null ? `${ytdMargin}%` : "—"}
                  </p>
                  {ytdMargin !== null && prevMargin !== null && showPrevYearComparison && (
                    <div className="mt-0.5"><ChangeChip value={ytdMargin - prevMargin} /></div>
                  )}
                  {prevMargin !== null && showPrevYearComparison && (
                    <p className="text-[11px] text-[#6A97B4] mt-0.5 leading-tight">
                      {t("ytdSection.marginLastYr", { pct: String(prevMargin), year: String(prevYear) })}
                    </p>
                  )}
                  {ytdMargin !== null && !showPrevYearComparison && (
                    <p className="text-[11px] text-[#6A97B4] mt-0.5">{t("ytdSection.ofIncomeKept")}</p>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Business Intelligence — business vs. personal split, moved here
              from the Dashboard, same as the real page. ──────────────────── */}
          {intentBreakdown.hasEnoughDataForDisplay && (
            <CollapsibleSection
              label={t("businessSection.label")}
              title={t("businessSection.title")}
              subtitle={t("businessSection.subtitle", {
                margin: intentBreakdown.profitMarginPct !== null ? Math.round(intentBreakdown.profitMarginPct) : 0,
                personalSpend: formatCurrency(intentBreakdown.personalSpend, locale),
              })}
              defaultOpen={false}
            >
              <BusinessIntelligence
                businessProfit={intentBreakdown.businessProfit}
                profitMarginPct={intentBreakdown.profitMarginPct}
                personalSpend={intentBreakdown.personalSpend}
                trueNetCashflow={intentBreakdown.trueNetCashflow}
                intentInsights={[]}
              />
            </CollapsibleSection>
          )}

          {/* ── Cashflow chart ─────────────────────────────────────────────── */}
          <CollapsibleSection label={t("cashflowSection.label")} title={t("cashflowSection.title")}>
            <CashflowChart data={chartData} hideHeader apiBase="/api/demo" />
          </CollapsibleSection>

          {/* ── Income sources + Expense breakdown ────────────────────────── */}
          <CollapsibleSection label={t("breakdownsSection.label")} title={t("breakdownsSection.title")} defaultOpen={false}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              <ExpenseBreakdown
                type="income"
                since={incSinceLabel}
                apiBase="/api/demo"
                breakdown={incomeBySource.map((src): BreakdownItem => ({
                  category: src.category,
                  total: src.total,
                  pct: src.pct,
                  trend: null,
                }))}
                labels={{
                  title:    t("breakdownsSection.incomeSources"),
                  subtitle: t("breakdownsSection.last12Months"),
                  empty:    t("breakdownsSection.noIncomeData"),
                }}
              />

              <ExpenseBreakdown
                apiBase="/api/demo"
                breakdown={categoryBreakdown.map((cat): BreakdownItem => {
                  const trend = categoryInsights.topExpenseCategories.find(c => c.category === cat.category);
                  return {
                    category: cat.category,
                    total: cat.total,
                    pct: totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0,
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

          {/* ── Categorization health ──────────────────────────────────────── */}
          <CollapsibleSection
            label={t("categorizationSection.label")}
            title={t("categorizationSection.title")}
            subtitle={t("categorizationSection.subtitle")}
            defaultOpen={false}
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
              </div>

              <div className="card lg:col-span-1">
                <p className="label mb-1">{t("categorizationSection.mostCommonUncategorized")}</p>
                <p className="text-xs text-[#6A97B4] mb-4">{t("categorizationSection.worthManualFix")}</p>
                <p className="text-[#7BA8C4] text-sm">{t("categorizationSection.nothingUncategorized")}</p>
              </div>

              <div className="card lg:col-span-1">
                <p className="label mb-1">{t("categorizationSection.mostCorrectedMerchants")}</p>
                <p className="text-xs text-[#6A97B4] mb-4">{t("categorizationSection.manualFixesSubtitle")}</p>
                <p className="text-[#7BA8C4] text-sm">{t("categorizationSection.noCorrectionsYet")}</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Client Insights ────────────────────────────────────────────── */}
          {clientInsights && (
            <CollapsibleSection
              label={t("clientSection.label")}
              title={t("clientSection.title")}
              subtitle={t("clientSection.subtitle")}
              defaultOpen={false}
            >
              <ClientInsights data={clientInsights} dataYear={dataYear} />
              <div className="mt-4">
                <Link href="/demo/clients" className="inline-flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#4CC4A4] font-medium transition-colors">
                  {t("clientSection.trustCenter")}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </CollapsibleSection>
          )}

          {/* ── Financial Story ────────────────────────────────────────────── */}
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
