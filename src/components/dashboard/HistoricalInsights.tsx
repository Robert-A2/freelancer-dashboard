"use client";

import { useState } from "react";

interface Props {
  highlights: string[];
  totalMonths: number;
}

const INITIAL_COUNT = 4;

export default function HistoricalInsights({ highlights, totalMonths }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (highlights.length === 0) return null;

  const visible   = expanded ? highlights : highlights.slice(0, INITIAL_COUNT);
  const remaining = highlights.length - INITIAL_COUNT;
  const hasMore   = highlights.length > INITIAL_COUNT;

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
        {visible.map((highlight, i) => (
          <div key={i} className="flex items-start gap-3 bg-[#1A3048] rounded-xl px-4 py-3">
            <span className="text-[#3AB5A0] text-sm mt-0.5 flex-shrink-0">◆</span>
            <p className="text-sm text-[#A8C6E0]">{highlight}</p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#2E9D8A] font-medium transition-colors w-full justify-center py-1"
        >
          {expanded ? (
            <>
              Show less
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </>
          ) : (
            <>
              Show {remaining} more insight{remaining !== 1 ? "s" : ""}
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
