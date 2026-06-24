import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import { generateDashboardIntelligence } from "@/lib/intelligence-engine";
import { formatCurrency } from "@/utils/finance";
import TrendsChart from "@/components/dashboard/TrendsChart";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import InsightText from "@/components/ui/InsightText";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DemoForecastPage() {
  const t      = await getTranslations("forecast");
  const td     = await getTranslations("dashboard");
  const tCategories = await getTranslations("categories");
  const locale = (await getLocale()) as Locale;

  const bold = (chunks: React.ReactNode) => <strong className="text-[#E8F0F8] font-semibold">{chunks}</strong>;

  const HEALTH = {
    healthy:   { label: td("health.healthy"), bg: "bg-[#4CC4A40A]", border: "border-[#4CC4A425]", text: "text-[#4CC4A4]", bar: "bg-[#4CC4A4]" },
    watch:     { label: td("health.watch"),   bg: "bg-[#D4A2540A]", border: "border-[#D4A25425]", text: "text-[#D4A254]", bar: "bg-[#D4A254]" },
    "at-risk": { label: td("health.atRisk"),  bg: "bg-[#D970700A]", border: "border-[#D9707025]", text: "text-[#D97070]", bar: "bg-[#D97070]" },
  };

  const TREND = {
    improving: { label: t("trend.improving"), bg: "bg-[#4CC4A415]", text: "text-[#4CC4A4]" },
    stable:    { label: t("trend.stable"),    bg: "bg-[#1A3048]",   text: "text-[#7BA8C4]" },
    weakening: { label: t("trend.weakening"), bg: "bg-[#D9707015]", text: "text-[#D97070]" },
  };

  const RISK_CONFIG = {
    low:      { label: t("cashflowRisk.low.label"),      desc: t("cashflowRisk.low.desc"),      bg: "bg-[#4CC4A40A]", border: "border-[#4CC4A425]", text: "text-[#4CC4A4]" },
    medium:   { label: t("cashflowRisk.medium.label"),   desc: t("cashflowRisk.medium.desc"),   bg: "bg-[#D4A2540A]", border: "border-[#D4A25425]", text: "text-[#D4A254]" },
    high:     { label: t("cashflowRisk.high.label"),     desc: t("cashflowRisk.high.desc"),     bg: "bg-[#D970700A]", border: "border-[#D9707025]", text: "text-[#D97070]" },
    critical: { label: t("cashflowRisk.critical.label"), desc: t("cashflowRisk.critical.desc"), bg: "bg-[#D970700A]", border: "border-[#D9707025]", text: "text-[#D97070]" },
  };

  const {
    chartData, summary, comparison, coverage, categoryInsights,
    concentration, intentBreakdown, forecast, nonZeroMonths,
  } = getDemoDataset(locale);

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

  const activeMonths  = chartData.filter(d => d.income > 0 || d.expenses > 0);
  const positiveCount = activeMonths.filter(d => d.cashflow >= 0).length;
  const negativeCount = activeMonths.length - positiveCount;
  const posRatio      = activeMonths.length > 0 ? positiveCount / activeMonths.length : 0;

  const last6    = activeMonths.slice(-6);
  const prev6    = activeMonths.slice(-12, -6);
  const avgLast6 = last6.length  ? last6.reduce((s, d)  => s + d.income, 0) / last6.length  : 0;
  const avgPrev6 = prev6.length  ? prev6.reduce((s, d)  => s + d.income, 0) / prev6.length  : 0;
  const incTrend = avgPrev6 > 0  ? (avgLast6 - avgPrev6) / avgPrev6 : 0;
  const incPct   = Math.round(incTrend * 100);

  const cashflowScore = Math.round(posRatio * 40);
  const trendScore    = incTrend > 0.05 ? 25 : incTrend > -0.05 ? 15 : 5;
  const depthScore    = activeMonths.length >= 12 ? 20 : activeMonths.length >= 6 ? 12 : 5;
  const statusScore   = intel.healthStatus === "healthy" ? 15 : intel.healthStatus === "watch" ? 8 : 0;
  const healthScore   = Math.min(100, cashflowScore + trendScore + depthScore + statusScore);

  const cashflowRisk: "low" | "medium" | "high" | "critical" =
    posRatio >= 0.85 && incTrend > -0.05 ? "low" :
    posRatio >= 0.65 ? "medium" :
    posRatio >= 0.40 ? "high" : "critical";

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

  const annualIncome   = forecast ? forecast.projectedIncome   * 12 : 0;
  const annualExpenses = forecast ? forecast.projectedExpenses * 12 : 0;
  const annualCashflow = forecast ? forecast.projectedCashflow * 12 : 0;
  const projMarginPct  = forecast && forecast.projectedIncome > 0 ? Math.round((forecast.projectedCashflow / forecast.projectedIncome) * 100) : null;

  const health     = HEALTH[intel.healthStatus];
  const trend      = TREND[intel.businessTrendDirection];
  const scoreLevel: "healthy" | "watch" | "at-risk" = healthScore >= 80 ? "healthy" : healthScore >= 50 ? "watch" : "at-risk";
  const scoreColor = HEALTH[scoreLevel];
  const risk       = RISK_CONFIG[cashflowRisk];

  const fmtDate = (d: Date) => d.toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-8 md:space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle.withData")}</p>
      </div>

      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {/* ── 1. Health overview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="label mb-3">{t("healthScore.label")}</p>
          <div className="flex items-end gap-2 mb-3">
            <span className={`text-4xl font-bold tabular-nums ${scoreColor.text}`}>{healthScore}</span>
            <span className="text-[#475569] text-sm mb-1">{t("healthScore.outOf100")}</span>
          </div>
          <div className="h-2 bg-[#243F5E] rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full ${scoreColor.bar}`} style={{ width: `${healthScore}%` }} />
          </div>
          <p className={`text-xs font-semibold mb-3 ${health.text}`}>{health.label}</p>
          <div className="space-y-1.5 pt-3">
            <p className="text-xs text-[#6A97B4] font-semibold uppercase tracking-wide mb-2">{t("healthScore.howCalculated")}</p>
            {[
              { key: "cashflowConsistency", label: t("healthScore.rows.cashflowConsistency"), score: cashflowScore, max: 40, detail: t("monthsPositive", { positive: positiveCount, total: activeMonths.length }) },
              { key: "incomeTrend",         label: t("healthScore.rows.incomeTrend"),         score: trendScore,    max: 25, detail: incPct > 3 ? t("healthScore.trendUp", { pct: String(incPct) }) : incPct < -3 ? t("healthScore.trendDown", { pct: String(Math.abs(incPct)) }) : t("healthScore.trendStable") },
              { key: "dataDepth",           label: t("healthScore.rows.dataDepth"),           score: depthScore,    max: 20, detail: t("healthScore.monthsOfHistory", { count: activeMonths.length }) },
              { key: "healthStatus",        label: t("healthScore.rows.healthStatus"),        score: statusScore,   max: 15, detail: health.label },
            ].map(row => (
              <div key={row.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#7BA8C4] truncate">{row.label}</span>
                <span className="text-[#A8C6E0] flex-shrink-0 tabular-nums">{row.score}/{row.max}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`card ${risk.bg} ${risk.border}`}>
          <p className="label mb-3">{t("cashflowRiskLabel")}</p>
          <p className={`text-2xl font-bold mb-2 ${risk.text}`}>{risk.label}</p>
          <p className="text-xs text-[#7BA8C4] leading-relaxed">{risk.desc}</p>
          <p className="text-xs text-[#6A97B4] mt-2">{t("monthsPositive", { positive: positiveCount, total: activeMonths.length })}</p>
        </div>

        <div className="card">
          <p className="label mb-3">{t("businessDirection")}</p>
          <div className="mb-3">
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${trend.bg} ${trend.text}`}>{trend.label}</span>
          </div>
          {intel.trajectoryInsight && (
            <p className="text-xs text-[#7BA8C4] leading-relaxed">
              <InsightText insight={intel.trajectoryInsight} />
            </p>
          )}
        </div>
      </div>

      {intel.healthStatusExplanation && (
        <div className={`rounded-2xl px-5 py-4 border ${health.bg} ${health.border}`}>
          <p className={`text-sm leading-relaxed ${health.text}`}>
            <InsightText insight={intel.healthStatusExplanation} />
          </p>
        </div>
      )}

      {/* ── 2. Year-End Projection ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
          <div>
            <p className="label mb-1">{t("yearEndProjection.label")}</p>
            <p className="text-[13px] text-[#6A97B4]">{t("yearEndProjection.subtitle")}</p>
          </div>
          {forecast?.confidence && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-[#1A3048] ${
              forecast.confidence === "high" ? "text-[#4CC4A4]" :
              forecast.confidence === "medium" ? "text-[#D4A254]" : "text-[#D97070]"
            }`}>
              {t("confidenceLabel", { level: forecast.confidence })}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: "income",   label: t("yearEndProjection.items.income"),   value: `~${formatCurrency(annualIncome, locale)}`,   sub: forecast ? t("yearEndProjection.perMonthAvg", { amount: formatCurrency(forecast.projectedIncome, locale) }) : null,   color: "text-[#4CC4A4]",  border: "border-[#4CC4A415]" },
            { key: "expenses", label: t("yearEndProjection.items.expenses"), value: `~${formatCurrency(annualExpenses, locale)}`,  sub: forecast ? t("yearEndProjection.perMonthAvg", { amount: formatCurrency(forecast.projectedExpenses, locale) }) : null,  color: "text-[#D4A254]",  border: "border-[#D4A25415]" },
            { key: "cashflow", label: t("yearEndProjection.items.cashflow"), value: `~${formatCurrency(annualCashflow, locale)}`,  sub: forecast ? t("yearEndProjection.perMonthAvg", { amount: formatCurrency(forecast.projectedCashflow, locale) }) : null,  color: annualCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]", border: "border-[#243F5E]" },
            {
              key: "margin", label: t("yearEndProjection.items.margin"),
              value: projMarginPct !== null ? (forecast?.confidence === "high" ? t("yearEndProjection.marginValue", { pct: String(projMarginPct) }) : t("yearEndProjection.marginApprox", { pct: String(projMarginPct) })) : t("yearEndProjection.noValue"),
              sub: projMarginPct !== null && forecast?.confidence !== "high" ? t("yearEndProjection.ofIncomeKeptApprox") : t("yearEndProjection.ofIncomeKept"),
              color: projMarginPct === null ? "text-[#6A97B4]" : forecast?.confidence !== "high" ? "text-[#7BA8C4]" : projMarginPct >= 30 ? "text-[#4CC4A4]" : projMarginPct >= 10 ? "text-[#D4A254]" : "text-[#D97070]",
              border: "border-[#243F5E]",
            },
          ].map(item => (
            <div key={item.key} className={`bg-[#1A3048] rounded-xl p-3 border ${item.border}`}>
              <p className="text-xs text-[#6A97B4] uppercase tracking-wide mb-1">{item.label}</p>
              <p className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
              {item.sub && <p className="text-xs text-[#6A97B4] mt-1">{item.sub}</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#475569] mt-3 leading-relaxed">{t("yearEndProjection.extrapolationNote")}</p>
      </div>

      {/* ── 3. How This Forecast Was Built ─────────────────────────────────── */}
      <div className="card">
        <p className="label mb-4">{t("howBuilt.label")}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { key: "dataAnalyzed", label: t("howBuilt.dataAnalyzed"), value: coverage.earliest && coverage.latest ? `${fmtDate(coverage.earliest)} – ${fmtDate(coverage.latest)}` : t("howBuilt.noValue") },
            { key: "monthsOfHistory", label: t("howBuilt.monthsOfHistory"), value: t("howBuilt.monthsValue", { count: forecast?.basedOnMonths ?? 0 }) },
            { key: "transactions", label: t("howBuilt.transactions"), value: coverage.count.toLocaleString(INTL_LOCALES[locale]) },
            {
              key: "forecastConfidence", label: t("howBuilt.forecastConfidence"),
              value: forecast?.confidence ? t(`confidenceLevels.${forecast.confidence}`) : t("howBuilt.noValue"),
              color: forecast?.confidence === "high" ? "text-[#4CC4A4]" : forecast?.confidence === "medium" ? "text-[#D4A254]" : "text-[#D97070]",
            },
          ].map(item => (
            <div key={item.key} className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">{item.label}</p>
              <p className={`text-sm font-semibold ${"color" in item && item.color ? item.color : "text-[#A8C6E0]"}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {forecast?.confidenceScore !== undefined && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="label">{t("howBuilt.confidenceScore")}</p>
              <span className={`text-xs font-bold tabular-nums ${
                forecast.confidence === "high" ? "text-[#4CC4A4]" : forecast.confidence === "medium" ? "text-[#D4A254]" : "text-[#D97070]"
              }`}>{Math.round(forecast.confidenceScore * 100)}%</span>
            </div>
            <div className="h-2 bg-[#1A3048] rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full ${forecast.confidence === "high" ? "bg-[#4CC4A4]" : forecast.confidence === "medium" ? "bg-[#D4A254]" : "bg-[#D97070]"}`} style={{ width: `${Math.round(forecast.confidenceScore * 100)}%` }} />
            </div>
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
            <p className="text-sm text-[#A8C6E0] mb-2">{t("howBuilt.recurringExpensesBody", { amount: formatCurrency(forecast.recurringExpensesTotal, locale) })}</p>
            {forecast.recurringExpenseCategories.length > 0 && (
              <>
                <p className="text-xs text-[#6A97B4] font-semibold mb-1">{t("howBuilt.recurringCategoriesTitle")}</p>
                <div className="space-y-0.5">
                  {forecast.recurringExpenseCategories.map(cat => (
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

        <div className="text-xs text-[#6A97B4] space-y-2 pt-4 leading-relaxed">
          <p>· {t("howBuilt.weightingNote")}</p>
          <p>· {t(`confidenceDescriptions.${forecast?.confidence ?? "low"}`)}. {t("howBuilt.moreHistoryNote")}</p>
        </div>
      </div>

      {/* ── 4. Key Drivers ──────────────────────────────────────────────────── */}
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

      {/* ── 5. Risk & Opportunity ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        <div className="card border-[#D9707020]">
          <div className="flex items-start gap-3">
            <span className="text-[#D97070] text-xl flex-shrink-0 mt-0.5">⚠</span>
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

      {/* ── 6. Recommended Actions ──────────────────────────────────────────── */}
      {intel.forecastImprovements.length > 0 && (
        <div className="card bg-[#3AB5A00A] border border-[#3AB5A018]">
          <p className="label mb-1">{t("recommendedActions.label")}</p>
          <p className="text-xs text-[#6A97B4] mb-4">{t("recommendedActions.subtitle")}</p>
          <div className="space-y-3">
            {intel.forecastImprovements.slice(0, 4).map((action, i) => (
              <div key={i} className="flex items-start gap-4 bg-[#1A3048] rounded-xl p-3 md:p-4">
                <span className="text-xs font-bold text-[#3AB5A0] bg-[#3AB5A020] w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <p className="text-sm text-[#A8C6E0] leading-relaxed"><InsightText insight={action} /></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. Seasonal Insights ────────────────────────────────────────────── */}
      {intel.seasonalInsights.length > 0 && (
        <div className="card">
          <p className="label mb-4">{t("seasonalPatterns.label")}</p>
          <div className="space-y-2">
            {intel.seasonalInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#1A3048] rounded-xl px-4 py-3">
                <span className="text-[#3AB5A0] text-sm mt-0.5 flex-shrink-0">◆</span>
                <p className="text-sm text-[#A8C6E0]"><InsightText insight={insight} /></p>
              </div>
            ))}
          </div>
        </div>
      )}

      <TrendsChart data={chartData} apiBase="/api/demo" />
    </div>
  );
}
