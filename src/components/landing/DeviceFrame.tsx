"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ── Entrance-once viewport hook (with a safety fallback) ─────────────────────

function useEnteredOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fallback = setTimeout(() => setEntered(true), 1200);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          clearTimeout(fallback);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);

  return { ref, entered };
}

// A plain, flat product screenshot — like a real dashboard capture, not a
// styled 3D object. No tilt, no glow, no glass sheen: the same picture at
// every size, the way an actual screenshot behaves. Content is passed as
// children so this component stays purely about the physical presentation.
export default function DeviceFrame({ children }: { children: ReactNode }) {
  const { ref, entered } = useEnteredOnce<HTMLDivElement>();

  return (
    <div ref={ref} className="relative py-8">

      {/* Contact shadow — grounds the panel */}
      <div
        className="pointer-events-none absolute left-[6%] right-[20%] bottom-2 h-10 rounded-[50%] blur-2xl opacity-50"
        style={{ background: "radial-gradient(ellipse, #000814 0%, transparent 72%)" }}
        aria-hidden="true"
      />

      <div
        className={`relative transition-[opacity,transform] duration-700 ease-out ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {/* Frame — still flat and static (no tilt), but a two-layer shadow
            (a tight close one + a deep soft one) gives it real lift off the
            page instead of reading as pasted flush onto the background. */}
        <div className="relative rounded-2xl border border-[#1E3550] bg-[#0D1B2B] shadow-[0_3px_10px_-3px_rgba(13,27,43,0.3),0_28px_64px_-20px_rgba(13,27,43,0.5)] overflow-hidden">
          <div className="relative px-4 py-3.5 min-h-[280px]">
            {children}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          div {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
