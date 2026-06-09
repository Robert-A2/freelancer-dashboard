"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/utils/finance";

interface DataPoint {
  month: string;
  cashflow: number;
  income: number;
  expenses: number;
}
interface Props { data: DataPoint[]; hideHeader?: boolean; }

const TIME_RANGES = [
  { label: "6M",  months: 6   },
  { label: "12M", months: 12  },
  { label: "ALL", months: 999 },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#132537",
  border: "1px solid #243F5E",
  borderRadius: "0.75rem",
  color: "#E8F0F8",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

function yFmt(v: number): string {
  if (v === 0) return "€0";
  const abs = Math.abs(v);
  if (abs >= 10_000) return `€${Math.round(v / 1000)}k`;
  if (abs >= 1_000)  return `€${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `€${Math.round(v)}`;
}

function localAvg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export default function CashflowChart({ data, hideHeader = false }: Props) {
  const [range, setRange] = useState(12);
  const sliced = range === 999 ? data : data.slice(-range);
  const active = sliced.filter(d => d.income > 0 || d.expenses > 0);

  if (data.length === 0) return null;

  const positiveMonths = active.filter(d => d.cashflow >= 0).length;
  const negativeMonths = active.filter(d => d.cashflow <  0).length;
  const avgCashflow    = localAvg(active.map(d => d.cashflow));
  const avgIncome      = localAvg(active.map(d => d.income));
  const avgExpenses    = localAvg(active.map(d => d.expenses));
  const negMonths      = active.filter(d => d.cashflow < 0);
  const posRatio       = active.length > 0 ? Math.round((positiveMonths / active.length) * 100) : 0;

  const bestMonth  = active.length ? active.reduce((b, d) => d.cashflow > b.cashflow ? d : b, active[0]) : null;
  const worstMonth = active.length ? active.reduce((w, d) => d.cashflow < w.cashflow ? d : w, active[0]) : null;

  const lowIncNeg  = negMonths.filter(m => m.income   < avgIncome   * 0.85).length;
  const highExpNeg = negMonths.filter(m => m.expenses > avgExpenses * 1.15).length;
  const bothNeg    = negMonths.filter(m => m.income < avgIncome * 0.85 && m.expenses > avgExpenses * 1.15).length;

  let whyText    = "";
  let actionText = "";

  if (negativeMonths > 0) {
    if (bothNeg >= Math.ceil(negativeMonths * 0.4)) {
      whyText    = `Income dips and above-average expenses occurred together in ${bothNeg} month${bothNeg !== 1 ? "s" : ""}. When both move at once, cashflow turns negative fast.`;
      actionText = "Build a 2-month income reserve. A buffer absorbs the impact when income and expenses move against you simultaneously.";
    } else if (lowIncNeg >= highExpNeg) {
      whyText    = `Income fell below your monthly average in ${lowIncNeg} out of the ${negativeMonths} negative month${negativeMonths !== 1 ? "s" : ""}. Expenses were roughly normal. The problem was income.`;
      actionText = "Stabilise your client pipeline. Retainer agreements, earlier invoicing, or building a 60-days payment buffer all reduce the impact of slow-income months.";
    } else {
      whyText    = `Expenses exceeded your typical level in ${highExpNeg} of the ${negativeMonths} negative month${negativeMonths !== 1 ? "s" : ""}. Income held steady. The problem was spending.`;
      actionText = "Set a monthly expense ceiling before the month starts. Review your recurring costs quarterly.";
    }
  } else if (active.length >= 3) {
    actionText = "All months are positive. Consider automating a fixed monthly transfer to lock in surplus before it gets spent.";
  }

  let stabilityText  = "";
  let stabilityColor = "text-[#7BA8C4]";

  if (active.length >= 8) {
    const mid       = Math.floor(active.length / 2);
    const firstNeg  = active.slice(0, mid).filter(m => m.cashflow < 0).length;
    const secondNeg = active.slice(mid).filter(m => m.cashflow  < 0).length;
    if (secondNeg < firstNeg - 1) {
      stabilityText  = `Fewer negative months detected in the second half of this period than the first one. Cashflow is becoming more stable.`;
      stabilityColor = "text-[#4CC4A4]";
    } else if (secondNeg > firstNeg + 1) {
      stabilityText  = `More negative months in the second half than the first. Cashflow stability is weakening.`;
      stabilityColor = "text-[#D97070]";
    } else {
      stabilityText  = `The number of negative months has stayed consistent. Cashflow stability has not changed.`;
      stabilityColor = "text-[#7BA8C4]";
    }
  }

  const whatHappenedText = active.length >= 3
    ? `${positiveMonths} of ${active.length} months were cashflow positive (${posRatio}%). ${
        negativeMonths === 0
          ? "No negative months recorded."
          : `${negativeMonths} month${negativeMonths !== 1 ? "s" : ""} had expenses exceeding income.`
      }`
    : "";

  return (
    <div className="card">

      <div className={`flex items-start justify-between gap-3 flex-wrap ${hideHeader ? "mb-4" : "mb-4"}`}>
        {!hideHeader && (
          <div>
            <p className="label mb-1">Monthly Cashflow</p>
            <h3 className="text-lg font-semibold text-[#E8F0F8]">Income minus Expenses</h3>
          </div>
        )}
        <div className={`flex gap-1.5 ${hideHeader ? "ml-auto" : ""}`}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.months)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
                range === r.months
                  ? "bg-[#3AB5A0] text-[#0D1B2B]"
                  : "bg-[#1A3048] text-[#7BA8C4] hover:text-[#E8F0F8]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={sliced} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243F5E" vertical={false} />
          <XAxis dataKey="month" stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} />
          <YAxis stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} tickFormatter={yFmt} width={52} />
          <ReferenceLine y={0} stroke="#243F5E" strokeWidth={1.5} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [formatCurrency(value), "Cashflow"]}
            labelStyle={{ color: "#E8F0F8", fontWeight: 600 }}
            itemStyle={{ color: "#A8C6E0" }}
          />
          <Bar dataKey="cashflow" name="Cashflow" radius={[3, 3, 0, 0]}>
            {sliced.map((entry, i) => (
              <Cell key={i} fill={entry.cashflow >= 0 ? "#4CC4A4" : "#D97070"} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {active.length >= 3 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">Best month</p>
              <p className="text-sm font-bold text-[#4CC4A4]">{bestMonth ? formatCurrency(bestMonth.cashflow) : "—"}</p>
              {bestMonth && <p className="text-xs text-[#6A97B4] mt-1">{bestMonth.month}</p>}
            </div>
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">Worst month</p>
              <p className={`text-sm font-bold ${worstMonth && worstMonth.cashflow < 0 ? "text-[#D97070]" : "text-[#6A97B4]"}`}>
                {worstMonth ? formatCurrency(worstMonth.cashflow) : "—"}
              </p>
              {worstMonth && <p className="text-xs text-[#6A97B4] mt-1">{worstMonth.month}</p>}
            </div>
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">Monthly average</p>
              <p className={`text-sm font-bold ${avgCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]"}`}>
                {formatCurrency(avgCashflow)}
              </p>
            </div>
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">Positive ratio</p>
              <p className={`text-sm font-bold ${posRatio >= 70 ? "text-[#4CC4A4]" : posRatio >= 50 ? "text-[#D4A254]" : "text-[#D97070]"}`}>
                {posRatio}%
              </p>
              <p className="text-xs text-[#6A97B4] mt-1">{positiveMonths} of {active.length} months</p>
            </div>
          </div>

          <div className="mt-4 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#3AB5A015]">
              <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-widest mb-1.5">What happened?</p>
              <p className="text-sm text-[#A8C6E0] leading-relaxed">{whatHappenedText}</p>
              {stabilityText && (
                <p className={`text-sm mt-1.5 ${stabilityColor}`}>{stabilityText}</p>
              )}
            </div>
            {whyText && (
              <div className="px-4 py-3 border-b border-[#3AB5A015]">
                <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-widest mb-1.5">Why did it happen?</p>
                <p className="text-sm text-[#A8C6E0] leading-relaxed">{whyText}</p>
              </div>
            )}
            {actionText && (
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-widest mb-1.5">What should I do next?</p>
                <p className="text-sm text-[#A8C6E0] leading-relaxed">{actionText}</p>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
