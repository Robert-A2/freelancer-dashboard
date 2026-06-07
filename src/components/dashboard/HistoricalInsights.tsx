import type { RankedInsight } from "@/lib/intelligence-engine";
import Link from "next/link";
import InsightCard from "./InsightCard";

interface Props {
  insights: RankedInsight[];
  totalMonths: number;
}

const VISIBLE_COUNT = 5;

export default function HistoricalInsights({ insights, totalMonths }: Props) {
  if (insights.length === 0) return null;

  const visible = insights.slice(0, VISIBLE_COUNT);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <div>
          <p className="label mb-1">Your Financial Story</p>
          <h3 className="text-lg font-semibold text-[#E8F0F8]">Historical Insights</h3>
        </div>
        <span className="text-xs text-[#7BA8C4] bg-[#1A3048] px-2 py-1 rounded-lg self-start sm:flex-shrink-0">
          {totalMonths} month{totalMonths !== 1 ? "s" : ""} of history
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
      </div>

      <Link
        href="/analytics#financial-story"
        className="mt-4 flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#2E9D8A] font-medium transition-colors w-full justify-center py-1"
      >
        View full financial story
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
