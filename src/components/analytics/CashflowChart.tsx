"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import MonthDrawer, { type SelectedMonth } from "@/components/analytics/MonthDrawer";

interface DataPoint {
  month: string;
  year: number;
  monthNum: number;
  cashflow: number;
  income: number;
  expenses: number;
}
interface Props { data: DataPoint[]; hideHeader?: boolean; apiBase?: string; }

const TIME_RANGES = [
  { key: "6m",  months: 6   },
  { key: "12m", months: 12  },
  { key: "all", months: 999 },
] as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#132537",
  border: "1px solid #243F5E",
  borderRadius: "0.75rem",
  color: "#E8F0F8",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

function yFmt(v: number, locale: Locale): string {
  const abs = Math.abs(v);
  let num: string;
  if (abs >= 10_000) num = String(Math.round(v / 1000));
  else if (abs >= 1_000) num = (v / 1000).toFixed(1).replace(/\.0$/, "");
  else num = String(Math.round(v));

  if (abs >= 1_000) num += "k";
  return locale === "fr" ? `${num.replace(".", ",")} €` : `€${num}`;
}

function localAvg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export default function CashflowChart({ data, hideHeader = false, apiBase = "/api" }: Props) {
  const t = useTranslations("analytics");
  const tr = useTranslations("dashboard.trendsChart");
  const tm = useTranslations("metrics");
  const locale = useLocale() as Locale;
  const [range,    setRange]    = useState(12);
  const [selMonth, setSelMonth] = useState<SelectedMonth | null>(null);
  const closeDrawer = useCallback(() => setSelMonth(null), []);
  const sliced = range === 999 ? data : data.slice(-range);
  const active = sliced.filter(d => d.income > 0 || d.expenses > 0);

  if (data.length === 0) return null;

  const positiveMonths = active.filter(d => d.cashflow >= 0).length;
  const negativeMonths = active.filter(d => d.cashflow <  0).length;
  const avgCashflow    = localAvg(active.map(d => d.cashflow));
  const avgIncome      = localAvg(active.map(d => d.income));
  const avgExpenses    = localAvg(active.map(d => d.expenses));
  const negMonths      = active.filter(d => d.cashflow < 0);
  const posRatio       = active.length > 0 ? Math.round((positiveMonths / active.length) * 100) : 0;

  const bestMonth  = active.length ? active.reduce((b, d) => d.cashflow > b.cashflow ? d : b, active[0]) : null;
  const worstMonth = active.length ? active.reduce((w, d) => d.cashflow < w.cashflow ? d : w, active[0]) : null;

  const lowIncNeg  = negMonths.filter(m => m.income   < avgIncome   * 0.85).length;
  const highExpNeg = negMonths.filter(m => m.expenses > avgExpenses * 1.15).length;
  const bothNeg    = negMonths.filter(m => m.income < avgIncome * 0.85 && m.expenses > avgExpenses * 1.15).length;

  const bold = (chunks: React.ReactNode) => <strong className="font-semibold text-[#E8F0F8]">{chunks}</strong>;

  let whyContent: React.ReactNode    = null;
  let actionContent: React.ReactNode = null;

  if (negativeMonths > 0) {
    if (bothNeg >= Math.ceil(negativeMonths * 0.4)) {
      whyContent    = t.rich("cashflowChart.narrative.whyBothNeg", { count: bothNeg, b: bold });
      actionContent = t("cashflowChart.narrative.actionBuildReserve");
    } else if (lowIncNeg >= highExpNeg) {
      whyContent    = t.rich("cashflowChart.narrative.whyLowIncome", { count: negativeMonths, lowCount: lowIncNeg, b: bold });
      actionContent = t("cashflowChart.narrative.actionStabiliseClients", { count: negativeMonths });
    } else {
      whyContent    = t.rich("cashflowChart.narrative.whyHighExpenses", { count: negativeMonths, highCount: highExpNeg, b: bold });
      actionContent = t("cashflowChart.narrative.actionExpenseCeiling");
    }
  } else if (active.length >= 3) {
    actionContent = t("cashflowChart.narrative.actionAutomateSurplus");
  }

  let stabilityContent: React.ReactNode = null;
  let stabilityColor = "text-[#7BA8C4]";

  if (active.length >= 8) {
    const mid       = Math.floor(active.length / 2);
    const firstNeg  = active.slice(0, mid).filter(m => m.cashflow < 0).length;
    const secondNeg = active.slice(mid).filter(m => m.cashflow  < 0).length;
    if (secondNeg < firstNeg - 1) {
      stabilityContent = t("cashflowChart.narrative.stabilityImproving");
      stabilityColor   = "text-[#4CC4A4]";
    } else if (secondNeg > firstNeg + 1) {
      stabilityContent = t("cashflowChart.narrative.stabilityWeakening");
      stabilityColor   = "text-[#D97070]";
    } else if (firstNeg > 0 || secondNeg > 0) {
      // Only worth noting "unchanged" when there's something to compare —
      // with zero negative months in both halves, "No negative months
      // recorded" above already says everything there is to say.
      stabilityContent = t("cashflowChart.narrative.stabilityUnchanged");
      stabilityColor   = "text-[#7BA8C4]";
    }
  }

  const whatHappenedContent = active.length >= 3 ? (
    <>
      {t.rich("cashflowChart.narrative.summary", { positive: positiveMonths, total: active.length, pct: String(posRatio), b: bold })}{" "}
      {negativeMonths === 0
        ? t("cashflowChart.narrative.noNegativeMonths")
        : t.rich("cashflowChart.narrative.negativeMonthsCount", { count: negativeMonths, b: bold })}
    </>
  ) : null;

  return (
    <>
    <div className="card">

      <div className={`flex items-start justify-between gap-3 flex-wrap ${hideHeader ? "mb-4" : "mb-4"}`}>
        {!hideHeader && (
          <div>
            <p className="label mb-1">{t("cashflowSection.label")}</p>
            <h3 className="text-lg font-semibold text-[#E8F0F8]">{t("cashflowSection.title")}</h3>
          </div>
        )}
        <div className={`flex gap-1.5 ${hideHeader ? "ml-auto" : ""}`}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.months)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
                range === r.months
                  ? "bg-[#3AB5A0] text-[#0D1B2B]"
                  : "bg-[#1A3048] text-[#7BA8C4] hover:text-[#E8F0F8]"
              }`}
            >
              {tr(`ranges.${r.key}`)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={sliced}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          barSize={10}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(chartData: any) => {
            const payload = chartData?.activePayload?.[0]?.payload as DataPoint | undefined;
            if (payload?.year && payload?.monthNum) {
              setSelMonth({ year: payload.year, monthNum: payload.monthNum, label: payload.month });
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#243F5E" vertical={false} />
          <XAxis dataKey="month" stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} />
          <YAxis stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} tickFormatter={(v) => yFmt(v, locale)} width={52} />
          <ReferenceLine y={0} stroke="#243F5E" strokeWidth={1.5} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [formatCurrency(value, locale), tm("cashflow")]}
            labelStyle={{ color: "#E8F0F8", fontWeight: 600 }}
            itemStyle={{ color: "#A8C6E0" }}
          />
          <Bar dataKey="cashflow" name={tm("cashflow")} radius={[3, 3, 0, 0]}>
            {sliced.map((entry, i) => (
              <Cell key={i} fill={entry.cashflow >= 0 ? "#4CC4A4" : "#D97070"} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {active.length >= 3 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">{t("cashflowChart.bestMonth")}</p>
              <p className="text-sm font-bold text-[#4CC4A4]">{bestMonth ? formatCurrency(bestMonth.cashflow, locale) : "—"}</p>
              {bestMonth && <p className="text-xs text-[#6A97B4] mt-1">{bestMonth.month}</p>}
            </div>
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">{t("cashflowChart.worstMonth")}</p>
              <p className={`text-sm font-bold ${worstMonth && worstMonth.cashflow < 0 ? "text-[#D97070]" : "text-[#6A97B4]"}`}>
                {worstMonth ? formatCurrency(worstMonth.cashflow, locale) : "—"}
              </p>
              {worstMonth && <p className="text-xs text-[#6A97B4] mt-1">{worstMonth.month}</p>}
            </div>
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">{t("cashflowChart.monthlyAverage")}</p>
              <p className={`text-sm font-bold ${avgCashflow >= 0 ? "text-[#3AB5A0]" : "text-[#D97070]"}`}>
                {formatCurrency(avgCashflow, locale)}
              </p>
            </div>
            <div className="bg-[#1A3048] rounded-xl p-4">
              <p className="label mb-2">{t("cashflowChart.positiveRatio")}</p>
              <p className={`text-sm font-bold ${posRatio >= 70 ? "text-[#4CC4A4]" : posRatio >= 50 ? "text-[#D4A254]" : "text-[#D97070]"}`}>
                {t("cashflowChart.ratioValue", { pct: String(posRatio) })}
              </p>
              <p className="text-xs text-[#6A97B4] mt-1">{t("cashflowChart.monthsCount", { positive: positiveMonths, total: active.length })}</p>
            </div>
          </div>

          <div className="mt-4 bg-[#3AB5A00A] border border-[#3AB5A018] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#3AB5A015]">
              <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-widest mb-1.5">{t("cashflowChart.whatHappened")}</p>
              <p className="text-sm text-[#A8C6E0] leading-relaxed">{whatHappenedContent}</p>
              {stabilityContent && (
                <p className={`text-sm mt-1.5 ${stabilityColor}`}>{stabilityContent}</p>
              )}
            </div>
            {whyContent && (
              <div className="px-4 py-3 border-b border-[#3AB5A015]">
                <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-widest mb-1.5">{t("cashflowChart.whyHappened")}</p>
                <p className="text-sm text-[#A8C6E0] leading-relaxed">{whyContent}</p>
              </div>
            )}
            {actionContent && (
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold text-[#3AB5A0] uppercase tracking-widest mb-1.5">{t("cashflowChart.whatNext")}</p>
                <p className="text-sm text-[#A8C6E0] leading-relaxed">{actionContent}</p>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-[#4A7A9B] text-center mt-2">
        {t("cashflowChart.tapHint")}
      </p>

    </div>

    <MonthDrawer month={selMonth} onClose={closeDrawer} locale={locale} apiBase={apiBase} />
  </>
  );
}
