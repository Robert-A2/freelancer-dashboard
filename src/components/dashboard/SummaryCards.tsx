"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";
import Link from "next/link";

interface MonthData {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netCashflow: number;
}

interface Props {
  current: MonthData | null;
  previous: MonthData | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskPositiveMonths: number;
  riskTotalMonths: number;
  incomeTrendPct?: number;
  summary?: Insight | null;
  context?: Insight[];
  periodLabel?: string;
  currentMonth?: number;
  currentYear?: number;
  isPartialMonth?: boolean;
  basePath?: string;
}

const RISK_COLOR = {
  low:      "text-[#4CC4A4]",
  medium:   "text-[#D4A254]",
  high:     "text-[#D97070]",
  critical: "text-[#D97070]",
};

const VERDICT_STYLE = {
  low:      { bg: "bg-[#4CC4A40A]", border: "border-[#4CC4A415]" },
  medium:   { bg: "bg-[#D4A2540A]", border: "border-[#D4A25415]" },
  high:     { bg: "bg-[#D970700A]", border: "border-[#D9707015]" },
  critical: { bg: "bg-[#D970700A]", border: "border-[#D9707015]" },
};

// The verdict card can carry up to ~5 independent supporting bullets at once
// (income vs. average, expenses vs. average, cashflow drop, client
// concentration, plus more as new signals get added) — showing all of them
// by default turns "here's the verdict" into "here's a report to read."
// Capping keeps the first glance calm; nothing is lost, just tucked behind
// the same show-more pattern used on the trend chart below.
const CONTEXT_BULLET_CAP = 2;

