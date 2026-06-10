"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { InsightCategory, RankedInsight } from "@/lib/intelligence-engine";
import InsightCard, { CATEGORY_META } from "@/components/dashboard/InsightCard";

interface Props {
  insights: RankedInsight[];
  totalMonths: number;
}

const TOP_COUNT = 5;

// Fixed display order — mirrors the ranking priority in buildHistoricalInsights.
const CATEGORY_ORDER: InsightCategory[] = ["growth", "cashflow", "spending", "seasonality", "clients"];

export default function FinancialStory({ insights, totalMonths }: Props) {
  const t = useTranslations("analytics.storySection");
  const tCategories = useTranslations("insightCategories");
  const [expanded, setExpanded] = useState(false);

  if (insights.length === 0) return null;

  const top = insights.slice(0, TOP_COUNT);
  const groups = CATEGORY_ORDER
    .map((category) => ({ category, items: insights.filter((i) => i.category === category) }))
    .filter((group) => group.items.length > 0);

  return (
    <div>
      <p className="text-sm text-[#7BA8C4] mb-4">
        {t("intro", { months: totalMonths })}
      </p>

      {!expanded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {top.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ category, items }) => {
            const meta = CATEGORY_META[category];
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm" style={{ color: meta.accent }}>{meta.icon}</span>
                  <h4 className="text-sm font-semibold text-[#E8F0F8]">{tCategories(category)}</h4>
                  <span className="text-xs text-[#6A97B4]">
                    {t("insightsCount", { count: items.length })}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((insight, i) => (
                    <InsightCard key={i} insight={insight} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {insights.length > TOP_COUNT && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-5 flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#2E9D8A] font-medium transition-colors w-full justify-center py-1"
        >
          {expanded ? (
            <>
              {t("showLess")}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </>
          ) : (
            <>
              {t("showFullBreakdown")}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}
