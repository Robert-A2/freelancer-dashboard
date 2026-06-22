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
import { getFinancialLifeIntelligence } from "@/lib/financial-life-engine";
import { getClientRiskProfiles } from "@/lib/client-risk-engine";
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

  const [summary, forecast, chartData, comparison, totalTx, coverage, categoryInsights, concentration, dbUser, lastImport, intentBreakdown, financialLife, clientData] =
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
      getFinancialLifeIntelligence(user.id),
      getClientRiskProfiles(user.id),
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

  // Client concentration trend: compares top client's current-month share
  // to their average share across the prior 5 months. Surfaced as a context
  // insight when concentration increased by >15 percentage points.
  let clientConcentrationTrend: { currentPct: number; rollingAvgPct: number; topClientName: string | null } | null = null;
  if (clientData.clients.length > 0) {
    const curIdx = 5; // index 5 = current month in the 6-month window
    const currentMonthTotal = clientData.clients.reduce(
      (sum, c) => sum + (c.monthlyRevenue[curIdx]?.amount ?? 0), 0
    );
    if (currentMonthTotal > 0) {
      const topClient = clientData.clients.reduce((max, c) => {
        const amt = c.monthlyRevenue[curIdx]?.amount ?? 0;
        const maxAmt = max.monthlyRevenue[curIdx]?.amount ?? 0;
        return amt > maxAmt ? c : max;
      });
      const topCurrentAmt = topClient.monthlyRevenue[curIdx]?.amount ?? 0;
      const currentPct = Math.round((topCurrentAmt / currentMonthTotal) * 100);
      const priorData = [0, 1, 2, 3, 4].map(i => ({
        topAmt: topClient.monthlyRevenue[i]?.amount ?? 0,
        total: clientData.clients.reduce((sum, c) => sum + (c.monthlyRevenue[i]?.amount ?? 0), 0),
      })).filter(d => d.total > 0);
      const rollingAvgPct = priorData.length > 0
        ? Math.round(
            (priorData.reduce((s, d) => s + d.topAmt, 0) /
             priorData.reduce((s, d) => s + d.total, 0)) * 100
          )
        : 0;
      clientConcentrationTrend = { currentPct, rollingAvgPct, topClientName: topClient.name };
    }
  }

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
    intentBreakdown.hasEnoughDataForDisplay ? intentBreakdown : null,
    financialLife,
    clientConcentrationTrend
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

  // Clients needing a follow up (RED or overdue YELLOW with a followUp action)
  const followUpClients = clientData.clients.filter((c) =>
    c.actions.some((a) => a.type === "followUp")
  );
  const nudgeClients  = followUpClients.slice(0, 3);
  const nudgeExtra    = Math.max(0, followUpClients.length - 3);

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
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#D4A25412] border border-[#D4A25432] rounded-xl">
          <p className="text-sm text-[#D4A254]">
            {t("staleData.message", { days: daysSinceImport ?? 0 })}
          </p>
          <Link href="/upload" className="text-xs font-semibold text-[#D4A254] hover:text-[#E8F0F8] transition-colors flex-shrink-0 bg-[#D4A25420] px-3 py-1.5 rounded-lg">
            {t("staleData.cta")}
          </Link>
        </div>
      )}

      {/* Data coverage banner */}
      {hasData && <DataCoverageBar coverage={coverage} lastImportedAt={lastImport?.importedAt ?? null} />}

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

          {nudgeClients.length > 0 && (
            <div className="card">
              <p className="label mb-3">{t("clientNudge.label")}</p>
              <div className="space-y-2.5">
                {nudgeClients.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4A254] flex-shrink-0" />
                      <span className="text-sm text-[#C8DCF0] truncate font-medium">{c.name}</span>
                      <span className="text-xs text-[#6A97B4] flex-shrink-0">
                        {t("clientNudge.daysSince", { days: c.currentGapDays })}
                      </span>
                    </div>
                    <Link
                      href={`/clients/${encodeURIComponent(c.name)}`}
                      className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors flex-shrink-0"
                    >
                      {t("clientNudge.cta")}
                    </Link>
                  </div>
                ))}
                {nudgeExtra > 0 && (
                  <div className="flex justify-end pt-1">
                    <Link href="/clients" className="text-xs text-[#4A7A9B] hover:text-[#7BA8C4] transition-colors">
                      {t("clientNudge.andMore", { count: nudgeExtra })}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {intentBreakdown.hasEnoughDataForDisplay ? (
            <BusinessIntelligence
              businessProfit={intentBreakdown.businessProfit}
              profitMarginPct={intentBreakdown.profitMarginPct}
              personalSpend={intentBreakdown.personalSpend}
              trueNetCashflow={intentBreakdown.trueNetCashflow}
              intentInsights={intel.intentInsights}
              lifeInsights={intel.lifeInsights}
            />
          ) : intentBreakdown.totalTransactions > 0 && (
            <div className="flex items-start gap-4 px-5 py-4 bg-[#1A3048] border border-[#243F5E] rounded-2xl">
              <span className="text-[#6A97B4] text-xl flex-shrink-0 mt-0.5">◎</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#A8C6E0] mb-1">
                  {t("businessIntelligence.coverageGate.title")}
                </p>
                <p className="text-sm text-[#6A97B4] leading-relaxed">
                  {t("businessIntelligence.coverageGate.body", { pct: Math.round(intentBreakdown.intentCoveragePct) })}
                </p>
                <Link href="/history" className="inline-block mt-2 text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
                  {t("businessIntelligence.coverageGate.cta")}
                </Link>
              </div>
            </div>
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
