import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getHistoricalData, getMonthlyComparison,
  getDashboardSummary, getCategoryInsights, getIncomeConcentration,
  getDataCoverage,
} from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { generateDashboardIntelligence } from "@/lib/intelligence-engine";
import { prisma } from "@/lib/prisma";
import TrendsChart from "@/components/dashboard/TrendsChart";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import { formatCurrency } from "@/utils/finance";
import Link from "next/link";

export const dynamic = "force-dynamic";

const HEALTH = {
  healthy:   { label: "Healthy",       bg: "bg-[#5B8A720A]", border: "border-[#5B8A7225]", text: "text-[#5B8A72]", bar: "bg-[#5B8A72]" },
  watch:     { label: "Watch Closely",  bg: "bg-[#C79A630A]", border: "border-[#C79A6325]", text: "text-[#C79A63]", bar: "bg-[#C79A63]" },
  "at-risk": { label: "At Risk",        bg: "bg-[#C66A5A0A]", border: "border-[#C66A5A25]", text: "text-[#C66A5A]", bar: "bg-[#C66A5A]" },
};

const TREND = {
  improving: { label: "↑ Improving", bg: "bg-[#5B8A7215]", text: "text-[#5B8A72]" },
  stable:    { label: "→ Stable",    bg: "bg-[#F3F4F0]",   text: "text-[#6B7280]" },
  weakening: { label: "↓ Weakening", bg: "bg-[#C66A5A15]", text: "text-[#C66A5A]" },
};

const RISK_CONFIG = {
  low:      { label: "Low Risk",    bg: "bg-[#5B8A720A]", border: "border-[#5B8A7225]", text: "text-[#5B8A72]", desc: "Your cashflow is consistently positive. Current patterns are sustainable." },
  medium:   { label: "Moderate Risk", bg: "bg-[#C79A630A]", border: "border-[#C79A6325]", text: "text-[#C79A63]", desc: "Some months show cashflow pressure. Worth monitoring expenses and building a 2-month buffer." },
  high:     { label: "High Risk",   bg: "bg-[#C66A5A0A]", border: "border-[#C66A5A25]", text: "text-[#C66A5A]", desc: "More months are negative than positive. Income or expense changes are needed soon." },
  critical: { label: "Critical",    bg: "bg-[#C66A5A0A]", border: "border-[#C66A5A25]", text: "text-[#C66A5A]", desc: "Cashflow is negative most months. Immediate action is required to avoid a cash shortfall." },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low:    "Low — less than 4 months of data",
  medium: "Medium — 4 to 11 months",
  high:   "High — 12+ months",
};

