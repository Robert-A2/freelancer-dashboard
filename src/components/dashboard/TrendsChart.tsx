"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";
import MonthDrawer, { type SelectedMonth } from "@/components/analytics/MonthDrawer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataPoint {
  month: string;
  year: number;
  monthNum: number;
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
}

interface Props {
  data: DataPoint[];
  trajectoryInsight?: Insight | null;
  trajectoryDetails?: Insight[];
  riskLevel?: "low" | "medium" | "high" | "critical";
  apiBase?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Byte-for-byte the same as SummaryCards' VERDICT_STYLE, keyed by the exact
// same riskLevel value that colors the verdict card — not a separately
// -computed "trend direction," which can (and did) disagree with riskLevel
// for the same account, making the two cards contradict each other in color.
// Using the identical input guarantees the two cards can never disagree.
const TRAJECTORY_BOX_STYLE = {
  low:      { bg: "bg-[#4CC4A40A]", border: "border-[#4CC4A415]" },
  medium:   { bg: "bg-[#D4A2540A]", border: "border-[#D4A25415]" },
  high:     { bg: "bg-[#D970700A]", border: "border-[#D9707015]" },
  critical: { bg: "bg-[#D970700A]", border: "border-[#D9707015]" },
} as const;

const TIME_RANGES = [
  { key: "3m",  months: 3   },
  { key: "6m",  months: 6   },
  { key: "12m", months: 12  },
  { key: "all", months: 999 },
] as const;

// trajectoryDetails is built oldest-first with a "recent momentum" bullet
// always last, so the tail end is exactly what matters most today. For a
// long-running account (years of history) this list otherwise grows one
// bullet per year forever — capping keeps the card calm by default while the
// full breakdown stays one click away. Matches CONTEXT_BULLET_CAP on
// SummaryCards' verdict card so both "verdict + reasons" cards on the
// dashboard cap at the same count and behave the same way.
const TRAJECTORY_DETAILS_CAP = 2;

const TOOLTIP_STYLE = {
  backgroundColor: "#132537",
  border: "1px solid #243F5E",
  borderRadius: "0.75rem",
  color: "#E8F0F8",
  fontSize: "13px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrendsChart({ data, trajectoryInsight, trajectoryDetails, riskLevel = "low", apiBase = "/api" }: Props) {
  const t      = useTranslations("dashboard.trendsChart");
  const tm     = useTranslations("metrics");
  const locale = useLocale() as Locale;
  const boxStyle = TRAJECTORY_BOX_STYLE[riskLevel];

  const [range,    setRange]    = useState(999);
  const [selMonth, setSelMonth] = useState<SelectedMonth | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const closeDrawer = useCallback(() => setSelMonth(null), []);

  const sliced = range === 999 ? data : data.slice(-range);

  const allDetails = trajectoryDetails ?? [];
  const hiddenDetailsCount = Math.max(0, allDetails.length - TRAJECTORY_DETAILS_CAP);
  const visibleDetails = detailsExpanded ? allDetails : allDetails.slice(-TRAJECTORY_DETAILS_CAP);

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-56">
        <p className="text-[#7BA8C4]">{t("uploadPrompt")}</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (chartData: any) => {
    const payload = chartData?.activePayload?.[0]?.payload as DataPoint | undefined;
    if (payload?.year && payload?.monthNum) {
      setSelMonth({ year: payload.year, monthNum: payload.monthNum, label: payload.month });
    }
  };

  return (
    <>
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
          <LineChart
            data={sliced}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            onClick={handleChartClick}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#243F5E" />
            <XAxis dataKey="month" stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} />
            <YAxis
              stroke="#6A97B4"
              tick={{ fontSize: 12, fill: "#6A97B4" }}
              tickFormatter={(v) => locale === "fr" ? `${(v/1000).toFixed(0)}k €` : `€${(v/1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => formatCurrency(value, locale)}
              labelStyle={{ color: "#E8F0F8", fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ paddingTop: "1rem", fontSize: 12, color: "#7BA8C4" }} />
            <Line type="monotone" dataKey="income"   stroke="#4CC4A4" strokeWidth={2}   dot={false} activeDot={{ r: 5, fill: "#4CC4A4" }} name={tm("income")}   />
            <Line type="monotone" dataKey="expenses" stroke="#D4A254" strokeWidth={2}   dot={false} activeDot={{ r: 5, fill: "#D4A254" }} name={tm("expenses")} />
            <Line type="monotone" dataKey="cashflow" stroke="#3AB5A0" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: "#3AB5A0" }} name={tm("cashflow")} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-xs text-[#4A7A9B] text-center mt-2">
          {t("tapHint")}
        </p>

        {trajectoryInsight && (
          <div className={`mt-4 ${boxStyle.bg} border ${boxStyle.border} rounded-xl px-5 py-4 space-y-2.5`}>
            <p className="text-sm font-medium text-[#E8F0F8] leading-relaxed">
              <InsightText insight={trajectoryInsight} />
            </p>
            {visibleDetails.length > 0 && (
              <ul className="space-y-2">
                {visibleDetails.map((line, i) => (
                  <li key={i} className="text-sm text-[#A8C6E0] flex items-start gap-2.5 leading-relaxed">
                    <span className="text-[#7BA8C4] opacity-60 flex-shrink-0 mt-1">·</span>
                    <span><InsightText insight={line} /></span>
                  </li>
                ))}
              </ul>
            )}
            {hiddenDetailsCount > 0 && (
              <button
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                className="flex items-center gap-1 text-xs font-medium text-[#7BA8C4] hover:text-[#A8C6E0] transition-colors"
              >
                {detailsExpanded ? t("showFewerDetails") : t("showMoreDetails", { count: hiddenDetailsCount })}
                <svg className={`w-3.5 h-3.5 transition-transform ${detailsExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <MonthDrawer month={selMonth} onClose={closeDrawer} locale={locale} apiBase={apiBase} />
    </>
  );
}
