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

interface Props { data: DataPoint[]; }

const TIME_RANGES = [
  { label: "6M",  months: 6   },
  { label: "12M", months: 12  },
  { label: "ALL", months: 999 },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#1E293B",
  border: "1px solid #334155",
  borderRadius: "0.75rem",
  color: "#F8FAFC",
  fontSize: "12px",
};

// ── Y-axis formatter ──────────────────────────────────────────────────────────
// Handles €0 cleanly, no repeated "€0k" values, proper currency abbreviation.
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

export default function CashflowChart({ data }: Props) {
  const [range, setRange] = useState(12);
  const sliced = range === 999 ? data : data.slice(-range);
  const active = sliced.filter(d => d.income > 0 || d.expenses > 0);

  if (data.length === 0) return null;

  // ── Core metrics ───────────────────────────────────────────────────────────
  const positiveMonths = active.filter(d => d.cashflow >= 0).length;
  const negativeMonths = active.filter(d => d.cashflow <  0).length;
  const avgCashflow    = localAvg(active.map(d => d.cashflow));
  const avgIncome      = localAvg(active.map(d => d.income));
  const avgExpenses    = localAvg(active.map(d => d.expenses));
  const negMonths      = active.filter(d => d.cashflow < 0);
  const posRatio       = active.length > 0 ? Math.round((positiveMonths / active.length) * 100) : 0;

  // Best and worst months
  const bestMonth  = active.length ? active.reduce((b, d) => d.cashflow > b.cashflow ? d : b, active[0]) : null;
  const worstMonth = active.length ? active.reduce((w, d) => d.cashflow < w.cashflow ? d : w, active[0]) : null;

  // ── Why did it happen? ─────────────────────────────────────────────────────
  const lowIncNeg  = negMonths.filter(m => m.income   < avgIncome   * 0.85).length;
  const highExpNeg = negMonths.filter(m => m.expenses > avgExpenses * 1.15).length;
  const bothNeg    = negMonths.filter(m => m.income < avgIncome * 0.85 && m.expenses > avgExpenses * 1.15).length;

  let whyText    = "";
  let actionText = "";

  if (negativeMonths > 0) {
    if (bothNeg >= Math.ceil(negativeMonths * 0.4)) {
      whyText    = `Income dips and above-average expenses occurred together in ${bothNeg} month${bothNeg !== 1 ? "s" : ""}. When both move at once, cashflow turns negative fast.`;
      actionText = "Build a 2-month income reserve. A buffer absorbs the impact when income and expenses move against you simultaneously. Without it, every bad month creates stress.";
    } else if (lowIncNeg >= highExpNeg) {
      whyText    = `Income fell below your monthly average in ${lowIncNeg} of the ${negativeMonths} negative month${negativeMonths !== 1 ? "s" : ""}. Expenses were roughly normal. The problem was on the income side.`;
      actionText = "Stabilise your client pipeline. Retainer agreements, earlier invoicing, or building a 60-day payment buffer all reduce the impact of slow-income months.";
    } else {
      whyText    = `Expenses exceeded your typical level in ${highExpNeg} of the ${negativeMonths} negative month${negativeMonths !== 1 ? "s" : ""}. Income held steady. The problem was on the spending side.`;
      actionText = "Set a monthly expense ceiling before the month starts. Review your recurring costs quarterly.";
    }
  } else if (active.length >= 3) {
    actionText = "All months are positive. Consider automating a fixed monthly savings transfer to lock in surplus before it gets spent.";
  }

  // ── Stability trend ────────────────────────────────────────────────────────
  let stabilityText  = "";
  let stabilityColor = "text-[#94A3B8]";

  if (active.length >= 8) {
    const mid       = Math.floor(active.length / 2);
    const firstNeg  = active.slice(0, mid).filter(m => m.cashflow < 0).length;
    const secondNeg = active.slice(mid).filter(m => m.cashflow  < 0).length;
    if (secondNeg < firstNeg - 1) {
      stabilityText  = `Fewer negative months in the second half of this period than the first. Cashflow is becoming more stable.`;
      stabilityColor = "text-[#22C55E]";
    } else if (secondNeg > firstNeg + 1) {
      stabilityText  = `More negative months in the second half than the first. Cashflow stability is weakening.`;
      stabilityColor = "text-[#EF4444]";
    } else {
      stabilityText  = `The number of negative months has stayed consistent. Cashflow stability has not meaningfully changed.`;
      stabilityColor = "text-[#94A3B8]";
    }
  }

  // "What happened" summary sentence
  const whatHappenedText = active.length >= 3
    ? `${positiveMonths} of ${active.length} months were cashflow positive (${posRatio}%). ${
        negativeMonths === 0
          ? "No negative months recorded."
          : `${negativeMonths} month${negativeMonths !== 1 ? "s" : ""} had expenses exceeding income.`
      }`
    : "";

  return (
    <div className="card">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="label mb-1">Monthly Cashflow</p>
          <h3 className="text-lg font-semibold">Income minus Expenses</h3>
        </div>
        <div className="flex gap-1.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.months)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
                range === r.months
                  ? "bg-[#14B8A6] text-white"
                  : "bg-[#1E293B] text-[#94A3B8] hover:text-[#F8FAFC]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bar chart ───────────────────────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={sliced} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} barSize={10}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis dataKey="month" stroke="#94A3B8" tick={{ fontSize: 11 }} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} tickFormatter={yFmt} width={52} />
          <ReferenceLine y={0} stroke="#334155" strokeWidth={1.5} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [formatCurrency(value), "Cashflow"]}
            labelStyle={{ color: "#F8FAFC", fontWeight: 600 }}
          />
          <Bar dataKey="cashflow" name="Cashflow" radius={[3, 3, 0, 0]}>
            {sliced.map((entry, i) => (
              <Cell key={i} fill={entry.cashflow >= 0 ? "#14B8A6" : "#EF4444"} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {active.length >= 3 && (
        <>
          {/* ── Summary stats ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-[#0A1020] rounded-xl p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-1">Best month</p>
              <p className="text-sm font-bold text-[#22C55E]">{bestMonth ? formatCurrency(bestMonth.cashflow) : "—"}</p>
              {bestMonth && <p className="text-[10px] text-[#94A3B8] mt-0.5">{bestMonth.month}</p>}
            </div>
            <div className="bg-[#0A1020] rounded-xl p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-1">Worst month</p>
              <p className={`text-sm font-bold ${worstMonth && worstMonth.cashflow < 0 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                {worstMonth ? formatCurrency(worstMonth.cashflow) : "—"}
              </p>
              {worstMonth && <p className="text-[10px] text-[#94A3B8] mt-0.5">{worstMonth.month}</p>}
            </div>
            <div className="bg-[#0A1020] rounded-xl p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-1">Monthly average</p>
              <p className={`text-sm font-bold ${avgCashflow >= 0 ? "text-[#06B6D4]" : "text-[#EF4444]"}`}>
                {formatCurrency(avgCashflow)}
              </p>
            </div>
            <div className="bg-[#0A1020] rounded-xl p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-1">Positive ratio</p>
              <p className={`text-sm font-bold ${posRatio >= 70 ? "text-[#22C55E]" : posRatio >= 50 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>
                {posRatio}%
              </p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{positiveMonths} of {active.length} months</p>
            </div>
          </div>

          {/* ── Intelligence panel ─────────────────────────────────────────── */}
          <div className="mt-4 bg-[#14B8A60a] border border-[#14B8A618] rounded-xl overflow-hidden">

            {/* What happened? */}
            <div className="px-4 py-3 border-b border-[#14B8A615]">
              <p className="text-[10px] font-semibold text-[#14B8A6] uppercase tracking-widest mb-1.5">What happened?</p>
              <p className="text-sm text-[#CBD5E1] leading-relaxed">{whatHappenedText}</p>
              {stabilityText && (
                <p className={`text-sm mt-1.5 ${stabilityColor}`}>{stabilityText}</p>
              )}
            </div>

            {/* Why did it happen? */}
            {whyText && (
              <div className="px-4 py-3 border-b border-[#14B8A615]">
                <p className="text-[10px] font-semibold text-[#14B8A6] uppercase tracking-widest mb-1.5">Why did it happen?</p>
                <p className="text-sm text-[#CBD5E1] leading-relaxed">{whyText}</p>
              </div>
            )}

            {/* What should I do next? */}
            {actionText && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-[#14B8A6] uppercase tracking-widest mb-1.5">What should I do next?</p>
                <p className="text-sm text-[#CBD5E1] leading-relaxed">{actionText}</p>
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}
