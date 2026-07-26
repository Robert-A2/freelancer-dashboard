"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface FlipCardProps {
  number: string;
  title: string;
  body: string;
  bg: string;
  shadowColor: string;
  ctaLabel: string;
  backHeading: string;
  backSubtitle: string;
  children: ReactNode;
}

const AUTO_REVERT_MS = 7000;

// Shared flip mechanics (play button on the front, timed auto-revert, manual
// close) for landing-page value-prop cards that demo a real product feature
// on their back face. See MilestoneFlipCard / TaxShieldFlipCard for the two
// concrete back-face contents.
export default function FlipCard({
  number,
  title,
  body,
  bg,
  shadowColor,
  ctaLabel,
  backHeading,
  backSubtitle,
  children,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const play = () => {
    setFlipped(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFlipped(false), AUTO_REVERT_MS);
  };

  const revert = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFlipped(false);
  };

  return (
    <div
      className="relative border rounded-2xl [perspective:1200px]"
      style={{ backgroundColor: bg, borderColor: bg, boxShadow: `0 8px 24px -8px ${shadowColor}` }}
    >
      <div
        className={`relative min-h-[280px] h-full transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none motion-reduce:duration-0 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front */}
        <div className="[backface-visibility:hidden] h-full p-8 flex flex-col">
          <span className="text-sm font-bold tabular-nums mb-4 text-white">{number}</span>
          <p className="text-xl font-bold tracking-[-0.01em] leading-snug mb-3 text-white">{title}</p>
          <p className="text-[15px] leading-relaxed text-white font-medium mb-5">{body}</p>
          <button
            type="button"
            onClick={play}
            className="mt-auto inline-flex items-center gap-2 self-start bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
              <path d="M13.5 2.5v3.2h-3.2" />
            </svg>
            {ctaLabel}
          </button>
        </div>

        {/* Back */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] h-full p-6 flex flex-col">
          <div className="bg-white rounded-xl shadow-[0_8px_20px_rgba(13,27,43,0.18)] p-5 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8A93A6]">
                {backHeading}
              </p>
              <button
                type="button"
                onClick={revert}
                aria-label="Close"
                className="text-[#8A93A6] hover:text-[#0D1B2B] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="text-sm font-semibold text-[#0D1B2B] mb-3">{backSubtitle}</p>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
