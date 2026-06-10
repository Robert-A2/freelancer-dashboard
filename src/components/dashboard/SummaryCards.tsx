"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

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
  summary?: Insight | null;
  context?: Insight[];
  periodLabel?: string;
}

const RISK_COLOR = {
  low:      "text-[#4CC4A4]",
  medium:   "text-[#D4A254]",
  high:     "text-[#D97070]",
  critical: "text-[#D97070]",
};

function changePct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function Chip({ value, invert }: { value: number; invert?: boolean }) {
  const isGood = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      isGood ? "bg-[#4CC4A410] text-[#4CC4A4]" : "bg-[#D9707010] text-[#D97070]"
    }`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

export default function SummaryCards({
  current, previous, riskLevel, riskPositiveMonths, riskTotalMonths, summary, context, periodLabel,
}: Props) {
  const t = useTranslations("dashboard.summaryCards");
  const tm = useTranslations("metrics");
  const locale = useLocale() as Locale;
  const c = current  ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };
  const p = previous ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };

  const currCashflow  = c.totalIncome - c.totalExpenses;
  const prevCashflow  = p.totalIncome - p.totalExpenses;
  const spendRate     = c.totalIncome > 0 ? Math.round((c.totalExpenses / c.totalIncome) * 100) : 0;
  const margin        = c.totalIncome > 0 ? 100 - spendRate : null;
  const prevSpendRate = p.totalIncome > 0 ? Math.round((p.totalExpenses / p.totalIncome) * 100) : 0;
  const prevMargin    = p.totalIncome > 0 ? 100 - prevSpendRate : null;
  const riskColor     = RISK_COLOR[riskLevel];

  const marginColor   = margin === null ? "text-[#6A97B4]"
    : margin >= 30 ? "text-[#4CC4A4]"
    : margin >= 10 ? "text-[#D4A254]"
    : "text-[#D97070]";

  return (
    <div className="space-y-4">
      {periodLabel && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#6A97B4] uppercase tracking-wide">{t("showing")}</span>
          <span className="text-xs font-semibold text-[#A8C6E0] bg-[#1A3048] px-2 py-0.5 rounded">{periodLabel}</span>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">

        {/* Income */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">{tm("income")}</p>
          <p className="text-2xl md:text-3xl font-bold text-[#4CC4A4] leading-none tabular-nums">
            {formatCurrency(c.totalIncome, locale)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">{t("totalThisMonth")}</p>
            {previous && <Chip value={changePct(c.totalIncome, p.totalIncome)} />}
          </div>
        </div>

        {/* Expenses */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">{tm("expenses")}</p>
          <p className="text-2xl md:text-3xl font-bold text-[#D4A254] leading-none tabular-nums">
            {formatCurrency(c.totalExpenses, locale)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">{t("totalThisMonth")}</p>
            {previous && <Chip value={changePct(c.totalExpenses, p.totalExpenses)} invert />}
          </div>
        </div>

        {/* Cashflow */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">{tm("cashflow")}</p>
          <p className={`text-2xl md:text-3xl font-bold leading-none tabular-nums ${currCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]"}`}>
            {formatCurrency(currCashflow, locale)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">
              {currCashflow >= 0 ? t("incomeAboveExpenses") : t("expensesExceedIncome")}
            </p>
            {previous && <Chip value={changePct(currCashflow, prevCashflow)} />}
          </div>
        </div>

        {/* Margin */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">{tm("margin")}</p>
          <p className={`text-2xl md:text-3xl font-bold leading-none tabular-nums ${marginColor}`}>
            {margin !== null ? `${margin}%` : "—"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#6A97B4]">{t("ofIncomeKept")}</p>
            {previous && margin !== null && prevMargin !== null && (
              <Chip value={margin - prevMargin} />
            )}
          </div>
        </div>

        {/* Risk */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">{t("risk")}</p>
          <p className={`text-2xl md:text-3xl font-bold leading-none ${riskColor}`}>
            {t(`riskLevels.${riskLevel}`)}
          </p>
          <p className="text-[13px] text-[#6A97B4]">
            {riskTotalMonths > 0
              ? t("monthsPositive", { positive: riskPositiveMonths, total: riskTotalMonths })
              : t("noHistory")}
          </p>
        </div>

      </div>

      {summary && (
        <div className="bg-[#4CC4A40A] border border-[#4CC4A415] rounded-xl px-5 py-4 space-y-2.5">
          <p className="text-sm font-medium text-[#E8F0F8] leading-relaxed">
            <InsightText insight={summary} />
          </p>
          {context && context.length > 0 && (
            <ul className="space-y-2">
              {context.map((line, i) => (
                <li key={i} className="text-sm text-[#A8C6E0] flex items-start gap-2.5 leading-relaxed">
                  <span className="text-[#4CC4A4] opacity-60 mt-1 flex-shrink-0">·</span>
                  <InsightText insight={line} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
