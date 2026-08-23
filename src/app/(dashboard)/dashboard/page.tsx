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
import { needsOnboarding } from "@/lib/onboarding";
import { getTodayFacts } from "@/lib/today-facts";
import { getDataMaturity, getCashRunway, MATURITY_THRESHOLDS } from "@/lib/data-maturity";
import { getFinancialLifeIntelligence } from "@/lib/financial-life-engine";
import { getClientRiskProfiles } from "@/lib/client-risk-engine";
import { generateDashboardIntelligence, computeCashflowRisk } from "@/lib/intelligence-engine";
import { getMoneyBreakdown } from "@/lib/money-breakdown";
import { getManualAccountKind } from "@/lib/manual-accounts";
import { prisma } from "@/lib/prisma";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import InsightText from "@/components/ui/InsightText";
import AccountFilterBar from "@/components/dashboard/AccountFilterBar";
import TodayLayer from "@/components/dashboard/TodayLayer";
import MoneyBreakdownCard from "@/components/dashboard/MoneyBreakdownCard";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import PersonalDashboard from "@/components/dashboard/PersonalDashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

// The Dashboard has exactly one job: "what's the state of my business, in
// under 30 seconds" — never a scroll-forever feed. Two layers only:
//   Layer 1 (no scroll) — health score, cash position, forecast health,
//     biggest risk, biggest opportunity, one-line summary. Done.
//   Layer 2 (one scroll, then stop) — income/expense/cashflow trend,
//     monthly comparison.
// Everything else (runway, expected income, clients, business intelligence,
// transactions, historical patterns, forecasting detail) is a different
// question with its own dedicated page — reached by navigating there, not
// by scrolling further down this one.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (await needsOnboarding(user.id)) redirect("/onboarding");

  const t  = await getTranslations("dashboard");
  const tf = await getTranslations("forecast");
  const tToday = await getTranslations("manual.today");
  const tLearning = await getTranslations("manual.learning");
  const locale = (await getLocale()) as Locale;

  const params = await searchParams;
  const accountId = params.accountId ?? null;

  // Which manual account (if any) is selected — the Personal view answers a
  // completely different set of questions than Business (spec: "The
  // Personal dashboard should not simply reuse the Business dashboard's
  // financial meaning"), so it's handled as an early, separate branch
  // rather than threading a dozen conditionals through the Business layout
  // below. Same visual language (card-sm grid), genuinely different data.
  const accountKind = await getManualAccountKind(accountId);

  const accounts = await prisma.account.findMany({
    where: { userId: user.id, isArchived: false, transactions: { some: {} } },
    select: { id: true, name: true, color: true },
    orderBy: { createdAt: "asc" },
  });

  if (accountKind === "personal") {
    const [facts, runway, personalUser, personalSummary] = await Promise.all([
      getTodayFacts(user.id, accountId),
      getCashRunway(user.id, accountId),
      prisma.user.findUnique({ where: { id: user.id }, select: { personalSpendingEstimate: true } }),
      getDashboardSummary(user.id, accountId),
    ]);
    const recent = personalSummary.recent.map((tx) => ({
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

    return (
      <div className="space-y-6">
        <AccountFilterBar accounts={accounts} selectedAccountId={accountId} />
        <div>
          <h1 className="text-2xl font-bold">{t("personalTitle")}</h1>
        </div>
        <PersonalDashboard
          facts={facts}
          runway={runway}
          personalSpendingEstimate={personalUser?.personalSpendingEstimate != null ? Number(personalUser.personalSpendingEstimate) : null}
          recentTransactions={recent}
          locale={locale}
        />
      </div>
    );
  }

  const [
    summary, forecast, chartData, comparison, totalTx, coverage,
    categoryInsights, concentration, dbUser, intentBreakdown,
    financialLife, clientData, taxPaymentTxs, todayFacts, maturity, moneyBreakdown,
  ] = await Promise.all([
    getDashboardSummary(user.id, accountId),
    getLatestForecast(user.id),
    getHistoricalData(user.id, 999, accountId),
    getMonthlyComparison(user.id, accountId),
    prisma.transaction.count({ where: { userId: user.id, ...(accountId ? { accountId } : {}) } }),
    getDataCoverage(user.id, accountId),
    getCategoryInsights(user.id, accountId),
    getIncomeConcentration(user.id, accountId),
    prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
    getIntentBreakdown(user.id, undefined, undefined, accountId),
    getFinancialLifeIntelligence(user.id, accountId),
    getClientRiskProfiles(user.id, accountId),
    // Feeds computeCashflowRisk below — same tax-payment adjustment the
    // Forecast page applies, so the two pages can't disagree on risk level.
    prisma.transaction.findMany({
      where: { userId: user.id, intent: "tax_payment", transactionType: "expense", ...(accountId ? { accountId } : {}) },
      select: { transactionDate: true, amount: true },
    }),
    // Today layer (spec section 10) — works from Day 1 off a cash
    // checkpoint alone, no transaction history required.
    getTodayFacts(user.id, accountId),
    // Data maturity (spec section 15-16) — gates whether Business Health
    // and the rest of the "known-history" cards below may compute a real
    // answer yet, or must show a "Learning" state instead.
    getDataMaturity(user.id),
    // Money Breakdown (Core Money Intelligence spec) — the one shared
    // tax reserve / commitments / available-after-protections calculation,
    // read here and also by Quick Add's reward and the Expected Payment
    // detail view. Never recomputed independently.
    getMoneyBreakdown(user.id, accountId),
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
  // to their average share across the prior 5 months. Feeds the intelligence
  // engine's "biggest risk" pick below (client-concentration risk branch).
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
  // A user who has only set a starting cash position (onboarding Step 1,
  // nothing else) has no transactions yet but still has a real, useful
  // Today layer — spec section 4's "Finish → real dashboard, never CSV
  // upload" and section 42 Scenario A ("dashboard must still be useful").
  const hasAnyFinancialSetup = hasData || todayFacts.hasCurrentCash;
  // Business Health / Forecast Health aren't allowed to sound confident off
  // a handful of days of activity (spec sections 16-17) — gated on complete
  // calendar months, not raw days, so a mid-month CSV import of a full prior
  // year still reads as mature immediately (scenario F/36 stays untouched).
  const hasEnoughHistoryForHealth = maturity.completeMonths >= MATURITY_THRESHOLDS.MIN_COMPLETE_MONTHS_FOR_HEALTH;

  // Risk level — shared with forecast/page.tsx via computeCashflowRisk (includes
  // the tax-payment adjustment) so the Dashboard and Forecast pages, and every
  // TrendsChart instance, can never disagree on the same data. Feeds TrendsChart's
  // own trajectory-box coloring only; not shown as a standalone tile any more.
  const { riskLevel } = computeCashflowRisk(
    chartData,
    taxPaymentTxs.map(tx => ({ transactionDate: tx.transactionDate, amount: Number(tx.amount) }))
  );

  // Personalisation
  const firstName = dbUser?.fullName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";

  // Coverage staleness: the transaction data itself ends many months before
  // today — regardless of import date. Folded into the header caption's
  // color rather than a separate banner; a health score built on stale data
  // deserves a visible caveat, not a whole extra section.
  const _now = new Date();
  const coverageMonthsAgo = coverage.latest != null
    ? (_now.getFullYear() - coverage.latest.getUTCFullYear()) * 12 +
      (_now.getMonth() - coverage.latest.getUTCMonth())
    : null;
  const coverageIsStale = coverageMonthsAgo !== null && coverageMonthsAgo >= 2 && hasData;

  // Layer 1, tile 2 (Forecast Health below): a read of the existing forecast, not a new engine —
  // negative projected cashflow is Critical regardless of confidence; a
  // positive projection the engine itself isn't confident in is Warning,
  // not Good. Margin is checked too, at the same 20% bar the forecast page's
  // own "marginLow"/"marginHealthy" copy already uses elsewhere (see
  // computeConfidence's caller in intelligence-engine.ts) — a razor-thin
  // positive margin (e.g. +€1/month) is real, but calling it "Good" the same
  // as a comfortable margin overclaims. Confirmed for real: this badge would
  // otherwise say "Good" for any positive-cashflow, non-low-confidence
  // forecast regardless of how thin the margin actually was.
  const forecastCashflowMarginPct = forecast && forecast.projectedIncome > 0
    ? (forecast.projectedCashflow / forecast.projectedIncome) * 100
    : null;
  const forecastHealth: "good" | "warning" | "critical" | "unknown" =
    !hasEnoughHistoryForHealth ? "unknown" :
    !forecast ? "unknown" :
    forecast.projectedCashflow < 0 ? "critical" :
    forecast.confidence === "low" ? "warning" :
    forecastCashflowMarginPct !== null && forecastCashflowMarginPct < 20 ? "warning" :
    "good";

  // "learning" reuses forecastHealth's own "Not enough data" styling/copy —
  // no separate Learning-state translation needed, same honest meaning.
  const healthKey = !hasEnoughHistoryForHealth ? "unknown" : intel.healthStatus === "at-risk" ? "atRisk" : intel.healthStatus;
  const badgeClass: Record<string, string> = {
    healthy: "text-[#4CC4A4] bg-[#234A40]",
    watch: "text-[#D4A254] bg-[#332C1A]",
    atRisk: "text-[#E5484D] bg-[#4A2A2A]",
    good: "text-[#4CC4A4] bg-[#234A40]",
    warning: "text-[#D4A254] bg-[#332C1A]",
    critical: "text-[#E5484D] bg-[#4A2A2A]",
    unknown: "text-[#7BA8C4] bg-[#1E3446]",
  };

  const summarySurface: Record<string, string> = {
    healthy: "surface-teal",
    watch: "surface-warning",
    "at-risk": "surface-risk",
  };

  return (
    <div className="space-y-6">
      <AccountFilterBar accounts={accounts} selectedAccountId={accountId} />

      {/* Header — no verdict sentence here any more; the health badge and
          summary card below carry that job now, without repeating it. */}
      <div>
        {firstName && (
          <p className="text-xs text-[#6A97B4] mb-1">{t("welcomeBack", { name: firstName })}</p>
        )}
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {coverage.latest && (
          <p className={`text-xs mt-1 ${coverageIsStale ? "text-[#D4A254]" : "text-[#4A7A9B]"}`}>
            {t("showingDataThrough", { date: coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" }) })}
          </p>
        )}
      </div>

      {!hasAnyFinancialSetup ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">{t("emptyState.heading")}</h2>
          <p className="text-[#6A97B4] mb-6 max-w-sm mx-auto">
            {t("emptyState.body")}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/onboarding" className="btn-primary inline-block">
              {tToday("setUpFinances")}
            </Link>
            <Link href="/upload" className="text-sm font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
              {t("emptyState.cta")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── Today layer — factual, works from Day 1 (spec section 10) ── */}
          <TodayLayer facts={todayFacts} locale={locale} />

          {/* ── Your money — protected vs. available, one shared engine ── */}
          <MoneyBreakdownCard breakdown={moneyBreakdown} locale={locale} />

          {!hasData ? (
            <div className="card text-center py-10">
              <p className="text-sm text-[#A8C6E0] max-w-sm mx-auto">{tToday("noActivityYet")}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="label mb-3">{tToday("recentActivity")}</p>
                <RecentTransactions transactions={recent} notable={intel.notableTransactions} />
                <Link href="/history" className="block text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4] mt-3">
                  {tToday("viewAllActivity")}
                </Link>
              </div>

          {/* ── Layer 1 — the state of the business, in one glance ──────── */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card-sm">
              <p className="label mb-2">{t("businessHealth.label")}</p>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${badgeClass[healthKey]}`}>
                {t(`health.${healthKey}`)}
              </span>
              {!hasEnoughHistoryForHealth && (
                <p className="text-[11px] text-[#6A97B4] mt-2">
                  {tLearning("businessHealth.body", { days: maturity.historyDays })}
                </p>
              )}
            </div>
            <div className="card-sm">
              <p className="label mb-2">{t("forecastHealth.label")}</p>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${badgeClass[forecastHealth]}`}>
                {t(`forecastHealth.${forecastHealth}`)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface-risk rounded-2xl p-5">
              <p className="label mb-2">{tf("biggestRisk.label")}</p>
              <p className="text-sm text-[#E8F0F8] leading-relaxed">
                {intel.biggestRisk ? <InsightText insight={intel.biggestRisk} accent="#E5484D" /> : tf("biggestRisk.fallback")}
              </p>
            </div>
            <div className="surface-teal rounded-2xl p-5">
              <p className="label mb-2">{tf("biggestOpportunity.label")}</p>
              <p className="text-sm text-[#E8F0F8] leading-relaxed">
                {intel.biggestOpportunity ? <InsightText insight={intel.biggestOpportunity} accent="#4CC4A4" /> : tf("biggestOpportunity.fallback")}
              </p>
            </div>
          </div>

          {intel.snapshotSummary && (
            <div className={`${summarySurface[intel.healthStatus]} rounded-2xl p-5`}>
              <p className="label mb-2">{t("summary.label")}</p>
              <p className="text-sm font-medium text-[#E8F0F8] leading-relaxed">
                <InsightText insight={intel.snapshotSummary} />
              </p>
            </div>
          )}

          {/* ── Layer 2 — why it changed, then stop ──────────────────────
              Everything below this point answers "why," never "what else."
              Runway, clients, business intelligence, transactions, and
              historical patterns are a click away in the nav, not a
              scroll away on this page. */}

          <div className="pt-2 border-t border-[#25405A]">
            <TrendsChart
              data={chartData}
              trajectoryInsight={intel.trajectoryInsight}
              trajectoryDetails={intel.trajectoryDetails}
              riskLevel={riskLevel}
            />
          </div>

          <div>
            <p className="label mb-1">{t("monthlyComparison.monthlySummary")}</p>
            <h2 className="text-lg font-semibold text-[#E8F0F8] mb-4">
              {coverageIsStale
                ? t("monthlyComparison.labelHistorical", { currMonth: comparison.currLabel ?? "", prevMonth: comparison.prevLabel ?? "" })
                : t("monthlyComparison.label")}
            </h2>
            <MonthlyComparisonWidget
              current={comparison.current ?? null}
              previous={comparison.previous ?? null}
              changes={comparison.changes ?? null}
              interpretation={intel.comparisonInterpretation}
              suggestion={intel.comparisonSuggestion}
              currLabel={comparison.currLabel}
              prevLabel={comparison.prevLabel}
            />
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
