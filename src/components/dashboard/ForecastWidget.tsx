"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

interface ForecastData {
  projectedIncome: number;
  projectedExpenses: number;
  projectedSavings: number;
  projectedCashflow: number;
  forecastPeriod: string;
  basedOnMonths: number;
  confidence: "low" | "medium" | "high";
}

interface Props {
  forecast: ForecastData | null;
  reasons?: Insight[];
  improvements?: Insight[];
  deficitReason?: Insight | null;
}

const CONFIDENCE_COLORS = {
  low:    "text-[#D4A254]",
  medium: "text-[#7BA8C4]",
  high:   "text-[#4CC4A4]",
};

export default function ForecastWidget({ forecast, reasons, improvements, deficitReason }: Props) {
  const t = useTranslations("dashboard.forecastWidget");
  const tf = useTranslations("forecast");
  const tm = useTranslations("metrics");
  const locale = useLocale() as Locale;

  if (!forecast) {
    return (
      <div className="card">
        <p className="label mb-2">{t("label")}</p>
        <p className="text-[#7BA8C4] text-sm">{t("noData")}</p>
      </div>
    );
  }

  const { projectedIncome, projectedExpenses, forecastPeriod, confidence } = forecast;

  const operatingCashflow = projectedIncome - projectedExpenses;
  const cashflowNegative  = operatingCashflow < 0;
  const projectedMargin   = projectedIncome > 0 ? Math.round((operatingCashflow / projectedIncome) * 100) : null;

  const cashflowHealthText  = reasons?.[1] ?? null;
  const cashflowHealthIsNeg = cashflowHealthText?.key === "insights.forecast.cashflowNegative";
  const trendSegments       = reasons ? reasons.slice(2) : [];
  const hasGreenSection = cashflowHealthText || deficitReason || (improvements && improvements.length > 0);

  return (
    <div className="card space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label mb-1">{t("label")}</p>
          <h3 className="text-lg font-semibold text-[#E8F0F8] truncate">{forecastPeriod}</h3>
          <p className="text-xs text-[#6A97B4] mt-0.5 leading-relaxed">
            {reasons?.[0]
              ? <InsightText insight={reasons[0]} />
              : t("basedOnHistory", { months: forecast.basedOnMonths })}
          </p>
        </div>
        <span className={`text-xs font-semibold uppercase flex-shrink-0 ${CONFIDENCE_COLORS[confidence]}`}>
          {tf("confidenceLabel", { level: confidence })}
        </span>
      </div>

      {/* Projected numbers: Income, Expenses, Cashflow, Margin */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: tm("income"),   value: formatCurrency(projectedIncome, locale),  color: "text-[#4CC4A4]" },
          { label: tm("expenses"), value: formatCurrency(projectedExpenses, locale), color: "text-[#D4A254]" },
          { label: tm("cashflow"), value: formatCurrency(operatingCashflow, locale), color: cashflowNegative ? "text-[#D97070]" : "text-[#3AB5A0]" },
          {
            label: tm("margin"),
            value: projectedMargin !== null ? `${projectedMargin}%` : "—",
            color: projectedMargin === null ? "text-[#6A97B4]"
              : projectedMargin >= 30 ? "text-[#4CC4A4]"
              : projectedMargin >= 10 ? "text-[#D4A254]"
              : "text-[#D97070]",
          },
        ].map((item) => (
          <div key={item.label} className="bg-[#1A3048] rounded-xl p-3">
            <p className="label mb-1">{item.label}</p>
            <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Deficit warning */}
      {cashflowNegative && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#D970700A] border border-[#D9707020] rounded-xl">
          <span className="text-[#D97070] text-base flex-shrink-0">⚠</span>
          <p className="text-xs text-[#D97070]">
            {t("deficitWarning")}
          </p>
        </div>
      )}

      {/* Intelligence zone */}
      {hasGreenSection && (
        <div className="bg-[#4CC4A40A] border border-[#4CC4A418] rounded-xl p-4 space-y-3">

          {cashflowHealthText && (
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cashflowHealthIsNeg ? "bg-[#D97070]" : "bg-[#4CC4A4]"}`} />
              <p className={`text-sm font-medium ${cashflowHealthIsNeg ? "text-[#D97070]" : "text-[#4CC4A4]"}`}>
                <InsightText insight={cashflowHealthText} />
              </p>
            </div>
          )}

          {trendSegments.length > 0 && (
            <p className="text-xs text-[#A8C6E0] leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {trendSegments.map((seg, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-[#4CC4A440]">·</span>}
                  <InsightText insight={seg} />
                </span>
              ))}
            </p>
          )}

          {deficitReason && (
            <div className={cashflowHealthText || trendSegments.length > 0 ? "border-t border-[#4CC4A415] pt-3" : ""}>
              <p className="label mb-1.5">{t("whyNegative")}</p>
              <p className="text-sm text-[#A8C6E0] leading-relaxed">
                <InsightText insight={deficitReason} />
              </p>
            </div>
          )}

          {improvements && improvements.length > 0 && (
            <div className={cashflowHealthText || trendSegments.length > 0 || deficitReason ? "border-t border-[#4CC4A415] pt-3" : ""}>
              <p className="label mb-2">{t("whatToDoNext")}</p>
              <ul className="space-y-2">
                {improvements.slice(0, 3).map((imp, i) => (
                  <li key={i} className="text-sm text-[#A8C6E0] flex items-start gap-2">
                    <span className="text-[#3AB5A0] flex-shrink-0 mt-0.5 font-bold">→</span>
                    <InsightText insight={imp} />
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
