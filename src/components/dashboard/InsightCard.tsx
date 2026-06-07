import type { InsightCategory, RankedInsight } from "@/lib/intelligence-engine";

export const CATEGORY_META: Record<InsightCategory, { label: string; icon: string; accent: string }> = {
  growth:      { label: "Financial Growth",    icon: "▲", accent: "#4CC4A4" },
  cashflow:    { label: "Cashflow & Stability", icon: "◆", accent: "#3AB5A0" },
  spending:    { label: "Spending Patterns",   icon: "●", accent: "#D4A254" },
  seasonality: { label: "Seasonality",         icon: "◐", accent: "#8AAEC8" },
  clients:     { label: "Client Insights",     icon: "◯", accent: "#D97070" },
};

// The figures are the actual takeaway — amounts, percentages, durations, years.
// Pulling them out in the card's accent colour lets a reader scan the section
// for the numbers first instead of hunting for them inside full sentences.
const FIGURE_RE =
  /(€[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s(?:consecutive\s)?(?:months?|years?|days?)\b|\b(?:19|20)\d{2}\b)/g;

export function renderWithFigures(text: string, accent: string) {
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

export default function InsightCard({ insight }: { insight: RankedInsight }) {
  const meta = CATEGORY_META[insight.category];
  return (
    <div
      className="flex items-start gap-3 bg-[#1A3048] rounded-xl pl-[13px] pr-4 py-3 border-l-[3px]"
      style={{ borderColor: meta.accent }}
    >
      <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: meta.accent }}>
        {meta.icon}
      </span>
      <p className="text-sm text-[#D8E8F4] leading-relaxed">
        {renderWithFigures(insight.text, meta.accent)}
      </p>
    </div>
  );
}
