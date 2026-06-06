"use client";

import { Fragment } from "react";
import { formatCurrency } from "@/utils/finance";

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
  interpretation?: string;
  currLabel?: string;
  prevLabel?: string;
}

function changePct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

export default function MonthlyComparison({
  current, previous, changes, interpretation, currLabel: currLabelProp, prevLabel: prevLabelProp,
}: Props) {
  const now      = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currLabel = currLabelProp ?? now.toLocaleDateString("en-IE", { month: "short", year: "numeric" });
  const prevLabel = prevLabelProp ?? prevDate.toLocaleDateString("en-IE", { month: "short", year: "numeric" });

  if (!current || !previous || !changes) {
    return (
      <div className="card">
        <p className="label mb-2">Monthly Comparison</p>
        <p className="text-[#CBD5E1] text-sm">Need at least 2 months of data to compare.</p>
      </div>
    );
  }

  const previousHasData = previous.totalIncome > 0 || previous.totalExpenses > 0;

  // Cashflow = income − expenses (savings excluded from display)
  const currCashflow     = current.totalIncome  - current.totalExpenses;
  const prevCashflow     = previous.totalIncome - previous.totalExpenses;
  const cashflowChangePct = changePct(currCashflow, prevCashflow);

  const rows = [
    { label: "Income",   prev: previous.totalIncome,   curr: current.totalIncome,   pct: changes.income,   invertBad: false },
    { label: "Expenses", prev: previous.totalExpenses, curr: current.totalExpenses, pct: changes.expenses, invertBad: true  },
    { label: "Cashflow", prev: prevCashflow,            curr: currCashflow,           pct: cashflowChangePct, invertBad: false },
  ];

  if (!previousHasData) {
    return (
      <div className="card">
        <div className="mb-4">
          <p className="label mb-1">Monthly Summary</p>
          <h3 className="text-lg font-semibold">{currLabel}</h3>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-[#1E293B] last:border-0">
              <span className="text-sm text-[#CBD5E1]">{row.label}</span>
              <span className="text-sm font-semibold text-[#F8FAFC] tabular-nums">
                {formatCurrency(row.curr)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 px-3 py-2.5 bg-[#14B8A60a] border border-[#14B8A618] rounded-xl">
          <p className="text-xs text-[#94A3B8]">
            <span className="text-[#14B8A6] font-medium">Upload another month</span> to start comparing periods and see what changed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 md:mb-5">
        <p className="label mb-1">Monthly Comparison</p>
        <h3 className="text-lg font-semibold">What changed?</h3>
      </div>

      {/* Desktop table */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-x-5 gap-y-0">
        <div className="pb-2 border-b border-[#1E293B]" />
        <div className="text-xs text-[#94A3B8] text-right pb-2 border-b border-[#1E293B] whitespace-nowrap">{prevLabel}</div>
        <div className="text-xs font-medium text-[#F8FAFC] text-right pb-2 border-b border-[#1E293B] whitespace-nowrap">{currLabel}</div>
        <div className="text-xs text-[#94A3B8] text-right pb-2 border-b border-[#1E293B]">Change</div>

        {rows.map((row, i) => {
          const changeAmt = row.curr - row.prev;
          const isGood    = row.invertBad ? row.pct <= 0 : row.pct >= 0;
          const isLast    = i === rows.length - 1;
          const border    = isLast ? "" : "border-b border-[#1E293B]";
          const chipCls   = isGood ? "bg-[#22C55E20] text-[#22C55E]" : "bg-[#EF444420] text-[#EF4444]";
          const amtCls    = isGood ? "text-[#22C55E]" : "text-[#EF4444]";
          const arrow     = row.pct > 0 ? "↑" : row.pct < 0 ? "↓" : "→";

          return (
            <Fragment key={row.label}>
              <div className={`text-sm text-[#CBD5E1] py-3 ${border}`}>{row.label}</div>
              <div className={`text-sm text-[#94A3B8] tabular-nums text-right py-3 ${border}`}>{formatCurrency(row.prev)}</div>
              <div className={`text-sm font-semibold text-[#F8FAFC] tabular-nums text-right py-3 ${border}`}>{formatCurrency(row.curr)}</div>
              <div className={`flex items-center gap-2 justify-end py-3 ${border}`}>
                <span className={`text-xs font-medium tabular-nums whitespace-nowrap ${amtCls}`}>
                  {changeAmt >= 0 ? "+" : "−"}{formatCurrency(Math.abs(changeAmt))}
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
          const chipCls   = isGood ? "bg-[#22C55E20] text-[#22C55E]" : "bg-[#EF444420] text-[#EF4444]";
          const amtCls    = isGood ? "text-[#22C55E]" : "text-[#EF4444]";
          const arrow     = row.pct > 0 ? "↑" : row.pct < 0 ? "↓" : "→";

          return (
            <div key={row.label} className="bg-[#0A1020] rounded-xl p-4">
              <p className="text-sm font-medium text-[#F8FAFC] mb-3">{row.label}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">{prevLabel}</p>
                  <p className="text-sm text-[#94A3B8] tabular-nums">{formatCurrency(row.prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1">{currLabel}</p>
                  <p className="text-sm font-semibold text-[#F8FAFC] tabular-nums">{formatCurrency(row.curr)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#94A3B8] mb-1">Change</p>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-medium tabular-nums ${amtCls}`}>
                      {changeAmt >= 0 ? "+" : "−"}{formatCurrency(Math.abs(changeAmt))}
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

      {interpretation && (
        <div className="mt-4 px-3 py-2.5 bg-[#0A1020] rounded-xl">
          <p className="text-sm text-[#CBD5E1] leading-relaxed">
            <span className="text-[#14B8A6] font-semibold">What this means: </span>
            {interpretation}
          </p>
        </div>
      )}
    </div>
  );
}
