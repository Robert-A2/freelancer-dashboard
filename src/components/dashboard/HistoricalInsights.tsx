import { getTranslations } from "next-intl/server";
import type { RankedInsight } from "@/lib/intelligence-engine";
import Link from "next/link";
import InsightCard from "./InsightCard";

interface Props {
  insights: RankedInsight[];
  totalMonths: number;
  basePath?: string;
}

const VISIBLE_COUNT = 5;

export default async function HistoricalInsights({ insights, totalMonths, basePath = "" }: Props) {
  if (insights.length === 0) return null;

  const t = await getTranslations("dashboard.historicalInsights");
  const visible = insights.slice(0, VISIBLE_COUNT);

  return (
    <div className="card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>

      <Link
        href={`${basePath}/analytics#financial-story`}
        className="mt-4 flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#2E9D8A] font-medium transition-colors w-full justify-center py-1"
      >
        {t("viewFull")}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
