"use client";

import { Fragment } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
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
  changes: { income: number; expenses: number; savings: number; cashflow: number } | null;
  interpretation?: Insight | null;
  suggestion?: Insight | null;
  currLabel?: string;
  prevLabel?: string;
}

export default function MonthlyComparison({
  current, previous, changes, interpretation, suggestion, currLabel: currLabelProp, prevLabel: prevLabelProp,
}: Props) {
  const t = useTranslations("dashboard.monthlyComparison");
  const tm = useTranslations("metrics");
  const locale = useLocale() as Locale;
  const now      = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currLabel = currLabelProp ?? now.toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric" });
  const prevLabel = prevLabelProp ?? prevDate.toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric" });

  if (!current || !previous || !changes) {
    return (
      <div className="card">
        <p className="label mb-2">{t("label")}</p>
        <p className="text-[#7BA8C4] text-sm">{t("needMoreData")}</p>
      </div>
    );
  }

  const previousHasData = previous.totalIncome > 0 || previous.totalExpenses > 0;
  // Cashflow = netCashflow (Income − Expenses) — single definition shared with
  // SummaryCards, charts, risk/health scoring, and forecasts.
  const currCashflow = current.netCashflow;
  const prevCashflow = previous.netCashflow;

  const rows = [
    { key: "income",   label: tm("income"),   prev: previous.totalIncome,   curr: current.totalIncome,   pct: changes.income,   invertBad: false },
    { key: "expenses", label: tm("expenses"), prev: previous.totalExpenses, curr: current.totalExpenses, pct: changes.expenses, invertBad: true  },
    { key: "cashflow", label: tm("cashflow"), prev: prevCashflow,            curr: currCashflow,           pct: changes.cashflow, invertBad: false },
  ];

  if (!previousHasData) {
    return (
      <div className="card">
        <div className="mb-4">
          <p className="label mb-1">{t("monthlySummary")}</p>
          <h3 className="text-lg font-semibold text-[#E8F0F8]">{currLabel}</h3>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between py-2 border-b border-[#243F5E] last:border-0">
              <span className="text-sm text-[#7BA8C4]">{row.label}</span>
              <span className="text-sm font-semibold text-[#E8F0F8] tabular-nums">
                {formatCurrency(row.curr, locale)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 px-3 py-2.5 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl">
          <p className="text-xs text-[#7BA8C4]">
            <span className="text-[#3AB5A0] font-medium">{t("uploadAnotherMonth")}</span> {t("toStartComparing")}
          </p>
        </div>
      </div>
    );
  }

  const verdictKey =
    changes.income > 0 && changes.cashflow >= 0 ? "verdictYes" :
    changes.income > 0 && changes.cashflow < 0  ? "verdictPartly" :
    changes.income <= 0 && changes.cashflow >= 0 ? "verdictSlightly" :
                                                   "verdictNo";

  const verdictColor =
    verdictKey === "verdictYes"      ? "text-[#4CC4A4]" :
    verdictKey === "verdictNo"       ? "text-[#D97070]" :
                                       "text-[#D4A254]";

  return (
    <div className="card">
      <div className="mb-4 md:mb-5">
        <p className="label mb-1">{t("label")}</p>
        <h3 className={`text-base font-semibold leading-snug ${verdictColor}`}>{t(verdictKey)}</h3>
      </div>

      {/* Desktop table */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-x-5 gap-y-0">
        <div className="pb-2 border-b border-[#243F5E]" />
        <div className="text-xs text-[#6A97B4] text-right pb-2 border-b border-[#243F5E] whitespace-nowrap">{prevLabel}</div>
        <div className="text-xs font-medium text-[#E8F0F8] text-right pb-2 border-b border-[#243F5E] whitespace-nowrap">{currLabel}</div>
        <div className="text-xs text-[#6A97B4] text-right pb-2 border-b border-[#243F5E]">{tm("change")}</div>

        {rows.map((row, i) => {
          const changeAmt = row.curr - row.prev;
          const isGood    = row.invertBad ? row.pct <= 0 : row.pct >= 0;
          const isLast    = i === rows.length - 1;
          const border    = isLast ? "" : "border-b border-[#243F5E]";
          const chipCls   = isGood ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#D9707015] text-[#D97070]";
          const amtCls    = isGood ? "text-[#4CC4A4]" : "text-[#D97070]";
          const arrow     = row.pct > 0 ? "↑" : row.pct < 0 ? "↓" : "→";

          return (
            <Fragment key={row.key}>
              <div className={`text-sm text-[#7BA8C4] py-3 ${border}`}>{row.label}</div>
              <div className={`text-sm text-[#6A97B4] tabular-nums text-right py-3 ${border}`}>{formatCurrency(row.prev, locale)}</div>
              <div className={`text-sm font-semibold text-[#E8F0F8] tabular-nums text-right py-3 ${border}`}>{formatCurrency(row.curr, locale)}</div>
              <div className={`flex items-center gap-2 justify-end py-3 ${border}`}>
                <span className={`text-xs font-medium tabular-nums whitespace-nowrap ${amtCls}`}>
                  {changeAmt >= 0 ? "+" : "−"}{formatCurrency(Math.abs(changeAmt), locale)}
                </span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${chipCls}`}>
                  {arrow} {Math.abs(row.pct)}%
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => {
          const changeAmt = row.curr - row.prev;
          const isGood    = row.invertBad ? row.pct <= 0 : row.pct >= 0;
          const chipCls   = isGood ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#D9707015] text-[#D97070]";
          const amtCls    = isGood ? "text-[#4CC4A4]" : "text-[#D97070]";
          const arrow     = row.pct > 0 ? "↑" : row.pct < 0 ? "↓" : "→";

          return (
            <div key={row.key} className="bg-[#1A3048] rounded-xl p-4">
              <p className="text-sm font-medium text-[#E8F0F8] mb-3">{row.label}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-[#6A97B4] mb-1">{prevLabel}</p>
                  <p className="text-sm text-[#6A97B4] tabular-nums">{formatCurrency(row.prev, locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6A97B4] mb-1">{currLabel}</p>
                  <p className="text-sm font-semibold text-[#E8F0F8] tabular-nums">{formatCurrency(row.curr, locale)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#6A97B4] mb-1">{tm("change")}</p>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-medium tabular-nums ${amtCls}`}>
                      {changeAmt >= 0 ? "+" : "−"}{formatCurrency(Math.abs(changeAmt), locale)}
                    </span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${chipCls}`}>
                      {arrow} {Math.abs(row.pct)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(interpretation || suggestion) && (
        <div className="mt-4 space-y-2">
          {interpretation && (
            <div className="px-4 py-3 bg-[#1A3048] rounded-xl">
              <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-wide mb-1.5">
                {t("whatHappened")}
              </p>
              <p className="text-sm text-[#A8C6E0] leading-relaxed">
                <InsightText insight={interpretation} accent="#3AB5A0" />
              </p>
            </div>
          )}
          {suggestion && (
            <div className="px-4 py-3 bg-[#0D1B2B] border border-[#D4A25428] rounded-xl">
              <p className="text-[11px] font-semibold text-[#D4A254] uppercase tracking-wide mb-1.5">
                {t("yourNextMove")}
              </p>
              <p className="text-sm text-[#A8C6E0] leading-relaxed">
                <InsightText insight={suggestion} accent="#D4A254" />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
