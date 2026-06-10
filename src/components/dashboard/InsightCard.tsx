import type { InsightCategory, RankedInsight } from "@/lib/intelligence-engine";
import InsightText from "@/components/ui/InsightText";

export const CATEGORY_META: Record<InsightCategory, { icon: string; accent: string }> = {
  growth:      { icon: "▲", accent: "#4CC4A4" },
  cashflow:    { icon: "◆", accent: "#3AB5A0" },
  spending:    { icon: "●", accent: "#D4A254" },
  seasonality: { icon: "◐", accent: "#8AAEC8" },
  clients:     { icon: "◯", accent: "#D97070" },
};

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
        <InsightText insight={insight} accent={meta.accent} />
      </p>
    </div>
  );
}
