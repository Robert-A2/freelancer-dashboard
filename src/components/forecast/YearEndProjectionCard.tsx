"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { ForecastResult } from "@/lib/forecast-engine";

export default function YearEndProjectionCard({ forecast }: { forecast: ForecastResult | null }) {
  const t = useTranslations("forecast");
  const locale = useLocale() as Locale;

  const annualIncome   = forecast ? forecast.projectedIncome   * 12 : 0;
  const annualExpenses = forecast ? forecast.projectedExpenses * 12 : 0;
  const annualCashflow = forecast ? forecast.projectedCashflow * 12 : 0;
  const projMarginPct  = forecast && forecast.projectedIncome > 0
    ? Math.round((forecast.projectedCashflow / forecast.projectedIncome) * 100)
    : null;

  return (
    <div className="card">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
        <div>
          <p className="label mb-1">{t("yearEndProjection.label")}</p>
          <p className="text-[13px] text-[#6A97B4]">{t("yearEndProjection.subtitle")}</p>
        </div>
        {forecast?.confidence && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-[#1A3048] ${
            forecast.confidence === "high" ? "text-[#4CC4A4]" :
            forecast.confidence === "medium" ? "text-[#D4A254]" : "text-[#E5484D]"
          }`}>
            {t("confidenceLabel", { level: forecast.confidence })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: "income",   label: t("yearEndProjection.items.income"),   value: `~${formatCurrency(annualIncome, locale)}`,   sub: forecast ? t("yearEndProjection.perMonthAvg", { amount: formatCurrency(forecast.projectedIncome, locale) }) : null,   color: "text-[#4CC4A4]",  border: "border-[#4CC4A415]" },
          { key: "expenses", label: t("yearEndProjection.items.expenses"), value: `~${formatCurrency(annualExpenses, locale)}`,  sub: forecast ? t("yearEndProjection.perMonthAvg", { amount: formatCurrency(forecast.projectedExpenses, locale) }) : null,  color: "text-[#D4A254]",  border: "border-[#D4A25415]" },
          { key: "cashflow", label: t("yearEndProjection.items.cashflow"), value: `~${formatCurrency(annualCashflow, locale)}`,  sub: forecast ? t("yearEndProjection.perMonthAvg", { amount: formatCurrency(forecast.projectedCashflow, locale) }) : null,  color: annualCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#E5484D]", border: "border-[#243F5E]" },
          {
            key: "margin", label: t("yearEndProjection.items.margin"),
            value: projMarginPct !== null ? (forecast?.confidence === "high" ? t("yearEndProjection.marginValue", { pct: String(projMarginPct) }) : t("yearEndProjection.marginApprox", { pct: String(projMarginPct) })) : t("yearEndProjection.noValue"),
            sub: projMarginPct !== null && forecast?.confidence !== "high" ? t("yearEndProjection.ofIncomeKeptApprox") : t("yearEndProjection.ofIncomeKept"),
            color: projMarginPct === null ? "text-[#6A97B4]" : forecast?.confidence !== "high" ? "text-[#7BA8C4]" : projMarginPct >= 30 ? "text-[#4CC4A4]" : projMarginPct >= 10 ? "text-[#D4A254]" : "text-[#E5484D]",
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
  );
}
