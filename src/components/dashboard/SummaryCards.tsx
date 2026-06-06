"use client";

import { formatCurrency, pct } from "@/utils/finance";

interface MonthData {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netCashflow: number;
}

interface Props {
  current: MonthData | null;
  previous: MonthData | null;
  summary?: string;
  context?: string[];
}

function changePct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function Chip({ value, invert }: { value: number; invert?: boolean }) {
  const isGood = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
        isGood ? "bg-[#22C55E20] text-[#22C55E]" : "bg-[#EF444420] text-[#EF4444]"
      }`}
    >
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

export default function SummaryCards({ current, previous, summary, context }: Props) {
  const c = current ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };
  const p = previous ?? { totalIncome: 0, totalExpenses: 0, totalSavings: 0, netCashflow: 0 };

  const savingsRate = pct(c.totalSavings, c.totalIncome);
  const spendRate   = pct(c.totalExpenses, c.totalIncome);

  const cards = [
    {
      label:  "Income",
      value:  c.totalIncome,
      sub:    `${savingsRate}% saved`,
      change: changePct(c.totalIncome, p.totalIncome),
      color:  "text-[#22C55E]",
    },
    {
      label:   "Expenses",
      value:   c.totalExpenses,
      sub:     `${spendRate}% of income`,
      change:  changePct(c.totalExpenses, p.totalExpenses),
      color:   "text-[#F59E0B]",
      invert:  true,
    },
    {
      label:  "Savings",
      value:  c.totalSavings,
      sub:    `${savingsRate}% of income`,
      change: changePct(c.totalSavings, p.totalSavings),
      color:  "text-[#3B82F6]",
    },
    {
      label:  "Cashflow",
      value:  c.netCashflow,
      sub:    c.netCashflow >= 0 ? "After expenses & savings" : "Expenses exceeded income",
      change: changePct(c.netCashflow, p.netCashflow),
      color:  c.netCashflow >= 0 ? "text-[#06B6D4]" : "text-[#EF4444]",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card-sm">
            <p className="label mb-2">{card.label}</p>
            <p className={`text-xl md:text-2xl font-bold ${card.color} leading-none mb-1`}>
              {formatCurrency(card.value)}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <p className="text-xs text-[#94A3B8]">{card.sub}</p>
              {previous && <Chip value={card.change} invert={card.invert} />}
            </div>
          </div>
        ))}
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
