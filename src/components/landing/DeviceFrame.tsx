"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";

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

// ── Resting 3D tilt ────────────────────────────────────────────────────────
// The panel doesn't sit flat — it rests turned slightly toward the hero copy
// (negative Y = its right edge recedes into depth) with a touch of downward
// pitch, like a monitor photographed just off-axis on a desk. This is the
// permanent resting pose, not a hover-only effect; the mouse adds only a
// small delta on top of it, so the screen never looks "flat" even before
// anyone moves their cursor.
const BASE_ROTATE_Y = -5;
const BASE_ROTATE_X = 1.5;
const HOVER_RANGE = 3.5;

function useRestingTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const apply = useCallback((dy: number, dx: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `perspective(1700px) translateZ(-20px) rotateX(${(BASE_ROTATE_X + dx).toFixed(2)}deg) rotateY(${(BASE_ROTATE_Y + dy).toFixed(2)}deg)`;
  }, []);

  useEffect(() => { apply(0, 0); }, [apply]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    apply(px * HOVER_RANGE, -py * HOVER_RANGE);
  }, [apply]);

  const onMouseLeave = useCallback(() => apply(0, 0), [apply]);

  return { ref, onMouseMove, onMouseLeave };
}

// A single premium display panel — no stand, no browser chrome, just the
// screen — resting at a fixed angle turned toward the reader, the way a
// product-photography monitor shot is composed. Content is passed as
// children so this component stays purely about the physical presentation.
export default function DeviceFrame({ children }: { children: ReactNode }) {
  const { ref: viewportRef, entered } = useEnteredOnce<HTMLDivElement>();
  const tilt = useRestingTilt();

  return (
    <div ref={viewportRef} className="relative py-8">

      {/* Contact shadow — grounds the panel, offset to match the tilt direction */}
      <div
        className="pointer-events-none absolute left-[6%] right-[20%] bottom-2 h-12 rounded-[50%] blur-2xl opacity-50"
        style={{ background: "radial-gradient(ellipse, #000814 0%, transparent 72%)" }}
        aria-hidden="true"
      />

      {/* Float — the whole panel drifts a few px up/down on a slow, calm
          cycle, independent of the tilt element's own JS-driven transform
          (a separate layer so the two never fight over `transform`). */}
      <div className="device-float">
      <div
        ref={tilt.ref}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        className={`w-full relative transition-[opacity,transform] duration-700 ease-out will-change-transform [transform-style:preserve-3d] ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {/* Ambient glow behind the panel — slowly breathes, never moves position */}
        <div
          className="device-glow pointer-events-none absolute -inset-6 -z-10 rounded-[40px] blur-2xl"
          style={{ background: "radial-gradient(circle, #3B82F6 0%, rgba(59,130,246,0) 65%)" }}
          aria-hidden="true"
        />

        {/* Bezel — a thin, light frame instead of a heavy metal slab */}
        <div
          className="relative rounded-2xl p-1.5"
          style={{
            background: "linear-gradient(155deg, #2B3E54 0%, #16283C 100%)",
            boxShadow:
              "0 20px 40px -18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Screen */}
          <div className="relative rounded-xl overflow-hidden bg-[#0D1B2B]">
            <div className="relative px-4 py-3.5 min-h-[280px]">
              {children}

              {/* Glass reflection — one faint sweep, once, when this comes into view */}
              {entered && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                  <div
                    className="absolute -inset-y-10 w-1/3 glass-sweep-once"
                    style={{
                      background: "linear-gradient(75deg, transparent 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 55%, transparent 100%)",
                    }}
                  />
                </div>
              )}

              {/* Faint permanent glass sheen — sells "screen," not "flat card" */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, transparent 30%)" }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
      </div>

      <style jsx>{`
        .glass-sweep-once {
          animation: glassSweepOnce 1.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes glassSweepOnce {
          from { transform: translateX(-120%) skewX(-15deg); }
          to   { transform: translateX(320%) skewX(-15deg); }
        }
        .device-float {
          animation: deviceFloat 7s ease-in-out infinite;
        }
        @keyframes deviceFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        .device-glow {
          animation: deviceGlowBreathe 6s ease-in-out infinite;
        }
        @keyframes deviceGlowBreathe {
          0%, 100% { opacity: 0.24; transform: scale(0.97); }
          50%      { opacity: 0.42; transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .device-float, .device-glow, .glass-sweep-once {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
