"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

interface DataPoint {
  month: string; income: number; expenses: number; savings: number; cashflow: number;
}
interface Props {
  data: DataPoint[];
  trajectoryInsight?: Insight | null;
  trajectoryDetails?: Insight[];
}

const TIME_RANGES = [
  { key: "3m",  months: 3   },
  { key: "6m",  months: 6   },
  { key: "12m", months: 12  },
  { key: "all", months: 999 },
] as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#132537",
  border: "1px solid #243F5E",
  borderRadius: "0.75rem",
  color: "#E8F0F8",
  fontSize: "13px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

export default function TrendsChart({ data, trajectoryInsight, trajectoryDetails }: Props) {
  const t = useTranslations("dashboard.trendsChart");
  const tm = useTranslations("metrics");
  const locale = useLocale() as Locale;
  const [range, setRange] = useState(999);
  const sliced = range === 999 ? data : data.slice(-range);

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-56">
        <p className="text-[#7BA8C4]">{t("uploadPrompt")}</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="label mb-1">{t("label")}</p>
            <h3 className="text-lg font-semibold text-[#E8F0F8]">{t("title")}</h3>
          </div>
        </div>
        <div className="flex gap-1.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.months)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                range === r.months
                  ? "bg-[#3AB5A0] text-[#0D1B2B]"
                  : "bg-[#1A3048] text-[#7BA8C4] hover:text-[#E8F0F8]"
              }`}
            >
              {t(`ranges.${r.key}`)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={sliced} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243F5E" />
          <XAxis dataKey="month" stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} />
          <YAxis stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} tickFormatter={(v) => locale === "fr" ? `${(v/1000).toFixed(0)}k €` : `€${(v/1000).toFixed(0)}k`} width={48} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => formatCurrency(value, locale)}
            labelStyle={{ color: "#E8F0F8", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ paddingTop: "1rem", fontSize: 12, color: "#7BA8C4" }} />
          <Line type="monotone" dataKey="income"   stroke="#4CC4A4" strokeWidth={2}   dot={false} name={tm("income")}   />
          <Line type="monotone" dataKey="expenses" stroke="#D4A254" strokeWidth={2}   dot={false} name={tm("expenses")} />
          <Line type="monotone" dataKey="cashflow" stroke="#3AB5A0" strokeWidth={1.5} dot={false} name={tm("cashflow")} strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>

      {trajectoryInsight && (
        <div className="mt-4 bg-[#4CC4A40A] border border-[#4CC4A418] rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-[#E8F0F8]">
            <InsightText insight={trajectoryInsight} />
          </p>
          {trajectoryDetails && trajectoryDetails.length > 0 && (
            <ul className="space-y-1">
              {trajectoryDetails.map((line, i) => (
                <li key={i} className="text-sm text-[#A8C6E0] flex items-start gap-2">
                  <span className="text-[#4CC4A4] opacity-70 flex-shrink-0 mt-0.5">·</span>
                  <span><InsightText insight={line} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
