import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getHistoricalData, getMonthlyComparison,
  getDashboardSummary, getCategoryInsights, getIncomeConcentration,
} from "@/lib/analytics-engine";
import { getLatestForecast } from "@/lib/forecast-engine";
import { generateDashboardIntelligence } from "@/lib/intelligence-engine";
import { prisma } from "@/lib/prisma";
import TrendsChart from "@/components/dashboard/TrendsChart";
import { formatCurrency } from "@/utils/finance";
import Link from "next/link";

export const dynamic = "force-dynamic";

const HEALTH = {
  healthy:   { emoji: "🟢", label: "Healthy",      bg: "bg-[#22C55E0d]", border: "border-[#22C55E30]", text: "text-[#22C55E]" },
  watch:     { emoji: "🟡", label: "Watch Closely", bg: "bg-[#F59E0B0d]", border: "border-[#F59E0B30]", text: "text-[#F59E0B]" },
  "at-risk": { emoji: "🔴", label: "At Risk",       bg: "bg-[#EF44440d]", border: "border-[#EF444430]", text: "text-[#EF4444]" },
};

const TREND = {
  improving: { label: "↑ Improving", bg: "bg-[#22C55E20]", text: "text-[#22C55E]" },
  stable:    { label: "→ Stable",    bg: "bg-[#1E293B]",   text: "text-[#94A3B8]" },
  weakening: { label: "↓ Weakening", bg: "bg-[#EF444420]", text: "text-[#EF4444]" },
};

export default async function ForecastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [forecast, chartData, monthCount, summary, comparison, categoryInsights, concentration] =
    await Promise.all([
      getLatestForecast(user.id),
      getHistoricalData(user.id, 999),
      prisma.monthlyAnalytics.count({ where: { userId: user.id } }),
      getDashboardSummary(user.id),
      getMonthlyComparison(user.id),
      getCategoryInsights(user.id),
      getIncomeConcentration(user.id),
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
  const annualIncome   = forecast ? forecast.projectedIncome   * 12 : 0;
  const annualExpenses = forecast ? forecast.projectedExpenses * 12 : 0;
  const annualSavings  = forecast ? forecast.projectedSavings  * 12 : 0;
  const annualCashflow = forecast ? forecast.projectedCashflow * 12 : 0;

  const health = HEALTH[intel.healthStatus];
  const trend  = TREND[intel.businessTrendDirection];

  return (
    <div className="space-y-5 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forecast</h1>
        <p className="text-[#94A3B8] text-sm mt-0.5">
          {hasData ? `Based on ${monthCount} month${monthCount !== 1 ? "s" : ""} of financial history` : "Upload a CSV to generate your forecast"}
        </p>
      </div>

      {!hasData && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📈</div>
          <h2 className="text-xl font-semibold mb-2">No data to forecast yet</h2>
          <p className="text-[#94A3B8] mb-6 max-w-sm mx-auto">
            Upload your bank statement CSV to generate personalised forecasts and financial insights.
          </p>
          <Link href="/upload" className="btn-primary inline-block">Upload CSV</Link>
        </div>
      )}

      {hasData && (
        <>
          {/* 1. Health Status — label removed to reduce stress; colour + text convey status calmly */}
          {intel.healthStatusExplanation && (
            <div className={`rounded-2xl px-5 py-4 border ${health.bg} ${health.border}`}>
              <p className={`text-sm leading-relaxed ${health.text}`}>{intel.healthStatusExplanation}</p>
            </div>
          )}

          {/* 2 + 5. Business Trend + Annual Outlook */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
            <div className="card">
              <p className="label mb-3">Business Health Trend</p>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${trend.bg} ${trend.text}`}>
                  {trend.label}
                </span>
              </div>
              {intel.trajectoryInsight && (
                <p className="text-sm text-[#CBD5E1] leading-relaxed mb-3">{intel.trajectoryInsight}</p>
              )}
              {intel.trajectoryDetails.length > 0 && (
                <ul className="space-y-1.5">
                  {intel.trajectoryDetails.map((line, i) => (
                    <li key={i} className="text-xs text-[#94A3B8] flex items-start gap-2">
                      <span className="text-[#14B8A6] mt-0.5 flex-shrink-0">·</span>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <p className="label mb-1">Annual Outlook</p>
              <p className="text-xs text-[#94A3B8] mb-4">If current trends continue over 12 months:</p>
              <div className="space-y-0">
                {[
                  { label: "Projected Income",   value: annualIncome,   color: "text-[#22C55E]" },
                  { label: "Projected Expenses",  value: annualExpenses, color: "text-[#F59E0B]" },
                  { label: "Projected Savings",   value: annualSavings,  color: "text-[#3B82F6]" },
                  { label: "Projected Cashflow",  value: annualCashflow, color: annualCashflow >= 0 ? "text-[#06B6D4]" : "text-[#EF4444]" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-[#1E293B] last:border-0">
                    <span className="text-sm text-[#CBD5E1]">{item.label}</span>
                    <span className={`text-lg font-bold tabular-nums ${item.color}`}>{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3 + 4. Risk + Opportunity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div className="card border-[#EF444420]">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="label mb-2">Biggest Risk</p>
                  <p className="text-sm text-[#CBD5E1] leading-relaxed">
                    {intel.biggestRisk ?? "No significant risk detected based on current data."}
                  </p>
                </div>
              </div>
            </div>

            <div className="card bg-[#22C55E0a] border-[#22C55E20]">
              <div className="flex items-start gap-3">
                <span className="text-[#22C55E] text-xl flex-shrink-0 mt-0.5">★</span>
                <div>
                  <p className="label mb-2">Biggest Opportunity</p>
                  <p className="text-sm text-[#CBD5E1] leading-relaxed">
                    {intel.biggestOpportunity ?? "Maintain consistent savings and income levels."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Seasonal Insights */}
          {intel.seasonalInsights.length > 0 && (
            <div className="card">
              <p className="label mb-4">Seasonal Patterns</p>
              <div className="space-y-2">
                {intel.seasonalInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#0A1020] rounded-xl px-4 py-3">
                    <span className="text-[#3B82F6] text-sm mt-0.5 flex-shrink-0">◆</span>
                    <p className="text-sm text-[#CBD5E1]">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Forecast Actions */}
          {intel.forecastImprovements.length > 0 && (
            <div className="card bg-[#14B8A60a] border border-[#14B8A618]">
              <p className="label mb-1">Forecast Actions</p>
              <p className="text-xs text-[#94A3B8] mb-4">
                Based on your data, these actions would have the highest impact:
              </p>
              <div className="space-y-3">
                {intel.forecastImprovements.slice(0, 3).map((action, i) => (
                  <div key={i} className="flex items-start gap-4 bg-[#0A1020] rounded-xl p-3 md:p-4">
                    <span className="text-xs font-bold text-[#14B8A6] bg-[#14B8A620] w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-[#CBD5E1] leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <TrendsChart data={chartData} />
        </>
      )}
    </div>
  );
}
