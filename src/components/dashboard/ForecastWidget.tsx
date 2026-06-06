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
  low:    "text-[#C79A63]",
  medium: "text-[#6B7280]",
  high:   "text-[#5B8A72]",
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
        <p className="text-[#6B7280] text-sm">Upload at least one month of data to generate a forecast.</p>
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
          <h3 className="text-lg font-semibold text-[#1F2937] truncate">{forecastPeriod}</h3>
          <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">
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
          { label: "Income",   value: formatCurrency(projectedIncome),  color: "text-[#5B8A72]" },
          { label: "Expenses", value: formatCurrency(projectedExpenses), color: "text-[#C79A63]" },
          { label: "Cashflow", value: formatCurrency(operatingCashflow), color: cashflowNegative ? "text-[#C66A5A]" : "text-[#4F7A65]" },
          { label: "Runway",   value: fmtRunway(runwayMonths),           color: runwayMonths >= 0.5 ? "text-[#5B8A72]" : runwayMonths >= 0 ? "text-[#C79A63]" : "text-[#C66A5A]" },
        ].map((item) => (
          <div key={item.label} className="bg-[#F7F8F5] rounded-xl p-3">
            <p className="label mb-1">{item.label}</p>
            <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Deficit warning */}
      {cashflowNegative && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#C66A5A0A] border border-[#C66A5A20] rounded-xl">
          <span className="text-[#C66A5A] text-base flex-shrink-0">⚠</span>
          <p className="text-xs text-[#C66A5A]">
            Projected deficit. Expenses are likely to exceed income next month.
          </p>
        </div>
      )}

      {/* Intelligence zone */}
      {hasGreenSection && (
        <div className="bg-[#5B8A720A] border border-[#5B8A7218] rounded-xl p-4 space-y-3">

          {cashflowHealthText && (
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cashflowHealthIsNeg ? "bg-[#C66A5A]" : "bg-[#5B8A72]"}`} />
              <p className={`text-sm font-medium ${cashflowHealthIsNeg ? "text-[#C66A5A]" : "text-[#5B8A72]"}`}>
                {cashflowHealthText}
              </p>
            </div>
          )}

          {trendLine && (
            <p className="text-xs text-[#374151] leading-relaxed">{trendLine}</p>
          )}

          {deficitReason && (
            <div className={cashflowHealthText || trendLine ? "border-t border-[#5B8A7215] pt-3" : ""}>
              <p className="label mb-1.5">Why cashflow is negative</p>
              <p className="text-sm text-[#374151] leading-relaxed">{deficitReason}</p>
            </div>
          )}

          {improvements && improvements.length > 0 && (
            <div className={cashflowHealthText || trendLine || deficitReason ? "border-t border-[#5B8A7215] pt-3" : ""}>
              <p className="label mb-2">What to do next</p>
              <ul className="space-y-2">
                {improvements.slice(0, 3).map((imp, i) => (
                  <li key={i} className="text-sm text-[#374151] flex items-start gap-2">
                    <span className="text-[#4F7A65] flex-shrink-0 mt-0.5 font-bold">→</span>
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