export default async function ForecastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [forecast, chartData, monthCount, summary, comparison, categoryInsights, concentration, coverage] =
    await Promise.all([
      generateForecast(user.id),
      getHistoricalData(user.id, 999),
      prisma.monthlyAnalytics.count({ where: { userId: user.id } }),
      getDashboardSummary(user.id),
      getMonthlyComparison(user.id),
      getCategoryInsights(user.id),
      getIncomeConcentration(user.id),
      getDataCoverage(user.id),
    ]);

  const current = summary.current
    ? { totalIncome: Number(summary.current.totalIncome), totalExpenses: Number(summary.current.totalExpenses), totalSavings: Number(summary.current.totalSavings), netCashflow: Number(summary.current.netCashflow) }
    : null;
  const previous = summary.previous
    ? { totalIncome: Number(summary.previous.totalIncome), totalExpenses: Number(summary.previous.totalExpenses), totalSavings: Number(summary.previous.totalSavings), netCashflow: Number(summary.previous.netCashflow) }
    : null;
  const recent = summary.recent.map((tx) => ({ description: tx.description, amount: Number(tx.amount), type: tx.transactionType, category: tx.category }));

  const intel = generateDashboardIntelligence(
    current, previous, comparison.changes, chartData, recent,
    forecast ? { projectedIncome: forecast.projectedIncome, projectedExpenses: forecast.projectedExpenses, projectedSavings: forecast.projectedSavings, projectedCashflow: forecast.projectedCashflow, basedOnMonths: forecast.basedOnMonths } : null,
    categoryInsights.topExpenseCategories, categoryInsights.yearlySnapshots, categoryInsights.seasonality,
    concentration
  );

  const hasData = monthCount > 0;

  // ── Computed metrics ────────────────────────────────────────────────────────
  const activeMonths   = chartData.filter(d => d.income > 0 || d.expenses > 0);
  const positiveCount  = activeMonths.filter(d => d.cashflow >= 0).length;
  const negativeCount  = activeMonths.length - positiveCount;
  const posRatio       = activeMonths.length > 0 ? positiveCount / activeMonths.length : 0;

  // Income trend: last 6 months vs previous 6 months
  const last6     = activeMonths.slice(-6);
  const prev6     = activeMonths.slice(-12, -6);
  const avgLast6  = last6.length  ? last6.reduce((s, d)  => s + d.income, 0) / last6.length  : 0;
  const avgPrev6  = prev6.length  ? prev6.reduce((s, d)  => s + d.income, 0) / prev6.length  : 0;
  const incTrend  = avgPrev6 > 0  ? (avgLast6 - avgPrev6) / avgPrev6 : 0;
  const incPct    = Math.round(incTrend * 100);

  // Business Health Score (0–100)
  const cashflowScore = Math.round(posRatio * 40);
  const trendScore    = incTrend > 0.05 ? 25 : incTrend > -0.05 ? 15 : 5;
  const depthScore    = activeMonths.length >= 12 ? 20 : activeMonths.length >= 6 ? 12 : 5;
  const statusScore   = intel.healthStatus === "healthy" ? 15 : intel.healthStatus === "watch" ? 8 : 0;
  const healthScore   = Math.min(100, cashflowScore + trendScore + depthScore + statusScore);

  // Cashflow risk level
  const cashflowRisk: "low" | "medium" | "high" | "critical" =
    posRatio >= 0.85 && incTrend > -0.05 ? "low" :
    posRatio >= 0.65 ? "medium" :
    posRatio >= 0.40 ? "high" : "critical";

  // Key Drivers
  const keyDrivers: { label: string; detail: string; positive: boolean }[] = [];

  if (avgPrev6 > 0) {
    if (incPct > 3)
      keyDrivers.push({ label: "Income is growing", detail: `Average monthly income rose ${incPct}% over the last 6 months vs the prior 6 (${formatCurrency(avgLast6)}/mo vs ${formatCurrency(avgPrev6)}/mo).`, positive: true });
    else if (incPct < -3)
      keyDrivers.push({ label: "Income is declining", detail: `Average monthly income fell ${Math.abs(incPct)}% over the last 6 months vs the prior 6 (${formatCurrency(avgLast6)}/mo vs ${formatCurrency(avgPrev6)}/mo).`, positive: false });
    else
      keyDrivers.push({ label: "Income is stable", detail: `Monthly income has stayed consistent over the last 12 months — no significant change detected.`, positive: true });
  }

  if (categoryInsights.topExpenseCategories.length > 0) {
    const top = categoryInsights.topExpenseCategories[0];
    const growing = top.yearOverYearTrend === "growing";
    keyDrivers.push({
      label: `Biggest expense: ${top.category}`,
      detail: `${top.category.charAt(0).toUpperCase() + top.category.slice(1)} accounts for the most spending (${formatCurrency(top.totalAllTime)} all-time). Year-over-year trend: ${top.yearOverYearTrend}.`,
      positive: !growing,
    });
  }

  if (negativeCount === 0 && activeMonths.length >= 3) {
    keyDrivers.push({ label: "All months cashflow positive", detail: `Every month in your data had more income than expenses — a strong foundation for the forecast.`, positive: true });
  } else if (negativeCount > 0) {
    keyDrivers.push({
      label: `${negativeCount} negative cashflow month${negativeCount !== 1 ? "s" : ""}`,
      detail: `In ${negativeCount} of ${activeMonths.length} months, expenses exceeded income. This increases forecast uncertainty.`,
      positive: false,
    });
  }

  if (forecast?.seasonallyAdjusted) {
    keyDrivers.push({ label: "Seasonal adjustment applied", detail: `With 24+ months of data, the forecast adjusts for months that are historically stronger or weaker based on your own patterns.`, positive: true });
  }

  // Annual projections (cashflow = income − expenses; savings removed from display)
  const annualIncome    = forecast ? forecast.projectedIncome   * 12 : 0;
  const annualExpenses  = forecast ? forecast.projectedExpenses * 12 : 0;
  const annualCashflow  = forecast ? (forecast.projectedIncome - forecast.projectedExpenses) * 12 : 0;

  // Projected Runway: how many months of expenses the annual surplus covers
  const avgExpPerMonth  = last6.length > 0 ? last6.reduce((s, d) => s + d.expenses, 0) / last6.length : 0;
  const projRunwayMonths = forecast && avgExpPerMonth > 0
    ? (forecast.projectedIncome - forecast.projectedExpenses) / avgExpPerMonth
    : 0;

  const health = HEALTH[intel.healthStatus];
  const trend  = TREND[intel.businessTrendDirection];
  const risk   = RISK_CONFIG[cashflowRisk];

  const fmtDate = (d: Date) => d.toLocaleDateString("en-IE", { month: "short", year: "numeric" });

  return (
    <div className="space-y-8 md:space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Forecast</h1>
        <p className="text-[#6B7280] text-sm mt-0.5">
          {hasData ? "Financial outlook based on your actual data" : "Upload a CSV to generate your forecast"}
        </p>
      </div>

      {/* Data coverage — always visible so the user knows exactly what was analyzed */}
      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {!hasData && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📈</div>
          <h2 className="text-xl font-semibold mb-2">No data to forecast yet</h2>
          <p className="text-[#6B7280] mb-6 max-w-sm mx-auto">
            Upload your bank statement CSV to generate personalised forecasts and financial insights.
          </p>
          <Link href="/upload" className="btn-primary inline-block">Upload CSV</Link>
        </div>
      )}

      {hasData && (
        <>
          {/* ── 1. Health overview row ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Business Health Score */}
            <div className="card">
              <p className="label mb-3">Business Health Score</p>
              <div className="flex items-end gap-2 mb-3">
                <span className={`text-4xl font-bold tabular-nums ${health.text}`}>{healthScore}</span>
                <span className="text-[#475569] text-sm mb-1">/100</span>
              </div>
              <div className="h-2 bg-[#E8EAE5] rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${health.bar}`} style={{ width: `${healthScore}%` }} />
              </div>
              <p className={`text-xs font-semibold ${health.text}`}>{health.label}</p>
            </div>

            {/* Cashflow Risk */}
            <div className={`card ${risk.bg} ${risk.border}`}>
              <p className="label mb-3">Cashflow Risk</p>
              <p className={`text-2xl font-bold mb-2 ${risk.text}`}>{risk.label}</p>
              <p className="text-xs text-[#6B7280] leading-relaxed">{risk.desc}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-2">{positiveCount} of {activeMonths.length} months positive</p>
            </div>

            {/* Business Direction */}
            <div className="card">
              <p className="label mb-3">Business Direction</p>
              <div className="mb-3">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${trend.bg} ${trend.text}`}>
                  {trend.label}
                </span>
              </div>
              {intel.trajectoryInsight && (
                <p className="text-xs text-[#6B7280] leading-relaxed">{intel.trajectoryInsight}</p>
              )}
            </div>
          </div>

          {/* Health status narrative */}
          {intel.healthStatusExplanation && (
            <div className={`rounded-2xl px-5 py-4 border ${health.bg} ${health.border}`}>
              <p className={`text-sm leading-relaxed ${health.text}`}>{intel.healthStatusExplanation}</p>
            </div>
          )}

          {/* ── 2. Year-End Projection ────────────────────────────────────── */}
          <div className="card">
            <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
              <div>
                <p className="label mb-1">Year-End Projection</p>
                <p className="text-xs text-[#9CA3AF]">
                  If current monthly averages continue for 12 months
                </p>
              </div>
              {forecast?.confidence && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-[#F3F4F0] ${
                  forecast.confidence === "high" ? "text-[#5B8A72]" :
                  forecast.confidence === "medium" ? "text-[#C79A63]" : "text-[#C66A5A]"
                }`}>
                  {forecast.confidence.charAt(0).toUpperCase() + forecast.confidence.slice(1)} confidence
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Projected Income",   value: formatCurrency(annualIncome),   sub: forecast ? `${formatCurrency(forecast.projectedIncome)}/mo avg` : null,   color: "text-[#5B8A72]",  border: "border-[#5B8A7215]" },
                { label: "Projected Expenses", value: formatCurrency(annualExpenses),  sub: forecast ? `${formatCurrency(forecast.projectedExpenses)}/mo avg` : null,  color: "text-[#C79A63]",  border: "border-[#C79A6315]" },
                { label: "Projected Cashflow", value: formatCurrency(annualCashflow),  sub: forecast ? `${formatCurrency(forecast.projectedIncome - forecast.projectedExpenses)}/mo avg` : null, color: annualCashflow >= 0 ? "text-[#4F7A65]" : "text-[#C66A5A]", border: "border-[#E8EAE5]" },
                { label: "Projected Runway",   value: `${projRunwayMonths >= 0 ? "+" : "−"}${Math.abs(projRunwayMonths).toFixed(1)} mo`, sub: projRunwayMonths >= 0 ? "months buffer per month" : "deficit per month", color: projRunwayMonths >= 0.5 ? "text-[#5B8A72]" : projRunwayMonths >= 0 ? "text-[#C79A63]" : "text-[#C66A5A]", border: "border-[#E8EAE5]" },
              ].map((item) => (
                <div key={item.label} className={`bg-[#F7F8F5] rounded-xl p-3 border ${item.border}`}>
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wide mb-1">{item.label}</p>
                  <p className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
                  {item.sub && <p className="text-[10px] text-[#9CA3AF] mt-1">{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. Key Drivers ────────────────────────────────────────────── */}
          {keyDrivers.length > 0 && (
            <div className="card">
              <p className="label mb-1">Key Drivers</p>
              <p className="text-xs text-[#9CA3AF] mb-4">What is shaping this forecast</p>
              <div className="space-y-2">
                {keyDrivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#F7F8F5] rounded-xl px-4 py-3">
                    <span className={`text-base flex-shrink-0 mt-0.5 font-bold ${d.positive ? "text-[#5B8A72]" : "text-[#C79A63]"}`}>
                      {d.positive ? "↑" : "↓"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">{d.label}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{d.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Risk + Opportunity ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div className="card border-[#C66A5A20]">
              <div className="flex items-start gap-3">
                <span className="text-[#C66A5A] text-xl flex-shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="label mb-2">Biggest Risk</p>
                  <p className="text-sm text-[#4B5563] leading-relaxed">
                    {intel.biggestRisk ?? "No significant risk detected based on current data."}
                  </p>
                </div>
              </div>
            </div>
            <div className="card bg-[#5B8A720A] border-[#5B8A7220]">
              <div className="flex items-start gap-3">
                <span className="text-[#5B8A72] text-xl flex-shrink-0 mt-0.5">★</span>
                <div>
                  <p className="label mb-2">Biggest Opportunity</p>
                  <p className="text-sm text-[#4B5563] leading-relaxed">
                    {intel.biggestOpportunity ?? "Maintain consistent cashflow and income levels."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. Recommended Actions ────────────────────────────────────── */}
          {intel.forecastImprovements.length > 0 && (
            <div className="card bg-[#4F7A650A] border border-[#4F7A6518]">
              <p className="label mb-1">Recommended Actions</p>
              <p className="text-xs text-[#9CA3AF] mb-4">
                Specific steps derived from your actual financial patterns:
              </p>
              <div className="space-y-3">
                {intel.forecastImprovements.slice(0, 4).map((action, i) => (
                  <div key={i} className="flex items-start gap-4 bg-[#F7F8F5] rounded-xl p-3 md:p-4">
                    <span className="text-xs font-bold text-[#4F7A65] bg-[#4F7A6520] w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-[#4B5563] leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Seasonal Insights ──────────────────────────────────────── */}
          {intel.seasonalInsights.length > 0 && (
            <div className="card">
              <p className="label mb-4">Seasonal Patterns</p>
              <div className="space-y-2">
                {intel.seasonalInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#F7F8F5] rounded-xl px-4 py-3">
                    <span className="text-[#4F7A65] text-sm mt-0.5 flex-shrink-0">◆</span>
                    <p className="text-sm text-[#4B5563]">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 7. How This Forecast Was Built ────────────────────────────── */}
          <div className="card">
            <p className="label mb-4">How This Forecast Was Built</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: "Data analyzed",
                  value: coverage.earliest && coverage.latest
                    ? `${fmtDate(coverage.earliest)} – ${fmtDate(coverage.latest)}`
                    : "—",
                },
                {
                  label: "Months of history",
                  value: `${forecast?.basedOnMonths ?? monthCount} months`,
                },
                {
                  label: "Transactions",
                  value: coverage.count.toLocaleString(),
                },
                {
                  label: "Forecast confidence",
                  value: forecast?.confidence
                    ? forecast.confidence.charAt(0).toUpperCase() + forecast.confidence.slice(1)
                    : "—",
                  color: forecast?.confidence === "high" ? "text-[#5B8A72]" :
                         forecast?.confidence === "medium" ? "text-[#C79A63]" : "text-[#C66A5A]",
                },
              ].map((item) => (
                <div key={item.label} className="bg-[#F7F8F5] rounded-xl p-4">
                  <p className="label mb-2">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.color ?? "text-[#4B5563]"}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B8A72] flex-shrink-0" />
              <p className="text-xs text-[#9CA3AF]">
                Forecast recalculated now using all available data.
                {forecast?.seasonallyAdjusted && " Seasonal patterns from 24+ months applied."}
              </p>
            </div>
            <div className="text-xs text-[#B8BFC8] space-y-2 border-t border-[#ECEEE9] pt-4 leading-relaxed">
              <p>· Recent months are weighted 3× more heavily than older months when calculating averages.</p>
              {forecast?.seasonallyAdjusted && (
                <p>· Seasonal adjustment applied: months that are historically stronger or weaker are accounted for.</p>
              )}
              <p>· {CONFIDENCE_LABEL[forecast?.confidence ?? "low"]}. More history produces a more reliable forecast.</p>
            </div>
          </div>

          <TrendsChart data={chartData} />
        </>
      )}
    </div>
  );
}
