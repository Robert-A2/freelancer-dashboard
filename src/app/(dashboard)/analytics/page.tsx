import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getHistoricalData, getCategoryInsights, getClientInsights, getDataCoverage, getIncomeConcentration,
  getCategorizationHealth,
} from "@/lib/analytics-engine";
import { buildHistoricalInsights } from "@/lib/intelligence-engine";
import DataCoverageBar from "@/components/dashboard/DataCoverage";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/utils/finance";
import CashflowChart from "@/components/analytics/CashflowChart";
import ClientInsights from "@/components/analytics/ClientInsights";
import FinancialStory from "@/components/analytics/FinancialStory";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import Link from "next/link";

export const dynamic = "force-dynamic";

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function ChangeChip({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#D9707015] text-[#D97070]"}`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Anchor YTD to the user's most recent data year, not the current calendar year.
  // A user with data ending Dec 2024 visiting in 2026 would otherwise see €0 for both years.
  const latestDataRecord = await prisma.monthlyAnalytics.findFirst({
    where: { userId: user.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true, month: true },
  });

  const now          = new Date();
  const dataYear     = latestDataRecord?.year  ?? now.getUTCFullYear();
  const prevYear     = dataYear - 1;
  // Cap at the latest data month — never inflate to 12 for a past year
  const dataMonthMax = latestDataRecord?.month ?? now.getUTCMonth() + 1;

  // Exactly 12 months ending at the last data month — UTC midnight
  const incSince = new Date(Date.UTC(dataYear, dataMonthMax - 12, 1));

  const [chartData, categoryInsights, categoryBreakdown, incomeBySource, ytdThis, ytdPrev, clientInsights, coverage, concentration, categorizationHealth] =
    await Promise.all([
      getHistoricalData(user.id, 999),
      getCategoryInsights(user.id),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, transactionType: "expense" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      }),
      prisma.transaction.groupBy({
        by: ["category"],
        where: { userId: user.id, transactionType: "income", transactionDate: { gte: incSince } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 8,
      }),
      prisma.monthlyAnalytics.aggregate({
        where: { userId: user.id, year: dataYear, month: { lte: dataMonthMax } },
        _sum: { totalIncome: true, totalExpenses: true, totalSavings: true, netCashflow: true },
      }),
      prisma.monthlyAnalytics.aggregate({
        where: { userId: user.id, year: prevYear, month: { lte: dataMonthMax } },
        _sum: { totalIncome: true, totalExpenses: true, totalSavings: true, netCashflow: true },
      }),
      getClientInsights(user.id),
      getDataCoverage(user.id),
      getIncomeConcentration(user.id),
      getCategorizationHealth(user.id),
    ]);

  const hasData = chartData.some(d => d.income > 0 || d.expenses > 0);
  const nonZeroMonths = chartData.filter((d) => d.income > 0 || d.expenses > 0).length;

  const rankedInsights = buildHistoricalInsights(
    chartData,
    categoryInsights.topExpenseCategories,
    categoryInsights.yearlySnapshots,
    categoryInsights.seasonality,
    concentration
  );

  const ytdInc  = Number(ytdThis._sum.totalIncome   ?? 0);
  const ytdExp  = Number(ytdThis._sum.totalExpenses  ?? 0);
  const prevInc  = Number(ytdPrev._sum.totalIncome   ?? 0);
  const prevExp  = Number(ytdPrev._sum.totalExpenses ?? 0);

  // Cashflow = income − expenses (savings excluded from display)
  const ytdCash  = ytdInc  - ytdExp;
  const prevCash = prevInc - prevExp;

  // Runway: monthly surplus / avg monthly expenses over the YTD period
  const activeMonthsYtd = chartData.filter(d => d.income > 0 || d.expenses > 0);
  const last6Ytd        = activeMonthsYtd.slice(-6);
  const avgExpYtd       = last6Ytd.length > 0 ? last6Ytd.reduce((s, d) => s + d.expenses, 0) / last6Ytd.length : 0;
  const ytdMonthCount   = dataMonthMax;
  const avgMonthlyCashYtd  = ytdMonthCount > 0 ? ytdCash  / ytdMonthCount : 0;
  const avgMonthlyCashPrev = ytdMonthCount > 0 ? prevCash / ytdMonthCount : 0;
  const ytdRunway  = avgExpYtd > 0 ? avgMonthlyCashYtd  / avgExpYtd : 0;
  const prevRunway = avgExpYtd > 0 ? avgMonthlyCashPrev / avgExpYtd : 0;

  const totalExpenses = categoryBreakdown.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);
  const totalIncSrc   = incomeBySource.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);

  return (
    <div className="space-y-8 md:space-y-10">

      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">Deep dive into your financial patterns</p>
      </div>

      {coverage.count > 0 && <DataCoverageBar coverage={coverage} />}

      {!hasData && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">No data yet</h2>
          <p className="text-[#7BA8C4] mb-6 max-w-sm mx-auto">Upload your bank statement to unlock full analytics.</p>
          <Link href="/upload" className="btn-primary inline-block">Upload CSV</Link>
        </div>
      )}

      {hasData && (
        <>
          {/* ── 1. Year-to-date vs prior year ─────────────────────────────── */}
          <CollapsibleSection
            label="Year to date"
            title={`${dataYear} vs ${prevYear}`}
            subtitle={`Jan – ${new Date(Date.UTC(dataYear, dataMonthMax - 1, 1)).toLocaleDateString("en-IE", { month: "short", timeZone: "UTC" })} (same window both years)`}
          >
            <div className="card">
              {prevInc === 0 && (
                <p className="text-xs text-[#6A97B4] mb-4">No {prevYear} data yet</p>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Income",   curr: ytdInc,  prev: prevInc,  color: "text-[#4CC4A4]", invert: false, isCurrency: true  },
                  { label: "Expenses", curr: ytdExp,  prev: prevExp,  color: "text-[#D4A254]", invert: true,  isCurrency: true  },
                  { label: "Cashflow", curr: ytdCash, prev: prevCash, color: ytdCash >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]", invert: false, isCurrency: true },
                  { label: "Runway",   curr: ytdRunway, prev: prevRunway,
                    color: ytdRunway >= 0.5 ? "text-[#4CC4A4]" : ytdRunway >= 0 ? "text-[#D4A254]" : "text-[#D97070]",
                    invert: false, isCurrency: false },
                ].map((item) => {
                  const change = prevInc > 0 ? pctChange(item.curr, item.prev) : null;
                  const displayVal = item.isCurrency
                    ? formatCurrency(item.curr)
                    : `${item.curr >= 0 ? "+" : "−"}${Math.abs(item.curr).toFixed(1)} mo`;
                  const prevDisplayVal = item.isCurrency
                    ? `${formatCurrency(item.prev)} last yr`
                    : `${item.prev >= 0 ? "+" : "−"}${Math.abs(item.prev).toFixed(1)} mo last yr`;
                  return (
                    <div key={item.label} className="bg-[#1A3048] rounded-xl p-4">
                      <p className="label mb-1">{item.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${item.color} mb-1`}>{displayVal}</p>
                      <div className="flex items-center gap-2">
                        {change !== null && <ChangeChip value={change} invert={item.invert} />}
                        {item.prev !== 0 && <span className="text-xs text-[#6A97B4]">{prevDisplayVal}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleSection>

          {/* ── 2. Cashflow chart with intelligence ───────────────────────── */}
          <CollapsibleSection label="Monthly cashflow" title="Income minus Expenses">
            <CashflowChart data={chartData} hideHeader />
          </CollapsibleSection>

          {/* ── 3. Income sources + Expense breakdown ─────────────────────── */}
          <CollapsibleSection label="Breakdowns" title="Income sources & Expenses">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              <div className="card">
                <p className="label mb-1">Income sources</p>
                <p className="text-xs text-[#6A97B4] mb-4">Last 12 months, where money came in</p>
                {incomeBySource.length === 0 ? (
                  <p className="text-[#7BA8C4] text-sm">No income data</p>
                ) : (
                  <div className="space-y-4">
                    {incomeBySource.map((src) => {
                      const amount = Number(src._sum.amount ?? 0);
                      const pct = totalIncSrc > 0 ? Math.round((amount / totalIncSrc) * 100) : 0;
                      return (
                        <div key={src.category}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize text-[#A8C6E0]">{src.category}</span>
                            <div className="flex gap-3">
                              <span className="text-[#6A97B4]">{pct}%</span>
                              <span className="font-medium text-[#4CC4A4]">{formatCurrency(amount)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                            <div className="h-full bg-[#4CC4A4] rounded-full opacity-70" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card">
                <p className="label mb-1">Expense breakdown</p>
                <p className="text-xs text-[#6A97B4] mb-4">All time, share of total spending</p>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-[#7BA8C4] text-sm">No expense data</p>
                ) : (
                  <div className="space-y-4">
                    {categoryBreakdown.map((cat) => {
                      const amount = Number(cat._sum.amount ?? 0);
                      const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
                      const trend = categoryInsights.topExpenseCategories.find(c => c.category === cat.category);
                      const arrow = trend?.yearOverYearTrend === "growing" ? "↑" : trend?.yearOverYearTrend === "declining" ? "↓" : "";
                      const arrowColor = trend?.yearOverYearTrend === "growing" ? "text-[#D97070]" : "text-[#4CC4A4]";
                      return (
                        <div key={cat.category}>
                          <div className="flex justify-between text-sm mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="capitalize text-[#A8C6E0]">{cat.category}</span>
                              {arrow && <span className={`text-xs font-bold ${arrowColor}`}>{arrow}</span>}
                            </div>
                            <div className="flex gap-3">
                              <span className="text-[#6A97B4]">{pct}%</span>
                              <span className="font-medium text-[#D4A254]">{formatCurrency(amount)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                            <div className="h-full bg-[#D4A254] rounded-full opacity-70" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* ── 3b. Categorization health ─────────────────────────────────── */}
          <CollapsibleSection
            label="Categorization health"
            title="How well we understand your transactions"
            subtitle="Categorization accuracy, plus the merchants that need your attention."
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
              <div className="card lg:col-span-1">
                <p className="label mb-1">Categorized</p>
                <p className="text-3xl font-bold text-[#4CC4A4] mb-1">{categorizationHealth.categorizedPct}%</p>
                <p className="text-xs text-[#6A97B4]">
                  {categorizationHealth.uncategorizedCount.toLocaleString()} of {categorizationHealth.totalCount.toLocaleString()} transactions
                  ({categorizationHealth.uncategorizedPct}%) still uncategorized
                </p>
                <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-[#4CC4A4] rounded-full opacity-70" style={{ width: `${categorizationHealth.categorizedPct}%` }} />
                </div>
                {categorizationHealth.uncategorizedCount > 0 && (
                  <Link href="/history?confidence=low" className="inline-block mt-4 text-sm text-[#3AB5A0] hover:text-[#4CC4A4] font-medium transition-colors">
                    Review uncategorized →
                  </Link>
                )}
              </div>

              <div className="card lg:col-span-1">
                <p className="label mb-1">Most common uncategorized merchants</p>
                <p className="text-xs text-[#6A97B4] mb-4">Worth a manual fix — we&apos;ll remember it next time</p>
                {categorizationHealth.topUncategorizedMerchants.length === 0 ? (
                  <p className="text-[#7BA8C4] text-sm">Nothing uncategorized — nicely done.</p>
                ) : (
                  <ul className="space-y-2">
                    {categorizationHealth.topUncategorizedMerchants.map((m) => (
                      <li key={m.description} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#A8C6E0] truncate">{m.description}</span>
                        <span className="text-[#6A97B4] flex-shrink-0">{m.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card lg:col-span-1">
                <p className="label mb-1">Most corrected merchants</p>
                <p className="text-xs text-[#6A97B4] mb-4">Manual fixes that taught the system new rules</p>
                {categorizationHealth.topCorrectedMerchants.length === 0 ? (
                  <p className="text-[#7BA8C4] text-sm">No corrections yet — categories are running on built-in rules.</p>
                ) : (
                  <ul className="space-y-2">
                    {categorizationHealth.topCorrectedMerchants.map((m) => (
                      <li key={m.description} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#A8C6E0] truncate">{m.description}</span>
                        <span className="text-[#6A97B4] flex-shrink-0">{m.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* ── 4. Client Insights ────────────────────────────────────────── */}
          {clientInsights && (
            <CollapsibleSection
              label="Client insights"
              title="Where your revenue comes from"
              subtitle="Revenue concentration, client activity, and growth."
            >
              <ClientInsights data={clientInsights} />
            </CollapsibleSection>
          )}

          {/* ── 5. Financial Story — full ranked & grouped historical insights ── */}
          {rankedInsights.length > 0 && (
            <div id="financial-story">
              <CollapsibleSection
                label="Your financial story"
                title="Full historical analysis"
                subtitle="Every insight from your upload history, grouped by theme."
              >
                <FinancialStory insights={rankedInsights} totalMonths={nonZeroMonths} />
              </CollapsibleSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}
