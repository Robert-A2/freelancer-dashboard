"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

interface Props {
  businessProfit: number;
  profitMarginPct: number | null;
  personalSpend: number;
  trueNetCashflow: number;
  intentInsights: Insight[];
  lifeInsights?: Insight[];
}

export default function BusinessIntelligence({
  businessProfit,
  profitMarginPct,
  personalSpend,
  trueNetCashflow,
  intentInsights,
  lifeInsights = [],
}: Props) {
  const t = useTranslations("dashboard.businessIntelligence");
  const locale = useLocale() as Locale;

  const margin = profitMarginPct !== null ? Math.round(profitMarginPct) : null;

  const warningInsight = intentInsights.find(
    (i) => i.key === "insights.intent.incompleteDataWarning"
  );
  const regularInsights = intentInsights.filter(
    (i) => i.key !== "insights.intent.incompleteDataWarning"
  );

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <span className="label">{t("title")}</span>
        <span className="text-[11px] font-medium text-[#6A97B4] bg-[#0D1B2B] px-2.5 py-1 rounded-md">
          {t("allTime")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0D1B2B] border border-[#1E3550] rounded-xl p-4 space-y-1.5">
          <p className="label">{t("businessProfit")}</p>
          <p
            className={`text-2xl font-bold leading-none tabular-nums ${
              businessProfit >= 0 ? "text-[#4CC4A4]" : "text-[#D97070]"
            }`}
          >
            {formatCurrency(businessProfit, locale)}
          </p>
          {margin !== null && (
            <p className="text-[13px] text-[#6A97B4]">{t("margin", { margin })}</p>
          )}
        </div>

        <div className="bg-[#0D1B2B] border border-[#1E3550] rounded-xl p-4 space-y-1.5">
          <p className="label">{t("trueNetCashflow")}</p>
          <p
            className={`text-2xl font-bold leading-none tabular-nums ${
              trueNetCashflow >= 0 ? "text-[#4CC4A4]" : "text-[#D97070]"
            }`}
          >
            {formatCurrency(trueNetCashflow, locale)}
          </p>
          <p className="text-[13px] text-[#6A97B4]">{t("trueNetCashflowNote")}</p>
        </div>

        <div className="bg-[#0D1B2B] border border-[#1E3550] rounded-xl p-4 space-y-1.5">
          <p className="label">{t("personalBurnRate")}</p>
          <p className="text-2xl font-bold leading-none tabular-nums text-[#D4A254]">
            {formatCurrency(personalSpend, locale)}
          </p>
          <p className="text-[13px] text-[#6A97B4]">{t("personalBurnRateNote")}</p>
        </div>
      </div>

      {regularInsights.length > 0 && (
        <ul className="space-y-2">
          {regularInsights.map((insight, i) => (
            <li
              key={i}
              className="text-sm text-[#A8C6E0] flex items-start gap-2.5 leading-relaxed"
            >
              <span className="text-[#4CC4A4] opacity-50 mt-[3px] flex-shrink-0 select-none">·</span>
              <span>
                <InsightText insight={insight} accent="#4CC4A4" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {lifeInsights.length > 0 && (
        <ul className="space-y-2">
          {lifeInsights.map((insight, i) => (
            <li
              key={i}
              className="text-sm text-[#A8C6E0] flex items-start gap-2.5 leading-relaxed"
            >
              <span className="text-[#4CC4A4] opacity-50 mt-[3px] flex-shrink-0 select-none">·</span>
              <span>
                <InsightText insight={insight} accent="#4CC4A4" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {warningInsight && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#D4A2540A] border border-[#D4A25425] rounded-xl">
          <span className="text-[#D4A254] font-semibold text-sm flex-shrink-0 mt-0.5">!</span>
          <p className="text-sm text-[#D4A254] leading-relaxed">
            <InsightText insight={warningInsight} accent="#D4A254" />
          </p>
        </div>
      )}
    </div>
  );
}
