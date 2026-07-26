import FlipCard from "./FlipCard";

interface MilestoneTimelineEntry {
  label: string;
  status: string;
  state: "paid" | "upcoming";
  amount: string;
  due: string;
}

interface MilestoneFlipCardProps {
  number: string;
  title: string;
  body: string;
  bg: string;
  shadowColor: string;
  ctaLabel: string;
  timeline: {
    heading: string;
    project: string;
    milestones: MilestoneTimelineEntry[];
  };
}

// Mirrors the real STATUS_STYLE palette used by MilestoneRow in
// src/components/projects/ProjectList.tsx, so this landing-page mockup
// matches the actual product's status-pill colors.
const STATE_STYLE: Record<MilestoneTimelineEntry["state"], { bg: string; text: string }> = {
  paid: { bg: "bg-[#E8F7F3]", text: "text-[#1F8A73]" },
  upcoming: { bg: "bg-[#FDF3E3]", text: "text-[#A66A0A]" },
};

export default function MilestoneFlipCard({
  number,
  title,
  body,
  bg,
  shadowColor,
  ctaLabel,
  timeline,
}: MilestoneFlipCardProps) {
  return (
    <FlipCard
      number={number}
      title={title}
      body={body}
      bg={bg}
      shadowColor={shadowColor}
      ctaLabel={ctaLabel}
      backHeading={timeline.heading}
      backSubtitle={timeline.project}
    >
      <div>
        {timeline.milestones.map((m, i) => {
          const style = STATE_STYLE[m.state];
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-2.5 border-t border-[#EEF1F5] first:border-t-0 first:pt-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.text}`}>
                    {m.status}
                  </span>
                  <span className="text-xs text-[#16283B] truncate">{m.label}</span>
                </div>
                <p className="text-[11px] text-[#8A93A6] mt-0.5">{m.due}</p>
              </div>
              <span className="text-xs font-semibold text-[#16283B] tabular-nums flex-shrink-0">
                {m.amount}
              </span>
            </div>
          );
        })}
      </div>
    </FlipCard>
  );
}
