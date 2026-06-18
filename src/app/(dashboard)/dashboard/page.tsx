import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import {
  getDashboardSummary,
  getHistoricalData,
  getMonthlyComparison,
  getDataCoverage,
  getCategoryInsights,
  getIncomeConcentration,
  getIntentBreakdown,
} from "@/lib/analytics-engine";
import { getLatestForecast } from "@/lib/forecast-engine";
import { generateDashboardIntelligence, buildHistoricalInsights } from "@/lib/intelligence-engine";
import { prisma } from "@/lib/prisma";
import SummaryCards from "@/components/dashboard/SummaryCards";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import ForecastWidget from "@/components/dashboard/ForecastWidget";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import HistoricalInsights from "@/components/dashboard/HistoricalInsights";
import BusinessIntelligence from "@/components/dashboard/BusinessIntelligence";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import FirstUploadBanner from "@/components/dashboard/FirstUploadBanner";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ firstUpload?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("dashboard");
  const locale = (await getLocale()) as Locale;

  const params = await searchParams;

  const [summary, forecast, chartData, comparison, totalTx, coverage, categoryInsights, concentration, dbUser, lastImport, intentBreakdown] =
    await Promise.all([
      getDashboardSummary(user.id),
      getLatestForecast(user.id),
      getHistoricalData(user.id, 999),
      getMonthlyComparison(user.id),
      prisma.transaction.count({ where: { userId: user.id } }),
      getDataCoverage(user.id),
      getCategoryInsights(user.id),
      getIncomeConcentration(user.id),
      prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
      // Fix 1: use last IMPORT date for freshness, not last transaction date.
      // Using transaction dates caused a permanent warning for any historical upload.
      prisma.csvImport.findFirst({
        where: { userId: user.id, status: "completed" },
        orderBy: { importedAt: "desc" },
        select: { importedAt: true },
      }),
      getIntentBreakdown(user.id),
    ]);

  const current = summary.current
    ? {
        totalIncome: Number(summary.current.totalIncome),
        totalExpenses: Number(summary.current.totalExpenses),
        totalSavings: Number(summary.current.totalSavings),
        netCashflow: Number(summary.current.netCashflow),
      }
    : null;

  const previous = summary.previous
    ? {
        totalIncome: Number(summary.previous.totalIncome),
        totalExpenses: Number(summary.previous.totalExpenses),
        totalSavings: Number(summary.previous.totalSavings),
        netCashflow: Number(summary.previous.netCashflow),
      }
    : null;

  const recent = summary.recent.map((tx) => ({
    id: tx.id,
    date: tx.transactionDate.toISOString(),
    description: tx.description,
    amount: Number(tx.amount),
    type: tx.transactionType,
    category: tx.category,
    intent: tx.intent,
    intentConfidence: tx.intentConfidence,
    needsReview: tx.needsReview,
  }));

  const intel = generateDashboardIntelligence(
    current,
    previous,
    comparison.changes,
    chartData,
    recent,
    forecast
      ? {
          projectedIncome: forecast.projectedIncome,
          projectedExpenses: forecast.projectedExpenses,
          projectedSavings: forecast.projectedSavings,
          projectedCashflow: forecast.projectedCashflow,
          basedOnMonths: forecast.basedOnMonths,
        }
      : null,
    categoryInsights.topExpenseCategories,
    categoryInsights.yearlySnapshots,
    categoryInsights.seasonality,
    concentration,
    locale,
    intentBreakdown.hasEnoughDataForDisplay ? intentBreakdown : null
  );

  const hasData = totalTx > 0;
  const nonZeroMonths = chartData.filter((d) => d.income > 0 || d.expenses > 0).length;

  // Risk computed from historical data — mirrors forecast/page.tsx's cashflow risk
  // calculation exactly (including the income-trend check) so the Dashboard and
  // Forecast pages never disagree on the same data.
  const activeMonths      = chartData.filter(d => d.income > 0 || d.expenses > 0);

  const riskPositiveMonths = activeMonths.filter(d => d.cashflow >= 0).length;
  const riskTotalMonths    = activeMonths.length;
  const posRatio           = riskTotalMonths > 0 ? riskPositiveMonths / riskTotalMonths : 0;

  const last6    = activeMonths.slice(-6);
  const prev6    = activeMonths.slice(-12, -6);
  const avgLast6 = last6.length ? last6.reduce((s, d) => s + d.income, 0) / last6.length : 0;
  const avgPrev6 = prev6.length ? prev6.reduce((s, d) => s + d.income, 0) / prev6.length : 0;
  const incTrend = avgPrev6 > 0 ? (avgLast6 - avgPrev6) / avgPrev6 : 0;

  const riskLevel: "low" | "medium" | "high" | "critical" =
    posRatio >= 0.85 && incTrend > -0.05 ? "low" :
    posRatio >= 0.65 ? "medium" :
    posRatio >= 0.40 ? "high" : "critical";

  // Personalisation
  const firstName = dbUser?.fullName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";

  // Fix 1: Data freshness uses last IMPORT date, not last transaction date.
  // A user who uploaded 3 years of historical data should NOT see a permanent stale warning.
  const daysSinceImport = lastImport
    ? Math.floor((Date.now() - new Date(lastImport.importedAt).getTime()) / 86_400_000)
    : null;
  const dataIsStale = daysSinceImport !== null && daysSinceImport > 28;

  // Fix 3: First-upload detection — show welcome banner on first arrival after upload
  const isFirstUpload = params.firstUpload === "true" && hasData;

  const rankedInsights = buildHistoricalInsights(
    chartData,
    categoryInsights.topExpenseCategories,
    categoryInsights.yearlySnapshots,
    categoryInsights.seasonality,
    concentration,
    locale
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-2xl font-bold">
              {firstName ? t("welcomeBack", { name: firstName }) : t("title")}
            </h1>
            {hasData && (
              <Link href="/forecast" className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${
                intel.healthStatus === "healthy"  ? "bg-[#4CC4A415] text-[#4CC4A4]" :
                intel.healthStatus === "at-risk"  ? "bg-[#D9707015] text-[#D97070]" :
                                                    "bg-[#D4A25415] text-[#D4A254]"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {intel.healthStatus === "healthy" ? t("health.healthy") : intel.healthStatus === "watch" ? t("health.watch") : t("health.atRisk")}
              </Link>
            )}
          </div>
          <p className="text-[#7BA8C4] text-sm">
            {coverage.latest
              ? t("showingDataThrough", { date: coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" }) })
              : t("noDataYet")}
          </p>
        </div>
        {hasData && (
          <p className="text-xs text-[#6A97B4] flex-shrink-0 mt-1">
            {t("transactionsMonths", { transactions: totalTx, months: nonZeroMonths })}
          </p>
        )}
      </div>

      {/* Data freshness prompt */}
      {dataIsStale && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#D4A2540A] border border-[#D4A25425] rounded-xl">
          <p className="text-sm text-[#D4A254]">
            {t("staleData.message", { days: daysSinceImport ?? 0 })}
          </p>
          <Link href="/upload" className="text-xs font-semibold text-[#D4A254] hover:text-[#E8F0F8] transition-colors flex-shrink-0 bg-[#D4A25420] px-3 py-1.5 rounded-lg">
            {t("staleData.cta")}
          </Link>
        </div>
      )}

      {/* Data coverage banner */}
      {hasData && <DataCoverageBar coverage={coverage} />}

      {/* Fix 3: First-upload welcome banner — shown once after a user's first CSV import */}
      {isFirstUpload && (
        <FirstUploadBanner
          months={nonZeroMonths}
          transactions={totalTx}
          summary={intel.snapshotSummary}
          firstName={firstName}
        />
      )}

      {/* Empty state */}
      {!hasData ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">{t("emptyState.heading")}</h2>
          <p className="text-[#6A97B4] mb-6 max-w-sm mx-auto">
            {t("emptyState.body")}
          </p>
          <Link href="/upload" className="btn-primary inline-block">
            {t("emptyState.cta")}
          </Link>
        </div>
      ) : (
        <>
          <SummaryCards
            current={current}
            previous={previous}
            riskLevel={riskLevel}
            riskPositiveMonths={riskPositiveMonths}
            riskTotalMonths={riskTotalMonths}
            summary={intel.snapshotSummary}
            context={intel.snapshotContext}
            periodLabel={comparison.currLabel}
          />

          {intentBreakdown.hasEnoughDataForDisplay && (
            <BusinessIntelligence
              businessProfit={intentBreakdown.businessProfit}
              profitMarginPct={intentBreakdown.profitMarginPct}
              personalSpend={intentBreakdown.personalSpend}
              trueNetCashflow={intentBreakdown.trueNetCashflow}
              intentInsights={intel.intentInsights}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2">
              <TrendsChart
                data={chartData}
                trajectoryInsight={intel.trajectoryInsight}
                trajectoryDetails={intel.trajectoryDetails}
              />
            </div>
            <ForecastWidget
              forecast={forecast}
              reasons={intel.forecastReasons}
              improvements={intel.forecastImprovements}
              deficitReason={intel.cashflowDeficitReason}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <MonthlyComparisonWidget
              current={comparison.current ?? null}
              previous={comparison.previous ?? null}
              changes={comparison.changes ?? null}
              interpretation={intel.comparisonInterpretation}
              currLabel={comparison.currLabel}
              prevLabel={comparison.prevLabel}
            />
            <RecentTransactions
              transactions={recent}
              notable={intel.notableTransactions}
            />
          </div>

          {rankedInsights.length > 0 && (
            <HistoricalInsights
              insights={rankedInsights}
              totalMonths={nonZeroMonths}
            />
          )}
        </>
      )}
    </div>
  );
}
