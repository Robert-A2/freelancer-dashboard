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
import { generateDashboardIntelligence } from "@/lib/intelligence-engine";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/utils/finance";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import InsightText from "@/components/ui/InsightText";
import AccountFilterBar from "@/components/dashboard/AccountFilterBar";
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

  const t  = await getTranslations("dashboard");
  const tf = await getTranslations("forecast");
  const locale = (await getLocale()) as Locale;

  const params = await searchParams;
  const accountId = params.accountId ?? null;

  const [[
    summary, forecast, chartData, comparison, totalTx, coverage,
    categoryInsights, concentration, dbUser, intentBreakdown,
    financialLife, clientData,
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
      getIntentBreakdown(user.id, undefined, undefined, accountId),
      getFinancialLifeIntelligence(user.id, accountId),
      getClientRiskProfiles(user.id, accountId),
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

  // Risk computed from historical data — mirrors forecast/page.tsx's cashflow risk
  // calculation exactly (including the income-trend check) so the Dashboard and
  // Forecast pages never disagree on the same data. Feeds TrendsChart's own
  // trajectory-box coloring only; not shown as a standalone tile any more.
  const activeMonths = chartData.filter(d => d.income > 0 || d.expenses > 0);
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

  // Layer 1, tile 2: "cash available today" has no literal bank-balance
  // concept in this app (no live account sync) — the honest equivalent is
  // the cumulative net cashflow across every tracked month, clearly
  // captioned as such rather than implied to be a live balance.
  const cashPosition = chartData.reduce((sum, d) => sum + d.cashflow, 0);

  // Layer 1, tile 3: a 3-state read of the existing forecast, not a new
  // engine — negative projected cashflow is Critical regardless of
  // confidence; a positive projection the engine itself isn't confident in
  // is Warning, not Good.
  const forecastHealth: "good" | "warning" | "critical" | "unknown" =
    !forecast ? "unknown" :
    forecast.projectedCashflow < 0 ? "critical" :
    forecast.confidence === "low" ? "warning" :
    "good";

  const healthKey = intel.healthStatus === "at-risk" ? "atRisk" : intel.healthStatus;
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
        <h1 className="text-2xl font-bold">
          {hasData ? t("questionTitle") : t("title")}
        </h1>
        {coverage.latest && (
          <p className={`text-xs mt-1 ${coverageIsStale ? "text-[#D4A254]" : "text-[#4A7A9B]"}`}>
            {t("showingDataThrough", { date: coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" }) })}
          </p>
        )}
      </div>

      {!hasData ? (
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
          {/* ── Layer 1 — the state of the business, in one glance ──────── */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-sm">
              <p className="label mb-2">{t("businessHealth.label")}</p>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${badgeClass[healthKey]}`}>
                {t(`health.${healthKey}`)}
              </span>
            </div>
            <div className="card-sm">
              <p className="label mb-2">{t("cashPosition.label")}</p>
              <p className="text-xl font-bold text-[#E8F0F8] tabular-nums">{formatCurrency(cashPosition, locale)}</p>
              <p className="text-[11px] text-[#6A97B4] mt-1">{t("cashPosition.caption")}</p>
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
    </div>
  );
}
