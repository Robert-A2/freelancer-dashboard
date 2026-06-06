"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/utils/finance";

interface DataPoint {
  month: string; income: number; expenses: number; savings: number; cashflow: number;
}

interface Props {
  data: DataPoint[];
  trajectoryInsight?: string;
  trajectoryDetails?: string[];
}

const TIME_RANGES = [
  { label: "3M",  months: 3   },
  { label: "6M",  months: 6   },
  { label: "12M", months: 12  },
  { label: "ALL", months: 999 },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #1E293B",
  borderRadius: "0.75rem",
  color: "#F8FAFC",
  fontSize: "13px",
};

export default function TrendsChart({ data, trajectoryInsight, trajectoryDetails }: Props) {
  const [range, setRange] = useState(999);

  const sliced  = range === 999 ? data : data.slice(-range);

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-56">
        <p className="text-[#CBD5E1]">Upload a CSV to see your financial trends.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="label mb-1">Financial Trajectory</p>
            <h3 className="text-lg font-semibold">Income vs Expenses</h3>
          </div>
          </div>
        <div className="flex gap-1.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.months)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
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

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={sliced} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
          <XAxis dataKey="month" stroke="#94A3B8" tick={{ fontSize: 11 }} />
          <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={48} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: "#F8FAFC" }}
          />
          <Legend wrapperStyle={{ paddingTop: "1rem", fontSize: 12 }} />
          <Line type="monotone" dataKey="income"   stroke="#22C55E" strokeWidth={2} dot={false} name="Income"   />
          <Line type="monotone" dataKey="expenses" stroke="#F59E0B" strokeWidth={2} dot={false} name="Expenses" />
          <Line type="monotone" dataKey="savings"  stroke="#3B82F6" strokeWidth={2} dot={false} name="Savings"  />
          <Line type="monotone" dataKey="cashflow" stroke="#14B8A6" strokeWidth={1.5} dot={false} name="Cashflow" strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>

      {trajectoryInsight && (
        <div className="mt-4 bg-[#22C55E0a] border border-[#22C55E18] rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-[#F8FAFC]">{trajectoryInsight}</p>
          {trajectoryDetails && trajectoryDetails.length > 0 && (
            <ul className="space-y-1">
              {trajectoryDetails.map((line, i) => (
                <li key={i} className="text-sm text-[#CBD5E1] flex items-start gap-2">
                  <span className="text-[#22C55E] opacity-60 flex-shrink-0 mt-0.5">·</span>
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
