import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo/transactions";
import { generateDashboardIntelligence, computeCashflowRisk } from "@/lib/intelligence-engine";
import { formatCurrency } from "@/utils/finance";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import InsightText from "@/components/ui/InsightText";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Kept in lockstep with (dashboard)/dashboard/page.tsx — same two-layer
// structure, same shared components, same risk/health logic. Only the data
// source differs (getDemoDataset()/DEMO_TRANSACTIONS instead of Prisma) and
// there's no AccountFilterBar (the demo has no multi-account concept). See
// that file's own header comment for why the page is scoped this way.
export default async function DemoDashboardPage() {
  const t  = await getTranslations("dashboard");
  const tf = await getTranslations("forecast");
  const locale = (await getLocale()) as Locale;

  const {
    chartData, summary, comparison, coverage, categoryInsights,
    concentration, intentBreakdown, forecast, financialLife,
    clientData, totalTx, personaFirstName,
  } = getDemoDataset(locale);

  const current  = summary.current;
  const previous = summary.previous;

  const recent = summary.recent.map((tx) => ({
    id: tx.id,
    date: tx.transactionDate.toISOString(),
    description: tx.description,
    amount: tx.amount,
    type: tx.transactionType,
    category: tx.category,
    intent: tx.intent,
    intentConfidence: tx.intentConfidence,
    needsReview: tx.needsReview,
  }));

  // Client concentration trend — identical calculation to the real dashboard.
  let clientConcentrationTrend: { currentPct: number; rollingAvgPct: number; topClientName: string | null } | null = null;
  if (clientData.clients.length > 0) {
    const curIdx = 5;
    const currentMonthTotal = clientData.clients.reduce((sum, c) => sum + (c.monthlyRevenue[curIdx]?.amount ?? 0), 0);
    if (currentMonthTotal > 0) {
      const topClient = clientData.clients.reduce((max, c) => {
        const amt = c.monthlyRevenue[curIdx]?.amount ?? 0;
        const maxAmt = max.monthlyRevenue[curIdx]?.amount ?? 0;
        return amt > maxAmt ? c : max;
      });
      const topCurrentAmt = topClient.monthlyRevenue[curIdx]?.amount ?? 0;
      const currentPct = Math.round((topCurrentAmt / currentMonthTotal) * 100);
      const priorData = [0, 1, 2, 3, 4].map((i) => ({
        topAmt: topClient.monthlyRevenue[i]?.amount ?? 0,
        total: clientData.clients.reduce((sum, c) => sum + (c.monthlyRevenue[i]?.amount ?? 0), 0),
      })).filter((d) => d.total > 0);
      const rollingAvgPct = priorData.length > 0
        ? Math.round((priorData.reduce((s, d) => s + d.topAmt, 0) / priorData.reduce((s, d) => s + d.total, 0)) * 100)
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
    false // isPartialMonth — the demo dataset has no notion of an in-progress month
  );

  const hasData = totalTx > 0;

  // Risk level — same shared computeCashflowRisk the real dashboard and
  // Forecast page use (tax-payment adjustment included), not a hand-rolled
  // copy, so the demo can never show a different verdict than the real
  // pages would for equivalent data.
  const taxPaymentTxs = DEMO_TRANSACTIONS.filter((tx) => tx.intent === "tax_payment" && tx.transactionType === "expense");
  const { riskLevel } = computeCashflowRisk(
    chartData,
    taxPaymentTxs.map((tx) => ({ transactionDate: tx.transactionDate, amount: tx.amount }))
  );

  const coverageMonthsAgo = coverage.latest != null
    ? (new Date().getFullYear() - coverage.latest.getUTCFullYear()) * 12 +
      (new Date().getMonth() - coverage.latest.getUTCMonth())
    : null;
  const coverageIsStale = coverageMonthsAgo !== null && coverageMonthsAgo >= 2 && hasData;

  const cashPosition = chartData.reduce((sum, d) => sum + d.cashflow, 0);

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

  // Cashflow Risk, not Forecast Health — a business can look profitable and
  // still run out of cash, which is the more visceral, concrete risk a demo
  // visitor actually understands at a glance. Reuses the same computeCashflowRisk
  // result already driving the risk/opportunity cards and TrendsChart below,
  // so this tile can never disagree with the rest of the page.
  const riskBadgeKey: "good" | "warning" | "critical" = riskLevel === "low" ? "good" : riskLevel === "medium" ? "warning" : "critical";

  const summarySurface: Record<string, string> = {
    healthy: "surface-teal",
    watch: "surface-warning",
    "at-risk": "surface-risk",
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-[#6A97B4] mb-1">{t("welcomeBack", { name: personaFirstName })}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
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
            <Link href="/signup" className="btn-primary inline-block">
              {t("emptyState.cta")}
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
              <p className="label mb-2">{tf("cashflowRiskLabel")}</p>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${badgeClass[riskBadgeKey]}`}>
                {tf(`cashflowRisk.${riskLevel}.label`)}
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

          {/* ── Layer 2 — why it changed, then stop ────────────────────── */}

          <div className="pt-2 border-t border-[#25405A]">
            <TrendsChart
              data={chartData}
              trajectoryInsight={intel.trajectoryInsight}
              trajectoryDetails={intel.trajectoryDetails}
              riskLevel={riskLevel}
              apiBase="/api/demo"
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
