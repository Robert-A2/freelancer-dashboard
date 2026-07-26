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
import { getExpectedIncome, getRecentlyPaidMilestones } from "@/lib/milestone-engine";
import { getRunway } from "@/lib/runway-engine";
import { generateDashboardIntelligence, buildHistoricalInsights } from "@/lib/intelligence-engine";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/utils/finance";
import { getMonthlyVerdictKey } from "@/utils/monthlyVerdict";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import SummaryCards from "@/components/dashboard/SummaryCards";
import PaymentReceivedBanner from "@/components/dashboard/PaymentReceivedBanner";
import ExpectedIncomeCard from "@/components/dashboard/ExpectedIncomeCard";
import RunwayCard from "@/components/dashboard/RunwayCard";
import ProjectsPromoCard from "@/components/dashboard/ProjectsPromoCard";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import ForecastWidget from "@/components/dashboard/ForecastWidget";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import HistoricalInsights from "@/components/dashboard/HistoricalInsights";
import BusinessIntelligence from "@/components/dashboard/BusinessIntelligence";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import FirstUploadBanner from "@/components/dashboard/FirstUploadBanner";
import AccountFilterBar from "@/components/dashboard/AccountFilterBar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ firstUpload?: string; accountId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("dashboard");
  const locale = (await getLocale()) as Locale;

  const params = await searchParams;
  const accountId = params.accountId ?? null;

  const [[
    summary, forecast, chartData, comparison, totalTx, coverage,
    categoryInsights, concentration, dbUser, lastImport, intentBreakdown,
    financialLife, clientData, expectedIncome, recentPayments, runway,
  ], accounts] = await Promise.all([
    Promise.all([
      getDashboardSummary(user.id, accountId),
      getLatestForecast(user.id),
      getHistoricalData(user.id, 999, accountId),
      getMonthlyComparison(user.id, accountId),
      prisma.transaction.count({ where: { userId: user.id, ...(accountId ? { accountId } : {}) } }),
      getDataCoverage(user.id, accountId),
      getCategoryInsights(user.id, accountId),
      getIncomeConcentration(user.id, accountId),
      prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
      // Fix 1: use last IMPORT date for freshness, not last transaction date.
      // Using transaction dates caused a permanent warning for any historical upload.
      prisma.csvImport.findFirst({
        where: { userId: user.id, status: "completed" },
        orderBy: { importedAt: "desc" },
        select: { importedAt: true },
      }),
      getIntentBreakdown(user.id, undefined, undefined, accountId),
      getFinancialLifeIntelligence(user.id, accountId),
      getClientRiskProfiles(user.id, accountId),
      getExpectedIncome(user.id),
      getRecentlyPaidMilestones(user.id),
      getRunway(user.id),
    ]),
    // An account whose last transaction was removed (e.g. its only CSV import
    // got deleted) has no data left to filter by — showing it as a live tab
    // makes deleted data look like it's still there. transactions: { some: {} }
    // excludes any account with zero remaining transactions.
    prisma.account.findMany({
      where: { userId: user.id, isArchived: false, transactions: { some: {} } },
      select: { id: true, name: true, color: true },
      orderBy: { createdAt: "asc" },
    }),
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
    accountName: tx.account?.name ?? null,
    accountColor: tx.account?.color ?? null,
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
    clientConcentrationTrend,
    comparison.currLabel,
    comparison.isPartialMonth
  );

  const hasData = totalTx > 0;
  // A user who has only ever created Projects/milestones (no CSV upload, no
  // paid milestone yet) has zero Transaction rows and would otherwise hit the
  // pure "Upload CSV" empty state below — hiding the projects they actually
  // created. Runway is computed straight from Project/Milestone rows (see
  // runway-engine.ts), so runway !== null is exactly "has used the invoicing
  // side of the platform," independent of CSV data.
  const hasProjects = runway !== null;
  const hasAnyActivity = hasData || hasProjects;
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
  const incTrendPct = Math.round(incTrend * 100);

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

  // Coverage staleness: detects when the transaction data itself ends many months
  // before today — regardless of when the user last imported. A user who uploaded
  // three years of old statements would have a recent import date but stale coverage.
  const _now = new Date();
  const coverageMonthsAgo = coverage.latest != null
    ? (_now.getFullYear() - coverage.latest.getUTCFullYear()) * 12 +
      (_now.getMonth() - coverage.latest.getUTCMonth())
    : null;
  const coverageIsStale = coverageMonthsAgo !== null && coverageMonthsAgo >= 2 && hasData;
  const coverageLatestLabel = coverage.latest != null
    ? coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" })
    : null;

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

  // Peek subtitles — the headline number for each collapsed-by-default section,
  // computed here so it's visible even before the user expands the section.
  const businessIntelligencePeek = intentBreakdown.hasEnoughDataForDisplay
    ? t("businessIntelligence.peek", {
        margin: intentBreakdown.profitMarginPct !== null ? Math.round(intentBreakdown.profitMarginPct) : 0,
        personalSpend: formatCurrency(intentBreakdown.personalSpend, locale),
      })
    : undefined;

  const monthlyPreviousHasData = !!(comparison.previous && (comparison.previous.totalIncome > 0 || comparison.previous.totalExpenses > 0));
  const monthlyVerdictBase = monthlyPreviousHasData ? getMonthlyVerdictKey(comparison.changes) : null;
  const monthlyVerdictKey = monthlyVerdictBase
    ? (coverageIsStale ? `${monthlyVerdictBase}History` : monthlyVerdictBase)
    : null;
  const monthlyComparisonPeek = monthlyVerdictKey
    ? t(`monthlyComparison.${monthlyVerdictKey}`, coverageIsStale ? { currMonth: comparison.currLabel } : undefined)
    : undefined;

  const historicalInsightsPeek = t("historicalInsights.monthsOfHistory", { count: nonZeroMonths });

  return (
    <div className="space-y-8">
      <AccountFilterBar accounts={accounts} selectedAccountId={accountId} />

      {/* Header — question first, verdict below, data context last */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          {firstName && (
            <p className="text-xs text-[#6A97B4] mb-1">{t("welcomeBack", { name: firstName })}</p>
          )}
          <h1 className="text-2xl font-bold">
            {hasData ? t("questionTitle") : t("title")}
          </h1>
          {hasData ? (
            <p className={`text-sm font-medium mt-0.5 ${
              intel.healthStatus === "healthy" ? "text-[#4CC4A4]" :
              intel.healthStatus === "at-risk"  ? "text-[#D97070]" :
                                                  "text-[#D4A254]"
            }`}>
              {intel.healthStatus === "healthy" ? t("verdictHealthy") :
               intel.healthStatus === "at-risk"  ? t("verdictAtRisk") :
                                                   t("verdictWatch")}
            </p>
          ) : hasProjects ? (
            <p className="text-[#7BA8C4] text-sm mt-0.5">{t("projectsOnlyYet")}</p>
          ) : (
            <p className="text-[#7BA8C4] text-sm mt-0.5">{t("noDataYet")}</p>
          )}
          {coverage.latest && (
            <p className="text-xs text-[#4A7A9B] mt-1">
              {t("showingDataThrough", { date: coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" }) })}
            </p>
          )}
        </div>
        {hasData && (
          <p className="text-xs text-[#6A97B4] flex-shrink-0 mt-1">
            {t("transactionsMonths", { transactions: totalTx, months: nonZeroMonths })}
          </p>
        )}
      </div>

      {recentPayments.length > 0 && <PaymentReceivedBanner payments={recentPayments} locale={locale} />}

      {/* Data freshness — coverage stale (data ends months ago) takes priority over
          import-date stale (haven't imported recently but data itself is current) */}
      {coverageIsStale && coverageLatestLabel ? (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#D4A25412] border border-[#D4A25432] rounded-xl">
          <p className="text-sm text-[#D4A254]">
            {t("coverageStale.message", { month: coverageLatestLabel })}
          </p>
          <Link href="/upload" className="text-xs font-semibold text-[#D4A254] hover:text-[#E8F0F8] transition-colors flex-shrink-0 bg-[#D4A25420] px-3 py-1.5 rounded-lg">
            {t("coverageStale.cta")}
          </Link>
        </div>
      ) : dataIsStale ? (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#D4A25412] border border-[#D4A25432] rounded-xl">
          <p className="text-sm text-[#D4A254]">
            {t("staleData.message", { days: daysSinceImport ?? 0 })}
          </p>
          <Link href="/upload" className="text-xs font-semibold text-[#D4A254] hover:text-[#E8F0F8] transition-colors flex-shrink-0 bg-[#D4A25420] px-3 py-1.5 rounded-lg">
            {t("staleData.cta")}
          </Link>
        </div>
      ) : null}

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

      {/* Empty state — only when the user has used neither side of the
          platform yet (no CSV import AND no project ever created) */}
      {!hasAnyActivity ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">{t("emptyState.heading")}</h2>
          <p className="text-[#6A97B4] mb-6 max-w-sm mx-auto">
            {t("emptyState.body")}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/upload" className="btn-primary inline-block">
              {t("emptyState.cta")}
            </Link>
            <Link href="/projects" className="text-sm font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
              {t("emptyState.ctaProjects")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {hasData && (
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
              isPartialMonth={comparison.isPartialMonth}
            />
          )}

          {runway === null ? (
            <ProjectsPromoCard />
          ) : (
            <>
              {/* Full-width, not paired in a grid — this is the number freelancers
                  actually check daily, it gets the visual weight to match. */}
              <RunwayCard data={runway} locale={locale} />
              <ExpectedIncomeCard data={expectedIncome} locale={locale} />
            </>
          )}

          {hasProjects && !hasData && (
            <div className="flex items-start gap-4 px-5 py-4 bg-[#1A3048] border border-[#243F5E] rounded-2xl">
              <span className="text-[#6A97B4] text-xl flex-shrink-0 mt-0.5">◎</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#A8C6E0] mb-1">{t("noCsvYet.title")}</p>
                <p className="text-sm text-[#6A97B4] leading-relaxed">{t("noCsvYet.body")}</p>
                <Link href="/upload" className="inline-block mt-2 text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
                  {t("noCsvYet.cta")}
                </Link>
              </div>
            </div>
          )}

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

          {hasData && (intentBreakdown.hasEnoughDataForDisplay ? (
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
          ))}

          {hasData && (
            <div className={`grid grid-cols-1 gap-6 md:gap-8 ${!accountId ? "lg:grid-cols-3" : ""}`}>
              <div className={!accountId ? "lg:col-span-2" : ""}>
                <TrendsChart
                  data={chartData}
                  trajectoryInsight={intel.trajectoryInsight}
                  trajectoryDetails={intel.trajectoryDetails}
                  riskLevel={riskLevel}
                />
              </div>
              {!accountId && <ForecastWidget
                forecast={forecast}
                reasons={intel.forecastReasons}
                improvements={intel.forecastImprovements}
                deficitReason={intel.cashflowDeficitReason}
              />}
            </div>
          )}

          {hasData && (
            <CollapsibleSection
              label={t("monthlyComparison.monthlySummary")}
              title={coverageIsStale
                ? t("monthlyComparison.labelHistorical", { currMonth: comparison.currLabel ?? "", prevMonth: comparison.prevLabel ?? "" })
                : t("monthlyComparison.label")}
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
          )}

          {hasData && (
            <RecentTransactions
              transactions={recent}
              notable={intel.notableTransactions}
            />
          )}

          {hasData && rankedInsights.length > 0 && (
            <CollapsibleSection
              label={t("historicalInsights.label")}
              title={t("historicalInsights.title")}
              subtitle={historicalInsightsPeek}
              defaultOpen={false}
            >
              <HistoricalInsights
                insights={rankedInsights}
                totalMonths={nonZeroMonths}
              />
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
}
