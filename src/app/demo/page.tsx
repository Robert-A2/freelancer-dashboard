import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { generateDashboardIntelligence } from "@/lib/intelligence-engine";
import { formatCurrency } from "@/utils/finance";
import { getMonthlyVerdictKey } from "@/utils/monthlyVerdict";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import SummaryCards from "@/components/dashboard/SummaryCards";
import ProjectsPromoCard from "@/components/dashboard/ProjectsPromoCard";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import ForecastWidget from "@/components/dashboard/ForecastWidget";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import HistoricalInsights from "@/components/dashboard/HistoricalInsights";
import BusinessIntelligence from "@/components/dashboard/BusinessIntelligence";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DemoDashboardPage() {
  const t      = await getTranslations("dashboard");
  const locale = (await getLocale()) as Locale;

  const {
    chartData, summary, comparison, coverage, categoryInsights,
    concentration, intentBreakdown, forecast, financialLife,
    clientData, rankedInsights, nonZeroMonths, totalTx, personaFirstName,
  } = getDemoDataset(locale);

  const current  = summary.current;
  const previous = summary.previous;

  const recent = summary.recent.map(tx => ({
    id: tx.id,
    date: tx.transactionDate.toISOString(),
    description: tx.description,
    amount: tx.amount,
    type:   tx.transactionType,
    category: tx.category,
    intent: tx.intent,
    intentConfidence: tx.intentConfidence,
    needsReview: tx.needsReview,
  }));

  // Client concentration trend — same calculation as the real dashboard
  let clientConcentrationTrend: { currentPct: number; rollingAvgPct: number; topClientName: string | null } | null = null;
  if (clientData.clients.length > 0) {
    const curIdx = 5;
    const currentMonthTotal = clientData.clients.reduce((sum, c) => sum + (c.monthlyRevenue[curIdx]?.amount ?? 0), 0);
    if (currentMonthTotal > 0) {
      const topClient = clientData.clients.reduce((max, c) => {
        const amt    = c.monthlyRevenue[curIdx]?.amount ?? 0;
        const maxAmt = max.monthlyRevenue[curIdx]?.amount ?? 0;
        return amt > maxAmt ? c : max;
      });
      const topCurrentAmt = topClient.monthlyRevenue[curIdx]?.amount ?? 0;
      const currentPct    = Math.round((topCurrentAmt / currentMonthTotal) * 100);
      const priorData = [0, 1, 2, 3, 4].map(i => ({
        topAmt: topClient.monthlyRevenue[i]?.amount ?? 0,
        total:  clientData.clients.reduce((sum, c) => sum + (c.monthlyRevenue[i]?.amount ?? 0), 0),
      })).filter(d => d.total > 0);
      const rollingAvgPct = priorData.length > 0
        ? Math.round((priorData.reduce((s, d) => s + d.topAmt, 0) / priorData.reduce((s, d) => s + d.total, 0)) * 100)
        : 0;
      clientConcentrationTrend = { currentPct, rollingAvgPct, topClientName: topClient.name };
    }
  }

  const intel = generateDashboardIntelligence(
    current, previous, comparison.changes, chartData, recent,
    forecast ? { projectedIncome: forecast.projectedIncome, projectedExpenses: forecast.projectedExpenses, projectedSavings: forecast.projectedSavings, projectedCashflow: forecast.projectedCashflow, basedOnMonths: forecast.basedOnMonths } : null,
    categoryInsights.topExpenseCategories, categoryInsights.yearlySnapshots, categoryInsights.seasonality,
    concentration, locale,
    intentBreakdown.hasEnoughDataForDisplay ? intentBreakdown : null,
    financialLife,
    clientConcentrationTrend
  );

  const activeMonths       = chartData.filter(d => d.income > 0 || d.expenses > 0);
  const riskPositiveMonths = activeMonths.filter(d => d.cashflow >= 0).length;
  const riskTotalMonths    = activeMonths.length;
  const posRatio           = riskTotalMonths > 0 ? riskPositiveMonths / riskTotalMonths : 0;
  const last6    = activeMonths.slice(-6);
  const prev6    = activeMonths.slice(-12, -6);
  const avgLast6 = last6.length  ? last6.reduce((s, d)  => s + d.income, 0) / last6.length  : 0;
  const avgPrev6 = prev6.length  ? prev6.reduce((s, d)  => s + d.income, 0) / prev6.length  : 0;
  const incTrend = avgPrev6 > 0 ? (avgLast6 - avgPrev6) / avgPrev6 : 0;
  const incTrendPct = Math.round(incTrend * 100);

  const riskLevel: "low" | "medium" | "high" | "critical" =
    posRatio >= 0.85 && incTrend > -0.05 ? "low" :
    posRatio >= 0.65 ? "medium" :
    posRatio >= 0.40 ? "high" : "critical";

  const followUpClients = clientData.clients.filter(c => c.actions.some(a => a.type === "followUp"));
  const nudgeClients    = followUpClients.slice(0, 3);
  const nudgeExtra      = Math.max(0, followUpClients.length - 3);

  // Peek subtitles — mirrors the real dashboard's collapsed-section summaries.
  const businessIntelligencePeek = intentBreakdown.hasEnoughDataForDisplay
    ? t("businessIntelligence.peek", {
        margin: intentBreakdown.profitMarginPct !== null ? Math.round(intentBreakdown.profitMarginPct) : 0,
        personalSpend: formatCurrency(intentBreakdown.personalSpend, locale),
      })
    : undefined;

  const monthlyPreviousHasData = !!(comparison.previous && (comparison.previous.totalIncome > 0 || comparison.previous.totalExpenses > 0));
  const monthlyVerdictKey = monthlyPreviousHasData ? getMonthlyVerdictKey(comparison.changes) : null;
  const monthlyComparisonPeek = monthlyVerdictKey ? t(`monthlyComparison.${monthlyVerdictKey}`) : undefined;

  const historicalInsightsPeek = t("historicalInsights.monthsOfHistory", { count: nonZeroMonths });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-2xl font-bold">
              {t("welcomeBack", { name: personaFirstName })}
            </h1>
          </div>
          <p className="text-[#7BA8C4] text-sm">
            {coverage.latest
              ? t("showingDataThrough", { date: coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" }) })
              : t("noDataYet")}
          </p>
        </div>
        <p className="text-xs text-[#6A97B4] flex-shrink-0 mt-1">
          {t("transactionsMonths", { transactions: totalTx, months: nonZeroMonths })}
        </p>
      </div>

      <DataCoverageBar coverage={coverage} lastImportedAt={null} />

      <SummaryCards
        current={current}
        previous={previous}
        riskLevel={riskLevel}
        riskPositiveMonths={riskPositiveMonths}
        riskTotalMonths={riskTotalMonths}
        incomeTrendPct={incTrendPct}
        summary={intel.snapshotSummary}
        context={intel.snapshotContext}
        periodLabel={comparison.currLabel}
        currentMonth={comparison.currMonth}
        currentYear={comparison.currYear}
        basePath="/demo"
      />

      <ProjectsPromoCard basePath="/demo" />

      {nudgeClients.length > 0 && (
        <div className="card">
          <p className="label mb-3">{t("clientNudge.label")}</p>
          <div className="space-y-2.5">
            {nudgeClients.map(c => (
              <div key={c.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4A254] flex-shrink-0" />
                  <span className="text-sm text-[#C8DCF0] truncate font-medium">{c.name}</span>
                  <span className="text-xs text-[#6A97B4] flex-shrink-0">
                    {t("clientNudge.daysSince", { days: c.currentGapDays })}
                  </span>
                </div>
                <Link
                  href={`/demo/clients/${encodeURIComponent(c.name)}`}
                  className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors flex-shrink-0"
                >
                  {t("clientNudge.cta")}
                </Link>
              </div>
            ))}
            {nudgeExtra > 0 && (
              <div className="flex justify-end pt-1">
                <Link href="/demo/clients" className="text-xs text-[#4A7A9B] hover:text-[#7BA8C4] transition-colors">
                  {t("clientNudge.andMore", { count: nudgeExtra })}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {intentBreakdown.hasEnoughDataForDisplay ? (
        <CollapsibleSection
          title={t("businessIntelligence.title")}
          subtitle={businessIntelligencePeek}
          defaultOpen={false}
        >
          <BusinessIntelligence
            businessProfit={intentBreakdown.businessProfit}
            profitMarginPct={intentBreakdown.profitMarginPct}
            personalSpend={intentBreakdown.personalSpend}
            trueNetCashflow={intentBreakdown.trueNetCashflow}
            intentInsights={intel.intentInsights}
            lifeInsights={intel.lifeInsights}
          />
        </CollapsibleSection>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2">
          <TrendsChart
            data={chartData}
            trajectoryInsight={intel.trajectoryInsight}
            trajectoryDetails={intel.trajectoryDetails}
            riskLevel={riskLevel}
            apiBase="/api/demo"
          />
        </div>
        <ForecastWidget
          forecast={forecast}
          reasons={intel.forecastReasons}
          improvements={intel.forecastImprovements}
          deficitReason={intel.cashflowDeficitReason}
        />
      </div>

      <CollapsibleSection
        label={t("monthlyComparison.monthlySummary")}
        title={t("monthlyComparison.label")}
        subtitle={monthlyComparisonPeek}
        defaultOpen={false}
      >
        <MonthlyComparisonWidget
          current={comparison.current ?? null}
          previous={comparison.previous ?? null}
          changes={comparison.changes ?? null}
          interpretation={intel.comparisonInterpretation}
          suggestion={intel.comparisonSuggestion}
          currLabel={comparison.currLabel}
          prevLabel={comparison.prevLabel}
        />
      </CollapsibleSection>

      <RecentTransactions
        transactions={recent}
        notable={intel.notableTransactions}
        basePath="/demo"
      />

      {rankedInsights.length > 0 && (
        <CollapsibleSection
          label={t("historicalInsights.label")}
          title={t("historicalInsights.title")}
          subtitle={historicalInsightsPeek}
          defaultOpen={false}
        >
          <HistoricalInsights
            insights={rankedInsights}
            totalMonths={nonZeroMonths}
            basePath="/demo"
          />
        </CollapsibleSection>
      )}
    </div>
  );
}
