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
  backgroundColor: "#FFFFFF",
  border: "1px solid #E8EAE5",
  borderRadius: "0.75rem",
  color: "#1F2937",
  fontSize: "13px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

export default function TrendsChart({ data, trajectoryInsight, trajectoryDetails }: Props) {
  const [range, setRange] = useState(999);
  const sliced = range === 999 ? data : data.slice(-range);

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-56">
        <p className="text-[#6B7280]">Upload a CSV to see your financial trends.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="label mb-1">Financial Trajectory</p>
            <h3 className="text-lg font-semibold text-[#1F2937]">Income vs Expenses</h3>
          </div>
        </div>
        <div className="flex gap-1.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.months)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                range === r.months
                  ? "bg-[#4F7A65] text-white"
                  : "bg-[#F3F4F0] text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={sliced} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8EAE5" />
          <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} width={48} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: "#1F2937", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ paddingTop: "1rem", fontSize: 12, color: "#6B7280" }} />
          <Line type="monotone" dataKey="income"   stroke="#5B8A72" strokeWidth={2}   dot={false} name="Income"   />
          <Line type="monotone" dataKey="expenses" stroke="#C79A63" strokeWidth={2}   dot={false} name="Expenses" />
          <Line type="monotone" dataKey="cashflow" stroke="#4F7A65" strokeWidth={1.5} dot={false} name="Cashflow" strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>

      {trajectoryInsight && (
        <div className="mt-4 bg-[#5B8A720A] border border-[#5B8A7218] rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-[#1F2937]">{trajectoryInsight}</p>
          {trajectoryDetails && trajectoryDetails.length > 0 && (
            <ul className="space-y-1">
              {trajectoryDetails.map((line, i) => (
                <li key={i} className="text-sm text-[#374151] flex items-start gap-2">
                  <span className="text-[#5B8A72] opacity-70 flex-shrink-0 mt-0.5">·</span>
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
