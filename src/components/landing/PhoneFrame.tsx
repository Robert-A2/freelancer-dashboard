"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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

// A phone-shaped display — portrait, thin bezel, held straight (no tilt) —
// content is passed in as children.
export default function PhoneFrame({ children }: { children: ReactNode }) {
  const { ref, entered } = useEnteredOnce<HTMLDivElement>();

  return (
    <div ref={ref} className="relative py-6 flex justify-center">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[320px] h-[600px] rounded-[64px] opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #3B82F6 0%, rgba(59,130,246,0) 65%)" }}
        aria-hidden="true"
      />

      <div
        className={`relative transition-[opacity,transform] duration-700 ease-out will-change-transform ${
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {/* Bezel */}
        <div
          className="relative rounded-[42px] p-2"
          style={{
            background: "linear-gradient(155deg, #2B3E54 0%, #16283C 100%)",
            boxShadow: "0 30px 60px -20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
          }}
        >
          {/* Screen */}
          <div className="relative w-[230px] h-[560px] rounded-[30px] overflow-hidden bg-[#0D1B2B] flex flex-col">
            {/* Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full bg-[#02060c] z-20" aria-hidden="true" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
