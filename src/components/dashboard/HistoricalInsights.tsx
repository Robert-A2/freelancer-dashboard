"use client";

import { useState } from "react";

export interface HistoricalInsight {
  text: string;
  type: "overview" | "seasonal" | "category";
}

interface Props {
  highlights: HistoricalInsight[];
  totalMonths: number;
}

const INITIAL_COUNT = 4;

const TYPE_META: Record<HistoricalInsight["type"], { icon: string; accent: string }> = {
  overview: { icon: "◆", accent: "#3AB5A0" },
  seasonal: { icon: "◐", accent: "#8AAEC8" },
  category: { icon: "▲", accent: "#D4A254" },
};

// The figures are the actual takeaway — amounts, percentages, durations, years.
// Pulling them out in the card's accent colour lets a reader scan the section
// for the numbers first instead of hunting for them inside full sentences.
const FIGURE_RE =
  /(€[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s(?:consecutive\s)?(?:months?|years?|days?)\b|\b(?:19|20)\d{2}\b)/g;

function renderWithFigures(text: string, accent: string) {
  return text.split(FIGURE_RE).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold" style={{ color: accent }}>
        {part}
      </strong>
    ) : (
      part
    )
  );
}

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
        {visible.map((highlight, i) => {
          const meta = TYPE_META[highlight.type];
          return (
            <div
              key={i}
              className="flex items-start gap-3 bg-[#1A3048] rounded-xl pl-[13px] pr-4 py-3 border-l-[3px]"
              style={{ borderColor: meta.accent }}
            >
              <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: meta.accent }}>
                {meta.icon}
              </span>
              <p className="text-sm text-[#D8E8F4] leading-relaxed">
                {renderWithFigures(highlight.text, meta.accent)}
              </p>
            </div>
          );
        })}
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
