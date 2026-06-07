import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getDashboardSummary,
  getHistoricalData,
  getMonthlyComparison,
  getDataCoverage,
  getCategoryInsights,
  getIncomeConcentration,
} from "@/lib/analytics-engine";
import { getLatestForecast } from "@/lib/forecast-engine";
import { generateDashboardIntelligence } from "@/lib/intelligence-engine";
import { prisma } from "@/lib/prisma";
import SummaryCards from "@/components/dashboard/SummaryCards";
import TrendsChart from "@/components/dashboard/TrendsChart";
import MonthlyComparisonWidget from "@/components/dashboard/MonthlyComparison";
import ForecastWidget from "@/components/dashboard/ForecastWidget";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import HistoricalInsights from "@/components/dashboard/HistoricalInsights";
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

  const params = await searchParams;

  const [summary, forecast, chartData, comparison, totalTx, coverage, categoryInsights, concentration, dbUser, lastImport] =
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
    concentration
  );

  const hasData = totalTx > 0;
  const nonZeroMonths = chartData.filter((d) => d.income > 0 || d.expenses > 0).length;

  // Runway and risk computed from historical data
  const activeMonths      = chartData.filter(d => d.income > 0 || d.expenses > 0);
  const last6Active       = activeMonths.slice(-6);
  const avgMonthlyExpenses = last6Active.length > 0
    ? last6Active.reduce((s, d) => s + d.expenses, 0) / last6Active.length
    : 0;
  const currCashflow  = current  ? current.totalIncome  - current.totalExpenses  : 0;
  const prevCashflow  = previous ? previous.totalIncome - previous.totalExpenses : 0;
  const runway        = avgMonthlyExpenses > 0 ? currCashflow / avgMonthlyExpenses : 0;
  const prevRunway    = avgMonthlyExpenses > 0 ? prevCashflow / avgMonthlyExpenses : 0;

  const last12Active       = activeMonths.slice(-12);
  const riskPositiveMonths = last12Active.filter(d => d.income - d.expenses >= 0).length;
  const riskTotalMonths    = last12Active.length;
  const posRatio           = riskTotalMonths > 0 ? riskPositiveMonths / riskTotalMonths : 0;
  const riskLevel: "low" | "medium" | "high" | "critical" =
    posRatio >= 0.85 ? "low" :
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

  // Combine all historical intelligence into one section
  const allHistoricalInsights = [
    ...intel.historicalHighlights,
    ...intel.seasonalInsights,
    ...intel.categoryInsights,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-2xl font-bold">
              {firstName ? `Welcome back, ${firstName}.` : "Dashboard"}
            </h1>
            {hasData && (
              <Link href="/forecast" className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${
                intel.healthStatus === "healthy"  ? "bg-[#4CC4A415] text-[#4CC4A4]" :
                intel.healthStatus === "at-risk"  ? "bg-[#D9707015] text-[#D97070]" :
                                                    "bg-[#D4A25415] text-[#D4A254]"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {intel.healthStatus === "healthy" ? "Healthy" : intel.healthStatus === "watch" ? "Watch closely" : "At Risk"}
              </Link>
            )}
          </div>
          <p className="text-[#7299B4] text-sm">
            {new Date().toLocaleDateString("en-IE", { month: "long", year: "numeric" })}
          </p>
        </div>
        {hasData && (
          <p className="text-xs text-[#4A6882] flex-shrink-0 mt-1">
            {totalTx.toLocaleString()} transactions · {nonZeroMonths} months
          </p>
        )}
      </div>

      {/* Data freshness prompt */}
      {dataIsStale && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#D4A2540A] border border-[#D4A25425] rounded-xl">
          <p className="text-sm text-[#D4A254]">
            Your data is {daysSinceImport} days old. Upload last month&apos;s statement to keep insights accurate.
          </p>
          <Link href="/upload" className="text-xs font-semibold text-[#D4A254] hover:text-[#D8E8F4] transition-colors flex-shrink-0 bg-[#D4A25420] px-3 py-1.5 rounded-lg">
            Upload →
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
          <h2 className="text-xl font-semibold mb-2">Built for freelancers</h2>
          <p className="text-[#4A6882] mb-6 max-w-sm mx-auto">
            Upload your bank statement CSV to get cashflow clarity, intelligent insights,
            and forecasts designed specifically for freelance income patterns.
          </p>
          <Link href="/upload" className="btn-primary inline-block">
            Upload CSV
          </Link>
        </div>
      ) : (
        <>
          <SummaryCards
            current={current}
            previous={previous}
            runway={runway}
            prevRunway={prevRunway}
            riskLevel={riskLevel}
            riskPositiveMonths={riskPositiveMonths}
            riskTotalMonths={riskTotalMonths}
            summary={intel.snapshotSummary}
            context={intel.snapshotContext}
          />

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

          {allHistoricalInsights.length > 0 && (
            <HistoricalInsights
              highlights={allHistoricalInsights}
              totalMonths={nonZeroMonths}
            />
          )}
        </>
      )}
    </div>
  );
}
