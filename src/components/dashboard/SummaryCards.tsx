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
  runway: number;
  prevRunway: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskPositiveMonths: number;
  riskTotalMonths: number;
  summary?: string;
  context?: string[];
}

const RISK_STYLE = {
  low:      { label: "Low",      color: "text-[#4CC4A4]" },
  medium:   { label: "Medium",   color: "text-[#D4A254]" },
  high:     { label: "High",     color: "text-[#D97070]" },
  critical: { label: "Critical", color: "text-[#D97070]" },
};

function changePct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function Chip({ value, invert }: { value: number; invert?: boolean }) {
  const isGood = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      isGood ? "bg-[#4CC4A410] text-[#4CC4A4]" : "bg-[#D9707010] text-[#D97070]"
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

  const currCashflow  = c.totalIncome - c.totalExpenses;
  const prevCashflow  = p.totalIncome - p.totalExpenses;
  const spendRate     = c.totalIncome > 0 ? Math.round((c.totalExpenses / c.totalIncome) * 100) : 0;
  const risk          = RISK_STYLE[riskLevel];
  const runwayChange  = changePct(runway, prevRunway);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5">

        {/* Income */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">Income</p>
          <p className="text-2xl md:text-3xl font-bold text-[#4CC4A4] leading-none tabular-nums">
            {formatCurrency(c.totalIncome)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#3A5470]">{spendRate}% spend ratio</p>
            {previous && <Chip value={changePct(c.totalIncome, p.totalIncome)} />}
          </div>
        </div>

        {/* Expenses */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">Expenses</p>
          <p className="text-2xl md:text-3xl font-bold text-[#D4A254] leading-none tabular-nums">
            {formatCurrency(c.totalExpenses)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#3A5470]">{spendRate}% of income</p>
            {previous && <Chip value={changePct(c.totalExpenses, p.totalExpenses)} invert />}
          </div>
        </div>

        {/* Cashflow */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">Cashflow</p>
          <p className={`text-2xl md:text-3xl font-bold leading-none tabular-nums ${currCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]"}`}>
            {formatCurrency(currCashflow)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#3A5470]">
              {currCashflow >= 0 ? "Income above expenses" : "Expenses exceed income"}
            </p>
            {previous && <Chip value={changePct(currCashflow, prevCashflow)} />}
          </div>
        </div>

        {/* Runway */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">Runway</p>
          <p className={`text-2xl md:text-3xl font-bold leading-none tabular-nums ${runway >= 0.5 ? "text-[#4CC4A4]" : runway >= 0 ? "text-[#D4A254]" : "text-[#D97070]"}`}>
            {fmtRunway(runway)}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-[#3A5470]">
              {runway >= 0 ? "months buffer added" : "months consumed"}
            </p>
            {previous && <Chip value={runwayChange} />}
          </div>
        </div>

        {/* Risk */}
        <div className="card-sm flex flex-col gap-3">
          <p className="label">Risk</p>
          <p className={`text-2xl md:text-3xl font-bold leading-none ${risk.color}`}>
            {risk.label}
          </p>
          <p className="text-[13px] text-[#3A5470]">
            {riskTotalMonths > 0
              ? `${riskPositiveMonths} of ${riskTotalMonths} months positive`
              : "No history yet"}
          </p>
        </div>

      </div>

      {summary && (
        <div className="bg-[#4CC4A40A] border border-[#4CC4A415] rounded-xl px-5 py-4 space-y-2.5">
          <p className="text-sm font-medium text-[#D8E8F4] leading-relaxed">{summary}</p>
          {context && context.length > 0 && (
            <ul className="space-y-2">
              {context.map((line, i) => (
                <li key={i} className="text-sm text-[#8AAEC8] flex items-start gap-2.5 leading-relaxed">
                  <span className="text-[#4CC4A4] opacity-60 mt-1 flex-shrink-0">·</span>
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
