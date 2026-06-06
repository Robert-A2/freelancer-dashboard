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
        <p className="text-[#6B7280] text-sm">Need at least 2 months of data to compare.</p>
      </div>
    );
  }

  const previousHasData = previous.totalIncome > 0 || previous.totalExpenses > 0;
  const currCashflow      = current.totalIncome  - current.totalExpenses;
  const prevCashflow      = previous.totalIncome - previous.totalExpenses;
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
          <h3 className="text-lg font-semibold text-[#1F2937]">{currLabel}</h3>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-[#E8EAE5] last:border-0">
              <span className="text-sm text-[#6B7280]">{row.label}</span>
              <span className="text-sm font-semibold text-[#1F2937] tabular-nums">
                {formatCurrency(row.curr)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 px-3 py-2.5 bg-[#4F7A650A] border border-[#4F7A6518] rounded-xl">
          <p className="text-xs text-[#6B7280]">
            <span className="text-[#4F7A65] font-medium">Upload another month</span> to start comparing periods and see what changed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 md:mb-5">
        <p className="label mb-1">Monthly Comparison</p>
        <h3 className="text-lg font-semibold text-[#1F2937]">What changed?</h3>
      </div>

      {/* Desktop table */}
      <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-x-5 gap-y-0">
        <div className="pb-2 border-b border-[#E8EAE5]" />
        <div className="text-xs text-[#9CA3AF] text-right pb-2 border-b border-[#E8EAE5] whitespace-nowrap">{prevLabel}</div>
        <div className="text-xs font-medium text-[#1F2937] text-right pb-2 border-b border-[#E8EAE5] whitespace-nowrap">{currLabel}</div>
        <div className="text-xs text-[#9CA3AF] text-right pb-2 border-b border-[#E8EAE5]">Change</div>

        {rows.map((row, i) => {
          const changeAmt = row.curr - row.prev;
          const isGood    = row.invertBad ? row.pct <= 0 : row.pct >= 0;
          const isLast    = i === rows.length - 1;
          const border    = isLast ? "" : "border-b border-[#E8EAE5]";
          const chipCls   = isGood ? "bg-[#5B8A7215] text-[#5B8A72]" : "bg-[#C66A5A15] text-[#C66A5A]";
          const amtCls    = isGood ? "text-[#5B8A72]" : "text-[#C66A5A]";
          const arrow     = row.pct > 0 ? "↑" : row.pct < 0 ? "↓" : "→";

          return (
            <Fragment key={row.label}>
              <div className={`text-sm text-[#6B7280] py-3 ${border}`}>{row.label}</div>
              <div className={`text-sm text-[#9CA3AF] tabular-nums text-right py-3 ${border}`}>{formatCurrency(row.prev)}</div>
              <div className={`text-sm font-semibold text-[#1F2937] tabular-nums text-right py-3 ${border}`}>{formatCurrency(row.curr)}</div>
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
          const chipCls   = isGood ? "bg-[#5B8A7215] text-[#5B8A72]" : "bg-[#C66A5A15] text-[#C66A5A]";
          const amtCls    = isGood ? "text-[#5B8A72]" : "text-[#C66A5A]";
          const arrow     = row.pct > 0 ? "↑" : row.pct < 0 ? "↓" : "→";

          return (
            <div key={row.label} className="bg-[#F7F8F5] rounded-xl p-4">
              <p className="text-sm font-medium text-[#1F2937] mb-3">{row.label}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">{prevLabel}</p>
                  <p className="text-sm text-[#9CA3AF] tabular-nums">{formatCurrency(row.prev)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">{currLabel}</p>
                  <p className="text-sm font-semibold text-[#1F2937] tabular-nums">{formatCurrency(row.curr)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#9CA3AF] mb-1">Change</p>
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
        <div className="mt-4 px-3 py-2.5 bg-[#F7F8F5] rounded-xl">
          <p className="text-sm text-[#374151] leading-relaxed">
            <span className="text-[#4F7A65] font-semibold">What this means: </span>
            {interpretation}
          </p>
        </div>
      )}
    </div>
  );
}
