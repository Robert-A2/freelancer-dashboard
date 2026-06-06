"use client";

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
  runway: number;       // current period runway in months (income-expenses / avg expenses)
  prevRunway: number;   // previous period runway for comparison chip
  riskLevel: "low" | "medium" | "high" | "critical";
  riskPositiveMonths: number;   // e.g. 38
  riskTotalMonths: number;      // e.g. 42
  summary?: string;
  context?: string[];
}

const RISK_STYLE = {
  low:      { label: "Low",      color: "text-[#22C55E]" },
  medium:   { label: "Medium",   color: "text-[#F59E0B]" },
  high:     { label: "High",     color: "text-[#EF4444]" },
  critical: { label: "Critical", color: "text-[#EF4444]" },
};

function changePct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function Chip({ value, invert }: { value: number; invert?: boolean }) {
  const isGood = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
      isGood ? "bg-[#22C55E20] text-[#22C55E]" : "bg-[#EF444420] text-[#EF4444]"
    }`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

function fmtRunway(m: number): string {
  if (Math.abs(m) < 0.05) return "0.0 mo";
  return `${m >= 0 ? "+" : "−"}${Math.abs(m).toFixed(1)} mo`;
}

export default function SummaryCards({
  current, previous, runway, prevRunway, riskLevel, riskPositiveMonths, riskTotalMonths, summary, context,
}: Props) {
  const c = current  ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };
  const p = previous ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };

  // Cashflow = income − expenses (savings excluded — tracked internally, not displayed)
  const currCashflow = c.totalIncome - c.totalExpenses;
  const prevCashflow = p.totalIncome - p.totalExpenses;
  const spendRate    = c.totalIncome > 0 ? Math.round((c.totalExpenses / c.totalIncome) * 100) : 0;
  const risk         = RISK_STYLE[riskLevel];
  const runwayChange = changePct(runway, prevRunway);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">

        {/* Income */}
        <div className="card-sm">
          <p className="label mb-2">Income</p>
          <p className="text-xl md:text-2xl font-bold text-[#22C55E] leading-none mb-1">
            {formatCurrency(c.totalIncome)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-xs text-[#94A3B8]">{spendRate}% spend ratio</p>
            {previous && <Chip value={changePct(c.totalIncome, p.totalIncome)} />}
          </div>
        </div>

        {/* Expenses */}
        <div className="card-sm">
          <p className="label mb-2">Expenses</p>
          <p className="text-xl md:text-2xl font-bold text-[#F59E0B] leading-none mb-1">
            {formatCurrency(c.totalExpenses)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-xs text-[#94A3B8]">{spendRate}% of income</p>
            {previous && <Chip value={changePct(c.totalExpenses, p.totalExpenses)} invert />}
          </div>
        </div>

        {/* Cashflow */}
        <div className="card-sm">
          <p className="label mb-2">Cashflow</p>
          <p className={`text-xl md:text-2xl font-bold leading-none mb-1 ${currCashflow >= 0 ? "text-[#06B6D4]" : "text-[#EF4444]"}`}>
            {formatCurrency(currCashflow)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-xs text-[#94A3B8]">
              {currCashflow >= 0 ? "Income above expenses" : "Expenses above income"}
            </p>
            {previous && <Chip value={changePct(currCashflow, prevCashflow)} />}
          </div>
        </div>

        {/* Runway */}
        <div className="card-sm">
          <p className="label mb-2">Runway</p>
          <p className={`text-xl md:text-2xl font-bold leading-none mb-1 tabular-nums ${runway >= 0.5 ? "text-[#22C55E]" : runway >= 0 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>
            {fmtRunway(runway)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="text-xs text-[#94A3B8]">
              {runway >= 0 ? "months buffer added" : "months buffer consumed"}
            </p>
            {previous && <Chip value={runwayChange} />}
          </div>
        </div>

        {/* Risk */}
        <div className="card-sm">
          <p className="label mb-2">Risk</p>
          <p className={`text-xl md:text-2xl font-bold leading-none mb-1 ${risk.color}`}>
            {risk.label}
          </p>
          <p className="text-xs text-[#94A3B8] mt-2">
            {riskTotalMonths > 0
              ? `${riskPositiveMonths}/${riskTotalMonths} months positive`
              : "No history yet"}
          </p>
        </div>

      </div>

      {summary && (
        <div className="bg-[#22C55E0a] border border-[#22C55E18] rounded-xl px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-[#F8FAFC]">{summary}</p>
          {context && context.length > 0 && (
            <ul className="space-y-1.5">
              {context.map((line, i) => (
                <li key={i} className="text-sm text-[#CBD5E1] flex items-start gap-2">
                  <span className="text-[#22C55E] opacity-60 mt-0.5 flex-shrink-0">·</span>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