function changePct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function Chip({ value, invert }: { value: number; invert?: boolean }) {
  const isGood = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
      isGood ? "bg-[#4CC4A410] text-[#4CC4A4]" : "bg-[#D9707010] text-[#D97070]"
    }`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

// A small top-right hint instead of a full "View transactions →" text row —
// the whole card is the click target now, this just signals "clickable"
// on hover without spending a permanent line of colored text on it.
function Chevron() {
  return (
    <svg className="absolute top-3.5 right-3.5 w-3 h-3 text-[#4A7A9B] opacity-0 group-hover:opacity-70 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function SummaryCards({
  current, previous, riskLevel, riskPositiveMonths, riskTotalMonths, incomeTrendPct, summary, context, periodLabel, currentMonth, currentYear, isPartialMonth, basePath = "",
}: Props) {
  const t = useTranslations("dashboard.summaryCards");
  const tm = useTranslations("metrics");
  const locale = useLocale() as Locale;
  const c = current  ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };
  const p = previous ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };

  // Cashflow = netCashflow (Income − Expenses) — single definition shared with
  // charts, risk/health scoring, and forecasts (see analytics-engine.ts).
  const currCashflow  = c.netCashflow;
  const prevCashflow  = p.netCashflow;
  const spendRate     = c.totalIncome > 0 ? Math.round((c.totalExpenses / c.totalIncome) * 100) : 0;
  const margin        = c.totalIncome > 0 ? 100 - spendRate : null;
  const prevSpendRate = p.totalIncome > 0 ? Math.round((p.totalExpenses / p.totalIncome) * 100) : 0;
  const prevMargin    = p.totalIncome > 0 ? 100 - prevSpendRate : null;
  const riskColor     = RISK_COLOR[riskLevel];

  const marginColor   = margin === null ? "text-[#6A97B4]"
    : margin >= 30 ? "text-[#4CC4A4]"
    : margin >= 10 ? "text-[#D4A254]"
    : "text-[#D97070]";

  const drillBase = currentMonth && currentYear
    ? `?year=${currentYear}&month=${currentMonth}`
    : null;
  const incomeUrl  = drillBase ? `${basePath}/history${drillBase}&type=income`  : `${basePath}/history`;
  const expenseUrl = drillBase ? `${basePath}/history${drillBase}&type=expense` : `${basePath}/history`;
  const allTxUrl   = drillBase ? `${basePath}/history${drillBase}`              : `${basePath}/history`;

  const verdictStyle = VERDICT_STYLE[riskLevel];

  // Explains an otherwise-confusing case: every month cashflow-positive, but
  // risk is still above "low" — that only happens when income has been
  // trending down recently despite past months staying positive. Without
  // this note the badge looks self-contradictory next to "X of X positive."
  const positiveRatio = riskTotalMonths > 0 ? riskPositiveMonths / riskTotalMonths : 0;
  const showRiskTrendNote = riskLevel !== "low" && positiveRatio >= 0.85 && incomeTrendPct !== undefined && incomeTrendPct < 0;

  // "This analysis covers X months..." is metadata about the data, not a
  // reason for the verdict — it reads as a caption, not a bulleted insight.
  const coverageNote = context?.find((line) => line.key === "insights.context.analysisCovers");
  const reasons = context?.filter((line) => line.key !== "insights.context.analysisCovers") ?? [];
  const [reasonsExpanded, setReasonsExpanded] = useState(false);
  const visibleReasons = reasonsExpanded ? reasons : reasons.slice(0, CONTEXT_BULLET_CAP);
  const hiddenReasonsCount = Math.max(0, reasons.length - CONTEXT_BULLET_CAP);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {periodLabel && (
          <>
            <span className="text-xs font-semibold text-[#6A97B4] uppercase tracking-wide">{t("showing")}</span>
            <span className="text-xs font-semibold text-[#E8F0F8] bg-[#1A3048] border border-[#243F5E] px-2.5 py-0.5 rounded-md">{periodLabel}</span>
          </>
        )}
        {isPartialMonth && (
          <span className="text-xs font-medium text-[#D4A254] bg-[#D4A25410] border border-[#D4A25430] px-2.5 py-0.5 rounded-md">
            {t("partialMonth")}
          </span>
        )}
      </div>

      {/* Verdict first — answer "How is my business doing?" before showing numbers */}
      {summary && (
        <div className={`${verdictStyle.bg} border ${verdictStyle.border} rounded-xl px-5 py-4 space-y-2.5`}>
          <p className="text-sm font-medium text-[#E8F0F8] leading-relaxed">
            <InsightText insight={summary} />
          </p>
          {coverageNote && (
            <p className="text-xs text-[#6A97B4]/70 leading-relaxed">
              <InsightText insight={coverageNote} />
            </p>
          )}
          {visibleReasons.length > 0 && (
            <ul className="space-y-2">
              {visibleReasons.map((line, i) => (
                <li key={i} className="text-sm text-[#A8C6E0] flex items-start gap-2.5 leading-relaxed">
                  <span className="text-[#7BA8C4] opacity-60 mt-1 flex-shrink-0">·</span>
                  <span><InsightText insight={line} /></span>
                </li>
              ))}
            </ul>
          )}
          {hiddenReasonsCount > 0 && (
            <button
              onClick={() => setReasonsExpanded(!reasonsExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-[#7BA8C4] hover:text-[#A8C6E0] transition-colors"
            >
              {reasonsExpanded ? t("showFewerReasons") : t("showMoreReasons", { count: hiddenReasonsCount })}
              <svg className={`w-3.5 h-3.5 transition-transform ${reasonsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-stretch">

        {/* Income */}
        <Link href={incomeUrl} className="group relative card-sm flex flex-col gap-2 hover:border-[#2A4A6B] transition-colors">
          <Chevron />
          <p className="label">{tm("income")}</p>
          <p className="text-xl md:text-2xl font-bold text-[#4CC4A4] leading-none tabular-nums">
            {formatCurrency(c.totalIncome, locale)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">{periodLabel || t("totalThisMonth")}</p>
            {previous && p.totalIncome > 0 && <Chip value={changePct(c.totalIncome, p.totalIncome)} />}
          </div>
        </Link>

        {/* Expenses */}
        <Link href={expenseUrl} className="group relative card-sm flex flex-col gap-2 hover:border-[#2A4A6B] transition-colors">
          <Chevron />
          <p className="label">{tm("expenses")}</p>
          <p className="text-xl md:text-2xl font-bold text-[#D4A254] leading-none tabular-nums">
            {formatCurrency(c.totalExpenses, locale)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">{periodLabel || t("totalThisMonth")}</p>
            {previous && p.totalExpenses > 0 && <Chip value={changePct(c.totalExpenses, p.totalExpenses)} invert />}
          </div>
        </Link>

        {/* Cashflow */}
        <Link href={allTxUrl} className="group relative card-sm flex flex-col gap-2 hover:border-[#2A4A6B] transition-colors">
          <Chevron />
          <p className="label">{tm("cashflow")}</p>
          <p className={`text-xl md:text-2xl font-bold leading-none tabular-nums ${currCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]"}`}>
            {formatCurrency(currCashflow, locale)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">
              {currCashflow >= 0 ? t("incomeAboveExpenses") : t("expensesExceedIncome")}
            </p>
            {previous && prevCashflow !== 0 && <Chip value={changePct(currCashflow, prevCashflow)} />}
          </div>
          <p className="text-[11px] text-[#6A97B4]/60">{periodLabel ? `${periodLabel} · ${t("cashflowSavingsNote")}` : t("cashflowSavingsNote")}</p>
        </Link>

        {/* Margin — no drill-down page yet, stays a plain (non-clickable) tile */}
        <div className="card-sm flex flex-col gap-2">
          <p className="label">{tm("margin")}</p>
          <p className={`text-xl md:text-2xl font-bold leading-none tabular-nums ${marginColor}`}>
            {margin !== null ? `${margin}%` : "—"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">{periodLabel || t("ofIncomeKept")}</p>
            {previous && margin !== null && prevMargin !== null && prevMargin > 0 && (
              <Chip value={margin - prevMargin} />
            )}
          </div>
        </div>

        {/* Risk — col-span-2 on mobile so it fills the row cleanly */}
        <Link
          href={`${basePath}/forecast`}
          className="group relative card-sm flex flex-col gap-2 col-span-2 md:col-span-1 hover:border-[#2A4A6B] transition-colors"
        >
          <Chevron />
          <p className="label">{t("risk")}</p>
          <p className={`text-xl md:text-2xl font-bold leading-none ${riskColor}`}>
            {t(`riskLevels.${riskLevel}`)}
          </p>
          <p className="text-[13px] text-[#6A97B4]">
            {riskTotalMonths > 0
              ? t("monthsPositive", { positive: riskPositiveMonths, total: riskTotalMonths })
              : t("noHistory")}
          </p>
          {showRiskTrendNote && (
            <p className="text-[11px] text-[#D4A254] leading-snug -mt-1.5">
              {t("riskTrendNote", { pct: Math.abs(incomeTrendPct as number) })}
            </p>
          )}
        </Link>

      </div>
    </div>
  );
}
