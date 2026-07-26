import FlipCard from "./FlipCard";

interface TaxShieldFlipCardProps {
  number: string;
  title: string;
  body: string;
  bg: string;
  shadowColor: string;
  ctaLabel: string;
  breakdown: {
    heading: string;
    subtitle: string;
    grossLabel: string;
    gross: string;
    taxLabel: string;
    taxAmount: string;
    netLabel: string;
    net: string;
  };
}

export default function TaxShieldFlipCard({
  number,
  title,
  body,
  bg,
  shadowColor,
  ctaLabel,
  breakdown,
}: TaxShieldFlipCardProps) {
  return (
    <FlipCard
      number={number}
      title={title}
      body={body}
      bg={bg}
      shadowColor={shadowColor}
      ctaLabel={ctaLabel}
      backHeading={breakdown.heading}
      backSubtitle={breakdown.subtitle}
    >
      <div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#8A93A6]">{breakdown.grossLabel}</span>
          <span className="text-sm font-semibold text-[#16283B] tabular-nums">{breakdown.gross}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-[#EEF1F5]">
          <span className="text-xs text-[#8A93A6]">{breakdown.taxLabel}</span>
          <span className="text-sm font-semibold text-[#C0392B] tabular-nums">{breakdown.taxAmount}</span>
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-[#EEF1F5]">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8A93A6]">
            {breakdown.netLabel}
          </span>
          <span className="text-xl font-bold text-[#D4A254] tabular-nums">{breakdown.net}</span>
        </div>
      </div>
    </FlipCard>
  );
}
