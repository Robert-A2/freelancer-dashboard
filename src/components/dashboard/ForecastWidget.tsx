"use client";

import { formatCurrency } from "@/utils/finance";

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
  reasons?: string[];
  improvements?: string[];
  deficitReason?: string | null;
}

const CONFIDENCE_COLORS = {
  low:    "text-[#D4A254]",
  medium: "text-[#7299B4]",
  high:   "text-[#4CC4A4]",
};

function fmtRunway(m: number): string {
  if (Math.abs(m) < 0.05) return "0.0 mo";
  return `${m >= 0 ? "+" : "−"}${Math.abs(m).toFixed(1)} mo`;
}

export default function ForecastWidget({ forecast, reasons, improvements, deficitReason }: Props) {
  if (!forecast) {
    return (
      <div className="card">
        <p className="label mb-2">Forecast</p>
        <p className="text-[#7299B4] text-sm">Upload at least one month of data to generate a forecast.</p>
      </div>
    );
  }

  const { projectedIncome, projectedExpenses, forecastPeriod, confidence } = forecast;

  const operatingCashflow = projectedIncome - projectedExpenses;
  const cashflowNegative  = operatingCashflow < 0;
  const runwayMonths      = projectedExpenses > 0 ? operatingCashflow / projectedExpenses : 0;

  const cashflowHealthText  = reasons?.[1] ?? null;
  const cashflowHealthIsNeg = cashflowHealthText?.toLowerCase().includes("negative") ?? false;
  const trendSegments       = reasons ? reasons.slice(2).filter(Boolean) : [];
  const trendLine           = trendSegments.length
    ? trendSegments.map((s) => s.replace(/\.$/, "")).join(" · ") + "."
    : null;
  const hasGreenSection = cashflowHealthText || deficitReason || (improvements && improvements.length > 0);

  return (
    <div className="card space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label mb-1">Forecast</p>
          <h3 className="text-lg font-semibold text-[#D8E8F4] truncate">{forecastPeriod}</h3>
          <p className="text-xs text-[#4A6882] mt-0.5 leading-relaxed">
            {reasons?.[0] ?? `Based on ${forecast.basedOnMonths} month${forecast.basedOnMonths !== 1 ? "s" : ""} of history.`}
          </p>
        </div>
        <span className={`text-xs font-semibold uppercase flex-shrink-0 ${CONFIDENCE_COLORS[confidence]}`}>
          {confidence} confidence
        </span>
      </div>

      {/* Projected numbers: Income, Expenses, Cashflow, Runway */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Income",   value: formatCurrency(projectedIncome),  color: "text-[#4CC4A4]" },
          { label: "Expenses", value: formatCurrency(projectedExpenses), color: "text-[#D4A254]" },
          { label: "Cashflow", value: formatCurrency(operatingCashflow), color: cashflowNegative ? "text-[#D97070]" : "text-[#3AB5A0]" },
          { label: "Runway",   value: fmtRunway(runwayMonths),           color: runwayMonths >= 0.5 ? "text-[#4CC4A4]" : runwayMonths >= 0 ? "text-[#D4A254]" : "text-[#D97070]" },
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
            Projected deficit. Expenses are likely to exceed income next month.
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
                {cashflowHealthText}
              </p>
            </div>
          )}

          {trendLine && (
            <p className="text-xs text-[#8AAEC8] leading-relaxed">{trendLine}</p>
          )}

          {deficitReason && (
            <div className={cashflowHealthText || trendLine ? "border-t border-[#4CC4A415] pt-3" : ""}>
              <p className="label mb-1.5">Why cashflow is negative</p>
              <p className="text-sm text-[#8AAEC8] leading-relaxed">{deficitReason}</p>
            </div>
          )}

          {improvements && improvements.length > 0 && (
            <div className={cashflowHealthText || trendLine || deficitReason ? "border-t border-[#4CC4A415] pt-3" : ""}>
              <p className="label mb-2">What to do next</p>
              <ul className="space-y-2">
                {improvements.slice(0, 3).map((imp, i) => (
                  <li key={i} className="text-sm text-[#8AAEC8] flex items-start gap-2">
                    <span className="text-[#3AB5A0] flex-shrink-0 mt-0.5 font-bold">→</span>
                    {imp}
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
