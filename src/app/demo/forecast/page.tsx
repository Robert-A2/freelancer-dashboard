import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { DEMO_TAX_PROFILE, DEMO_REF_DATE } from "@/lib/demo/transactions";
import { generateDashboardIntelligence, computeCashflowRisk } from "@/lib/intelligence-engine";
import { projectMoneyBreakdownWithPayment } from "@/lib/money-breakdown";
import { calculateFrenchMicroReserve } from "@/lib/tax/france/calculate-reserve";
import { formatCurrency } from "@/utils/finance";
import TrendsChart from "@/components/dashboard/TrendsChart";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import InsightText from "@/components/ui/InsightText";
import YearEndProjectionCard from "@/components/forecast/YearEndProjectionCard";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Kept in lockstep with (dashboard)/forecast/page.tsx — same sections, same
// shared computeCashflowRisk risk math, same banners, same Runway and
// Upcoming Cash 30/60/90 cards (sourced from src/lib/demo/engine.ts's
// computeCashRunway/computeUpcomingCashWindow — see that file's comments for
// why the demo can produce these where it previously couldn't). No demo
// equivalent of ExpectedFromProjectsCard: the demo persona has no Projects/
// milestones entities at all, and the real component itself renders nothing
// for any project-less user (returns null when expectedCount === 0) — so
// omitting it here produces the identical visual outcome, not a gap.
export default async function DemoForecastPage() {
  const t      = await getTranslations("forecast");
  const td     = await getTranslations("dashboard");
  const tCategories = await getTranslations("categories");
  const tRunway = await getTranslations("manual.learning.runway");
  const locale = (await getLocale()) as Locale;

  const bold = (chunks: React.ReactNode) => <strong className="text-[#E8F0F8] font-semibold">{chunks}</strong>;

  const HEALTH = {
    healthy:   { label: td("health.healthy"), bg: "bg-[#4CC4A40A]", border: "border-[#4CC4A425]", text: "text-[#4CC4A4]", bar: "bg-[#4CC4A4]" },
    watch:     { label: td("health.watch"),   bg: "bg-[#D4A2540A]", border: "border-[#D4A25425]", text: "text-[#D4A254]", bar: "bg-[#D4A254]" },
    "at-risk": { label: td("health.atRisk"),  bg: "bg-[#E5484D0A]", border: "border-[#E5484D25]", text: "text-[#E5484D]", bar: "bg-[#E5484D]" },
  };

  const TREND = {
    improving: { label: t("trend.improving"), bg: "bg-[#4CC4A415]", text: "text-[#4CC4A4]" },
    stable:    { label: t("trend.stable"),    bg: "bg-[#1A3048]",   text: "text-[#7BA8C4]" },
    weakening: { label: t("trend.weakening"), bg: "bg-[#E5484D15]", text: "text-[#E5484D]" },
  };

  const RISK_CONFIG = {
    low:      { label: t("cashflowRisk.low.label"),      desc: t("cashflowRisk.low.desc"),      bg: "bg-[#4CC4A40A]", border: "border-[#4CC4A425]", text: "text-[#4CC4A4]" },
    medium:   { label: t("cashflowRisk.medium.label"),   desc: t("cashflowRisk.medium.desc"),   bg: "bg-[#D4A2540A]", border: "border-[#D4A25425]", text: "text-[#D4A254]" },
    high:     { label: t("cashflowRisk.high.label"),     desc: t("cashflowRisk.high.desc"),     bg: "bg-[#E5484D0A]", border: "border-[#E5484D25]", text: "text-[#E5484D]" },
    critical: { label: t("cashflowRisk.critical.label"), desc: t("cashflowRisk.critical.desc"), bg: "bg-[#E5484D0A]", border: "border-[#E5484D25]", text: "text-[#E5484D]" },
  };

  const {
    chartData, summary, comparison, coverage, categoryInsights,
    concentration, intentBreakdown, forecast, dataGaps,
    todayFacts, cashRunway, upcomingCashWindow, moneyBreakdown,
  } = getDemoDataset(locale);

  // "If this arrives" scenario — same real, pure projectMoneyBreakdownWithPayment
  // the real Forecast page uses, fed the real calculateFrenchMicroReserve()
  // result for Sophie's nearest pending payment (see engine.ts's
  // computeMoneyBreakdown for why she has a real "profile"-based reserve).
  const nextExpectedPayment = todayFacts.upcoming.find((u) => u.kind === "expected_income") ?? null;
  const runwayScenario = cashRunway.months !== null && nextExpectedPayment
    ? (() => {
        const result = calculateFrenchMicroReserve({
          amount: nextExpectedPayment.amount,
          amountBasis: "HT",
          paymentDate: DEMO_REF_DATE,
          taxProfile: DEMO_TAX_PROFILE,
        });
        const reserveForPayment = {
          pct: result.status === "calculated" ? Math.round((result.knownMandatoryReserve / nextExpectedPayment.amount) * 1000) / 10 : 0,
          reserveAmount: result.knownMandatoryReserve,
          netAmount: result.afterKnownStatutoryReserves,
          isEstimate: false,
        };
        return projectMoneyBreakdownWithPayment(moneyBreakdown, nextExpectedPayment.amount, reserveForPayment);
      })()
    : null;

  const current  = summary.current;
  const previous = summary.previous;
  const recent   = summary.recent.map(tx => ({
    description: tx.description,
    amount: tx.amount,
    type: tx.transactionType,
    category: tx.category,
  }));

  const intel = generateDashboardIntelligence(
    current, previous, comparison.changes, chartData, recent,
    forecast ? { projectedIncome: forecast.projectedIncome, projectedExpenses: forecast.projectedExpenses, projectedSavings: forecast.projectedSavings, projectedCashflow: forecast.projectedCashflow, basedOnMonths: forecast.basedOnMonths } : null,
    categoryInsights.topExpenseCategories, categoryInsights.yearlySnapshots, categoryInsights.seasonality,
    concentration, locale,
    intentBreakdown.hasEnoughDataForDisplay ? intentBreakdown : null,
  );

  // Use the same definition as analytics/page.tsx: require at least one month with
  // real income or expense data.
  const hasData = chartData.some(d => d.income > 0 || d.expenses > 0);

  const _now = new Date();
  const coverageMonthsAgo = coverage.latest != null
    ? (_now.getFullYear() - coverage.latest.getUTCFullYear()) * 12 +
      (_now.getMonth() - coverage.latest.getUTCMonth())
    : null;
  const coverageIsStale = coverageMonthsAgo !== null && coverageMonthsAgo >= 2 && hasData;
  const coverageLatestLabel = coverage.latest != null
    ? coverage.latest.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" })
    : null;

  // ── Computed metrics ────────────────────────────────────────────────────────
  // Shared with the Dashboard page (computeCashflowRisk in intelligence-engine.ts)
  // so the two pages — and TrendsChart wherever it's rendered — can never disagree.
  // Demo dataset has no tax-payment transactions, so no adjustment array to pass.
  const activeMonths = chartData.filter(d => d.income > 0 || d.expenses > 0);
  const {
    riskLevel: cashflowRisk,
    positiveCount,
    negativeCount,
    taxAdjustedCount,
    incTrendPct: incPct,
  } = computeCashflowRisk(chartData, []);

  const last6    = activeMonths.slice(-6);
  const prev6    = activeMonths.slice(-12, -6);
  const avgLast6 = last6.length  ? last6.reduce((s, d)  => s + d.income, 0) / last6.length  : 0;
  const avgPrev6 = prev6.length  ? prev6.reduce((s, d)  => s + d.income, 0) / prev6.length  : 0;

  const keyDrivers: { label: string; detail: React.ReactNode; positive: boolean }[] = [];
  if (avgPrev6 > 0) {
    if (incPct > 5) keyDrivers.push({ label: t("keyDrivers.incomeGrowing.label"), detail: t.rich("keyDrivers.incomeGrowing.detail", { pct: String(incPct), avgLast6: formatCurrency(avgLast6, locale), avgPrev6: formatCurrency(avgPrev6, locale), b: bold }), positive: true });
    else if (incPct < -5) keyDrivers.push({ label: t("keyDrivers.incomeDeclining.label"), detail: t.rich("keyDrivers.incomeDeclining.detail", { pct: String(Math.abs(incPct)), avgLast6: formatCurrency(avgLast6, locale), avgPrev6: formatCurrency(avgPrev6, locale), b: bold }), positive: false });
    else keyDrivers.push({ label: t("keyDrivers.incomeStable.label"), detail: t("keyDrivers.incomeStable.detail"), positive: true });
  }
  if (categoryInsights.topExpenseCategories.length > 0) {
    const top = categoryInsights.topExpenseCategories[0];
    const catLabel = tCategories.has(top.category) ? tCategories(top.category) : top.category;
    keyDrivers.push({ label: t("keyDrivers.biggestExpense.label", { category: catLabel }), detail: t.rich("keyDrivers.biggestExpense.detail", { category: catLabel, amount: formatCurrency(top.totalAllTime, locale), trend: top.yearOverYearTrend, b: bold }), positive: top.yearOverYearTrend !== "growing" });
  }
  if (negativeCount === 0 && activeMonths.length >= 3) {
    keyDrivers.push({ label: t("keyDrivers.allMonthsPositive.label"), detail: t("keyDrivers.allMonthsPositive.detail"), positive: true });
  } else if (negativeCount > 0) {
    keyDrivers.push({ label: t("keyDrivers.negativeCashflowMonths.label", { count: negativeCount }), detail: t.rich("keyDrivers.negativeCashflowMonths.detail", { count: negativeCount, total: activeMonths.length, b: bold }), positive: false });
  }
  if (forecast?.seasonallyAdjusted && forecast.incomeSeasonalFactor != null) {
    keyDrivers.push({ label: t("keyDrivers.seasonalAdjustment.label"), detail: t("keyDrivers.seasonalAdjustment.detail", { pct: String(Math.round(Math.abs(forecast.incomeSeasonalFactor - 1) * 100)), aboveBelow: forecast.incomeSeasonalFactor >= 1 ? "above" : "below" }), positive: true });
  }

  // Revenue match rate — what % of all-time income was matched to a known payer.
  const totalHistoricIncome = activeMonths.reduce((s, d) => s + d.income, 0);
  const totalMatchedRevenue = activeMonths.reduce((s, d) => s + d.verifiedRevenue + d.likelyRevenue, 0);
  const payerEngineHasRun   = activeMonths.some(d => d.verifiedRevenue > 0 || d.likelyRevenue > 0);
  const revenueMatchPct     = payerEngineHasRun && totalHistoricIncome > 0
    ? Math.round((totalMatchedRevenue / totalHistoricIncome) * 100)
    : null;

  const health = HEALTH[intel.healthStatus];
  const trend  = TREND[intel.businessTrendDirection];
  const risk   = RISK_CONFIG[cashflowRisk];

  const fmtDate = (d: Date) => d.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-8 md:space-y-10">

      {/* Header — kept in lockstep with (dashboard)/forecast/page.tsx: no
          verdict subtitle any more, it only ever restated the Cashflow Risk
          card below. */}
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Data coverage — always visible so the user knows exactly what was analyzed */}
      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {/* Coverage stale — data ends many months before today */}
      {coverageIsStale && coverageLatestLabel && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#D4A25412] border border-[#D4A25432] rounded-xl">
          <p className="text-sm text-[#D4A254]">
            {td("coverageStale.message", { month: coverageLatestLabel })}
          </p>
          <Link href="/signup" className="text-xs font-semibold text-[#D4A254] hover:text-[#E8F0F8] transition-colors flex-shrink-0 bg-[#D4A25420] px-3 py-1.5 rounded-lg">
            {td("coverageStale.cta")}
          </Link>
        </div>
      )}

      {/* Data gaps — amber callout when interior months have no transactions */}
      {dataGaps.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#D4A2540A] border border-[#D4A25430] rounded-xl">
          <span className="text-[#D4A254] flex-shrink-0 mt-0.5">◈</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#D4A254]">
              {t("dataGaps.heading", { count: dataGaps.length })}
            </p>
            <p className="text-xs text-[#A8C6E0] mt-0.5 leading-relaxed">
              {t("dataGaps.subtitle")}{" "}
              <span className="text-[#E8F0F8]">
                {dataGaps.slice(0, 3).map(g => g.label).join(", ")}
                {dataGaps.length > 3 ? ` +${dataGaps.length - 3} more` : ""}
              </span>
            </p>
          </div>
          <Link href="/signup" className="text-xs font-semibold text-[#D4A254] hover:text-[#E8B86A] transition-colors flex-shrink-0 mt-0.5 whitespace-nowrap">
            {t("dataGaps.uploadNow")}
          </Link>
        </div>
      )}

      {/* Runway — real cash ÷ actual burn. Copied verbatim from the real
          Forecast page's Runway card. */}
      {cashRunway.months !== null && (
        <div className="card">
          <p className="label mb-2">
            {cashRunway.source === "estimated" ? tRunway("estimatedLabel") : tRunway("calculatedLabel")}
          </p>
          {cashRunway.months < 0 ? (
            <p className="text-2xl font-bold text-[#E5484D] tabular-nums mb-1">{tRunway("alreadyBehind")}</p>
          ) : (
            <p className="text-2xl font-bold text-[#E8F0F8] tabular-nums mb-1">
              {t("howBuilt.monthsValue", { count: Math.round(cashRunway.months * 10) / 10 })}
            </p>
          )}
          <p className="text-xs text-[#6A97B4]">
            {cashRunway.source === "estimated"
              ? tRunway("estimatedCaption", { amount: formatCurrency(cashRunway.monthlySpend, locale) })
              : tRunway("calculatedCaption", { months: cashRunway.basedOnMonths })}
          </p>

          {runwayScenario && nextExpectedPayment && (
            <div className="mt-4 pt-4 border-t border-[#1E3A55]">
              <p className="text-xs text-[#6A97B4]">
                {runwayScenario.projectedRunwayMonths !== null && runwayScenario.projectedRunwayMonths < 0
                  ? tRunway("ifArrivesStillBehind", { label: nextExpectedPayment.label, amount: formatCurrency(nextExpectedPayment.amount, locale) })
                  : tRunway("ifArrives", {
                      label: nextExpectedPayment.label,
                      amount: formatCurrency(nextExpectedPayment.amount, locale),
                      months: runwayScenario.projectedRunwayMonths !== null ? (Math.round(runwayScenario.projectedRunwayMonths * 10) / 10) : "—",
                    })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upcoming cash 30/60/90 — copied verbatim from the real Forecast
          page's card. */}
      <div className="card">
        <div className="flex items-baseline justify-between mb-1">
          <p className="label">{t("upcomingCashWindow.label")}</p>
        </div>
        <p className="text-[11px] text-[#6A97B4] mb-4">{t("upcomingCashWindow.scope")}</p>
        {upcomingCashWindow.every((b) => b.expectedIncome === 0 && b.committedExpenses === 0) ? (
          <p className="text-sm text-[#6A97B4]">{t("upcomingCashWindow.empty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {upcomingCashWindow.map((bucket) => (
              <div key={bucket.throughDay}>
                <p className="text-xs text-[#6A97B4] mb-1.5">{t(`upcomingCashWindow.day${bucket.throughDay}`)}</p>
                <p className={`text-lg font-bold tabular-nums mb-1 ${bucket.net < 0 ? "text-[#E5484D]" : "text-[#E8F0F8]"}`}>
                  {formatCurrency(bucket.net, locale)}
                </p>
                <p className="text-[11px] text-[#4CC4A4] tabular-nums">
                  {t("upcomingCashWindow.expectedIncome", { amount: formatCurrency(bucket.expectedIncome, locale) })}
                </p>
                <p className="text-[11px] text-[#D4A254] tabular-nums">
                  {t("upcomingCashWindow.committedExpenses", { amount: formatCurrency(bucket.committedExpenses, locale) })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {!hasData && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📈</div>
          <h2 className="text-xl font-semibold mb-2">{t("emptyState.heading")}</h2>
          <p className="text-[#7BA8C4] mb-6 max-w-sm mx-auto">
            {t("emptyState.body")}
          </p>
          <Link href="/signup" className="btn-primary inline-block">{t("emptyState.cta")}</Link>
        </div>
      )}

      {hasData && (
        <>
          {/* ── 1. Health overview row ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="card">
              <p className="label mb-3">{t("healthScore.label")}</p>
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg inline-block mb-3 ${health.bg} ${health.text}`}>
                {health.label}
              </span>
              {intel.healthStatusExplanation && (
                <p className={`text-xs leading-relaxed ${health.text}`}>
                  <InsightText insight={intel.healthStatusExplanation} />
                </p>
              )}
            </div>

            <div className={`card ${risk.bg} ${risk.border}`}>
              <p className="label mb-3">{t("cashflowRiskLabel")}</p>
              <p className={`text-2xl font-bold mb-2 ${risk.text}`}>{risk.label}</p>
              <p className="text-xs text-[#7BA8C4] leading-relaxed">{risk.desc}</p>
              <p className="text-xs text-[#6A97B4] mt-2">{t("monthsPositive", { positive: positiveCount, total: activeMonths.length })}</p>
              {taxAdjustedCount > 0 && (
                <p className="text-xs text-[#6A97B4] mt-1.5 italic">
                  {t("cashflowRisk.taxAdjustmentNote", { count: taxAdjustedCount })}
                </p>
              )}
            </div>

            <div className="card">
              <p className="label mb-3">{t("businessDirection")}</p>
              <div className="mb-3">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${trend.bg} ${trend.text}`}>
                  {trend.label}
                </span>
              </div>
              {intel.trajectoryInsight && (
                <p className="text-xs text-[#7BA8C4] leading-relaxed">
                  <InsightText insight={intel.trajectoryInsight} />
                </p>
              )}
            </div>
          </div>

          {/* ── 2. Year-End Projection ────────────────────────────────────── */}
          <YearEndProjectionCard forecast={forecast} />

          {/* ── 3. How This Forecast Was Built ────────────────────────── */}
          <div className="card">
            <p className="label mb-4">{t("howBuilt.label")}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                {
                  key: "dataAnalyzed",
                  label: t("howBuilt.dataAnalyzed"),
                  value: coverage.earliest && coverage.latest
                    ? `${fmtDate(coverage.earliest)} – ${fmtDate(coverage.latest)}`
                    : t("howBuilt.noValue"),
                },
                {
                  key: "monthsOfHistory",
                  label: t("howBuilt.monthsOfHistory"),
                  value: t("howBuilt.monthsValue", { count: forecast?.basedOnMonths ?? 0 }),
                },
                {
                  key: "transactions",
                  label: t("howBuilt.transactions"),
                  value: coverage.count.toLocaleString(INTL_LOCALES[locale]),
                },
                {
                  key: "forecastConfidence",
                  label: t("howBuilt.forecastConfidence"),
                  value: forecast?.confidence
                    ? t(`confidenceLevels.${forecast.confidence}`)
                    : t("howBuilt.noValue"),
                  color: forecast?.confidence === "high" ? "text-[#4CC4A4]" :
                         forecast?.confidence === "medium" ? "text-[#D4A254]" : "text-[#E5484D]",
                },
              ].map((item) => (
                <div key={item.key} className="bg-[#1A3048] rounded-xl p-4">
                  <p className="label mb-2">{item.label}</p>
                  <p className={`text-sm font-semibold ${"color" in item && item.color ? item.color : "text-[#A8C6E0]"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <CollapsibleSection
              title={t("howBuilt.methodologyLabel")}
              subtitle={t("howBuilt.methodologySubtitle")}
              defaultOpen={false}
            >
            {forecast?.confidenceScore !== undefined && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="label">{t("howBuilt.confidenceScore")}</p>
                  <span className={`text-xs font-bold tabular-nums ${
                    forecast.confidence === "high" ? "text-[#4CC4A4]" :
                    forecast.confidence === "medium" ? "text-[#D4A254]" : "text-[#E5484D]"
                  }`}>{Math.round(forecast.confidenceScore * 100)}%</span>
                </div>
                <div className="h-2 bg-[#1A3048] rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${
                      forecast.confidence === "high" ? "bg-[#4CC4A4]" :
                      forecast.confidence === "medium" ? "bg-[#D4A254]" : "bg-[#E5484D]"
                    }`}
                    style={{ width: `${Math.round(forecast.confidenceScore * 100)}%` }}
                  />
                </div>
                {forecast.confidenceReasons.length > 0 && (
                  <ul className="space-y-1">
                    {forecast.confidenceReasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#6A97B4]">
                        <span className="text-[#3AB5A0] flex-shrink-0 mt-0.5">·</span>
                        <span>{typeof r === "string" ? r : t(r.key as Parameters<typeof t>[0], r.params)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {forecast && forecast.last3Count > 0 && (
              <div className="mb-5 bg-[#0F2840] border border-[#1E3A55] rounded-xl px-4 py-3">
                <p className="label mb-2">{t("howBuilt.weightBreakdownTitle")}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#7BA8C4]">
                    <span>{t("howBuilt.weightLast3", { count: forecast.last3Count, avg: formatCurrency(forecast.last3Avg, locale) })}</span>
                  </div>
                  {forecast.mid6Count > 0 && (
                    <div className="flex justify-between text-xs text-[#7BA8C4]">
                      <span>{t("howBuilt.weightMid6", { count: forecast.mid6Count, avg: formatCurrency(forecast.mid6Avg, locale) })}</span>
                    </div>
                  )}
                  {forecast.olderCount > 0 && (
                    <div className="flex justify-between text-xs text-[#7BA8C4]">
                      <span>{t("howBuilt.weightOlder", { count: forecast.olderCount, avg: formatCurrency(forecast.olderAvg, locale) })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-[#A8C6E0] font-semibold border-t border-[#1E3A55] pt-1.5 mt-1">
                    <span>{t("howBuilt.weightResult", { avg: formatCurrency(forecast.projectedIncome, locale) })}</span>
                  </div>
                </div>
              </div>
            )}

            {forecast?.recurringExpensesTotal != null && forecast.recurringExpensesTotal > 0 && (
              <div className="mb-5 bg-[#0F2840] border border-[#1E3A55] rounded-xl px-4 py-3">
                <p className="label mb-1">{t("howBuilt.recurringExpensesLabel")}</p>
                <p className="text-sm text-[#A8C6E0] mb-2">
                  {t("howBuilt.recurringExpensesBody", { amount: formatCurrency(forecast.recurringExpensesTotal, locale) })}
                </p>
                {forecast.recurringExpenseCategories.length > 0 && (
                  <>
                    <p className="text-xs text-[#6A97B4] font-semibold mb-1">{t("howBuilt.recurringCategoriesTitle")}</p>
                    <div className="space-y-0.5">
                      {forecast.recurringExpenseCategories.map((cat) => (
                        <div key={cat.category} className="flex justify-between text-xs text-[#7BA8C4]">
                          <span className="capitalize">{cat.category}</span>
                          <span className="tabular-nums">{t("howBuilt.perMonth", { amount: formatCurrency(cat.monthlyAvg, locale) })}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4CC4A4] flex-shrink-0" />
              <p className="text-xs text-[#6A97B4]">
                {t("howBuilt.builtFrom", { range: coverage.rangeLabel ?? t("howBuilt.transactionsFallback", { count: coverage.count }) })}
                {forecast?.seasonallyAdjusted && t("howBuilt.seasonalApplied")}
              </p>
            </div>
            <div className="text-xs text-[#6A97B4] space-y-2 pt-4 leading-relaxed">
              <p>· {t("howBuilt.weightingNote")}</p>
              {forecast?.seasonallyAdjusted && forecast.incomeSeasonalFactor != null && (
                <p>· {t("howBuilt.seasonalFactorNote", {
                  pct: String(Math.round(Math.abs(forecast.incomeSeasonalFactor - 1) * 100)),
                  aboveBelow: forecast.incomeSeasonalFactor >= 1 ? "above" : "below",
                  blend: String(Math.round((forecast.seasonalBlend ?? 0) * 100)),
                })}</p>
              )}
              <p>· {t(`confidenceDescriptions.${forecast?.confidence ?? "low"}`)}. {t("howBuilt.moreHistoryNote")}</p>
              {revenueMatchPct !== null && (
                <p className={revenueMatchPct < 80 ? "text-[#D4A254]" : ""}>
                  · {revenueMatchPct >= 90
                    ? t("howBuilt.revenueMatchRateHigh", { pct: String(revenueMatchPct) })
                    : t("howBuilt.revenueMatchRate", { pct: String(revenueMatchPct) })}
                </p>
              )}
              {forecast?.usedPayerRevenue === true && (
                <p className="text-[#4CC4A4]">· {t("howBuilt.basedOnPayerRevenue")}</p>
              )}
              {forecast?.usedPayerRevenue === false && (
                <p className="text-[#D4A254]">· {t("howBuilt.basedOnTotalIncome")}</p>
              )}
              {forecast?.excludedReviewRevenue != null && forecast.excludedReviewRevenue > 0 && (
                <p className="text-[#D4A254]">· {t("howBuilt.excludedReviewRevenue", { amount: formatCurrency(forecast.excludedReviewRevenue, locale) })}</p>
              )}
            </div>
            </CollapsibleSection>
          </div>

          {/* ── 4. Key Drivers ────────────────────────────────────────────── */}
          {keyDrivers.length > 0 && (
            <div className="card">
              <p className="label mb-1">{t("keyDrivers.label")}</p>
              <p className="text-xs text-[#6A97B4] mb-4">{t("keyDrivers.subtitle")}</p>
              <div className="space-y-2">
                {keyDrivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#1A3048] rounded-xl px-4 py-3">
                    <span className={`text-base flex-shrink-0 mt-0.5 font-bold ${d.positive ? "text-[#4CC4A4]" : "text-[#D4A254]"}`}>
                      {d.positive ? "↑" : "↓"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[#E8F0F8]">{d.label}</p>
                      <p className="text-xs text-[#7BA8C4] mt-0.5 leading-relaxed">{d.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Risk + Opportunity ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div className="card border-[#E5484D20]">
              <div className="flex items-start gap-3">
                <span className="text-[#E5484D] text-xl flex-shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="label mb-2">{t("biggestRisk.label")}</p>
                  <p className="text-sm text-[#A8C6E0] leading-relaxed">
                    {intel.biggestRisk ? <InsightText insight={intel.biggestRisk} /> : t("biggestRisk.fallback")}
                  </p>
                </div>
              </div>
            </div>
            <div className="card bg-[#4CC4A40A] border-[#4CC4A420]">
              <div className="flex items-start gap-3">
                <span className="text-[#4CC4A4] text-xl flex-shrink-0 mt-0.5">★</span>
                <div>
                  <p className="label mb-2">{t("biggestOpportunity.label")}</p>
                  <p className="text-sm text-[#A8C6E0] leading-relaxed">
                    {intel.biggestOpportunity ? <InsightText insight={intel.biggestOpportunity} /> : t("biggestOpportunity.fallback")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. Recommended Actions ────────────────────────────────────── */}
          {intel.forecastImprovements.length > 0 && (
            <div className="card bg-[#3AB5A00A] border border-[#3AB5A018]">
              <p className="label mb-1">{t("recommendedActions.label")}</p>
              <p className="text-xs text-[#6A97B4] mb-4">
                {t("recommendedActions.subtitle")}
              </p>
              <div className="space-y-3">
                {intel.forecastImprovements.slice(0, 4).map((action, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#1A3048] rounded-xl p-3 md:p-4">
                    <span className="text-base text-[#3AB5A0] flex-shrink-0 mt-0.5">→</span>
                    <p className="text-sm text-[#A8C6E0] leading-relaxed">
                      <InsightText insight={action} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Seasonal Insights ──────────────────────────────────────── */}
          {intel.seasonalInsights.length > 0 && (
            <CollapsibleSection
              title={t("seasonalPatterns.label")}
              subtitle={t("seasonalPatterns.subtitle", { count: intel.seasonalInsights.length })}
              defaultOpen={false}
            >
              <div className="card">
                <div className="space-y-2">
                  {intel.seasonalInsights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 bg-[#1A3048] rounded-xl px-4 py-3">
                      <span className="text-[#3AB5A0] text-sm mt-0.5 flex-shrink-0">◆</span>
                      <p className="text-sm text-[#A8C6E0]">
                        <InsightText insight={insight} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* ── Incomplete data warning ───────────────────────────────────── */}
          {forecast?.hasIncompleteDataWarning && (
            <div className="rounded-2xl px-5 py-4 border bg-[#D4A2540A] border-[#D4A25430]">
              <div className="flex items-start gap-3">
                <span className="text-[#D4A254] text-lg flex-shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-[#D4A254] mb-1">
                    {t("incompleteDataWarning.title")}
                  </p>
                  <p className="text-sm text-[#A8C6E0] leading-relaxed">
                    {t("incompleteDataWarning.body", {
                      recentMonths:   forecast.incompleteDataRecentMonths   ?? 2,
                      recentAvg:      formatCurrency(forecast.incompleteDataRecentAvg   ?? avgLast6, locale),
                      historicMonths: forecast.incompleteDataHistoricMonths ?? (activeMonths.length - 2),
                      historicAvg:    formatCurrency(forecast.incompleteDataHistoricAvg ?? avgPrev6, locale),
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <TrendsChart data={chartData} riskLevel={cashflowRisk} apiBase="/api/demo" />
        </>
      )}
    </div>
  );
}
