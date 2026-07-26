"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PhoneFrame from "@/components/landing/PhoneFrame";

// Same icon paths as the real Navbar.tsx / DemoNavbar.tsx mobile bottom
// nav — copied exactly, not redrawn, so this is genuinely the same UI.
const IconHome = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11 2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconUpload = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);
const IconAnalytics = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
const IconForecast = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);
const IconClients = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);
const IconProjects = () => (
  <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25a2 2 0 01-2 2H5.75a2 2 0 01-2-2v-4.25M20.25 14.15L18.25 6.5a2 2 0 00-2-1.5H7.75a2 2 0 00-2 1.5l-2 7.65M20.25 14.15h-4.5a2 2 0 00-2 2v.1a2 2 0 01-2 2h-.5a2 2 0 01-2-2v-.1a2 2 0 00-2-2h-4.5" />
  </svg>
);

const MOBILE_NAV = [
  { key: "dashboard", Icon: IconHome },
  { key: "upload",    Icon: IconUpload },
  { key: "projects",  Icon: IconProjects },
  { key: "clients",   Icon: IconClients },
  { key: "analytics", Icon: IconAnalytics },
  { key: "forecast",  Icon: IconForecast },
] as const;

interface CardData {
  label: string;
  badge: string;
  badgeClass: string;
  body: string;
  bodyClass?: string;
}
interface CashflowData {
  label: string;
  title: string;
  desc: string;
  monthsPositive: string;
}
interface HowBuiltData {
  label: string;
  tiles: { label: string; value: string; color?: string }[];
  methodologyLabel: string;
  methodologySubtitle: string;
  confidenceScoreLabel: string;
  confidencePct: number;
  reasons: string[];
}
interface Props {
  appName: string;
  health: CardData;
  cashflowRisk: CashflowData;
  direction: CardData;
  howBuilt: HowBuiltData;
  navLabels: Record<string, string>;
}

function useEnteredOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No blind timeout fallback here on purpose — this section sits below
    // the fold, so the reveal must wait for a real scroll-into-view, not
    // fire early just because a fixed delay elapsed.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => { io.disconnect(); };
  }, []);

  return { ref, entered };
}

// The popups only fire (and the wrapper only reserves room for them) once
// there's real space around the phone — narrower viewports just show the
// static phone with all four cards inside, no popups, no clipping.
function useCanPop() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1220px)");
    setCan(mq.matches);
    const onChange = () => setCan(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return can;
}

// Two different treatments share the same phase timer:
// - `canPop` (real desktop space beside the phone): the in-phone card dims
//   once its popup has appeared, since attention has moved to the bubble.
// - Below that width (phones, tablets, most laptops): there's no bubble, so
//   the card briefly highlights in place instead — a spotlight, not a fade —
//   then returns to normal once the sequence moves past it.
function cardTreatment(cardPhase: number, phase: number, canPop: boolean): string {
  if (canPop) {
    return phase >= cardPhase ? "blur-[2px] opacity-40" : "";
  }
  return phase === cardPhase
    ? "border-[#3AB5A0] shadow-[0_0_0_1px_rgba(58,181,160,0.5),0_0_10px_rgba(58,181,160,0.4)]"
    : "";
}

// A notification-style popup anchored to the phone's edge — like a
// WhatsApp message bubble popping up over a phone mockup. It overlaps the
// phone slightly (the phone stays fully intact behind it) and lands with a
// bouncy overshoot instead of a plain fade.
function Popup({ visible, side, style, children }: { visible: boolean; side: "left" | "right"; style: React.CSSProperties; children: ReactNode }) {
  return (
    <div
      style={style}
      className={`absolute z-20 w-[200px] transition-[opacity,transform] duration-[550ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none motion-reduce:duration-0 ${
        visible
          ? "opacity-100 scale-100"
          : `opacity-0 scale-50 pointer-events-none ${side === "right" ? "-translate-x-4" : "translate-x-4"}`
      }`}
    >
      {children}
    </div>
  );
}

// Sequenced reveal: Health pops right, then Cashflow Risk pops left, then
// Business Direction pops right (stacking under Health) — each stays
// floating once out, overlapping the phone's edge like a notification
// banner. The phone itself never changes — all four cards stay visible
// inside it the whole time; nothing is removed or shifted. Runs once,
// settles, never loops.
export default function PhoneForecastShowcase({ appName, health, cashflowRisk, direction, howBuilt, navLabels }: Props) {
  const { ref, entered } = useEnteredOnce<HTMLDivElement>();
  const canPop = useCanPop();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!entered) return;

    // Respect reduced-motion: skip straight to the settled end state instead
    // of animating the reveal sequence, on any screen size.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(4);
      return;
    }

    // Runs on every screen size now — on `canPop` screens this drives the
    // side popups (and dims the in-phone card behind them); below that width
    // there's no room for popups, so the same phase steps instead drive a
    // brief in-place highlight per card (see the animated cards below),
    // settling to phase 4 (all normal, nothing highlighted) at the end.
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase(1), 1000));
    timers.push(setTimeout(() => setPhase(2), 2600));
    timers.push(setTimeout(() => setPhase(3), 4200));
    timers.push(setTimeout(() => setPhase(4), 5800));
    return () => timers.forEach(clearTimeout);
  }, [entered]);

  return (
    <div ref={ref} className={`relative inline-block py-10 scale-[0.92] ${canPop ? "px-[160px]" : ""}`}>
      <PhoneFrame>
        <div className="pointer-events-none select-none flex flex-col h-full">
          {/* Status bar — the phone's own chrome: time left, signal/wifi/battery right */}
          <div className="flex items-center justify-between h-7 px-4 pt-2 bg-[#0D1B2B] flex-shrink-0">
            <span className="text-[10px] font-semibold text-[#E8F0F8] tabular-nums">9:41</span>
            <div className="flex items-center gap-1.5">
              <svg width="13" height="9" viewBox="0 0 14 10" fill="none">
                <rect x="0" y="6" width="2.4" height="4" rx="0.5" fill="#E8F0F8" />
                <rect x="3.8" y="4" width="2.4" height="6" rx="0.5" fill="#E8F0F8" />
                <rect x="7.6" y="2" width="2.4" height="8" rx="0.5" fill="#E8F0F8" />
                <rect x="11.4" y="0" width="2.4" height="10" rx="0.5" fill="#E8F0F8" />
              </svg>
              <svg width="13" height="10" viewBox="0 0 16 12" fill="none">
                <circle cx="8" cy="9.5" r="1.1" fill="#E8F0F8" />
                <path d="M5 7.2a4.2 4.2 0 016 0" stroke="#E8F0F8" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                <path d="M2.5 4.5a8 8 0 0111 0" stroke="#E8F0F8" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              </svg>
              <svg width="20" height="10" viewBox="0 0 22 11" fill="none">
                <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="#E8F0F8" strokeOpacity="0.5" />
                <rect x="2" y="2" width="15" height="7" rx="1.3" fill="#E8F0F8" />
                <rect x="19.5" y="3.5" width="1.5" height="4" rx="0.7" fill="#E8F0F8" fillOpacity="0.5" />
              </svg>
            </div>
          </div>

          {/* App header — Nonodia + language switcher + account/sidebar trigger */}
          <div className="flex items-center justify-between h-9 px-3.5 bg-[#132537] border-b border-[#1E3550] flex-shrink-0">
            <span className="font-semibold text-[#E8F0F8] text-[12px] tracking-tight">{appName}</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] font-medium">
                <span className="text-[#3AB5A0]">EN</span>
                <span className="text-[#3A5068]">|</span>
                <span className="text-[#6A97B4]">FR</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-[#3AB5A0] text-[#0D1B2B] font-semibold text-[10px] flex items-center justify-center">
                S
              </div>
            </div>
          </div>

          {/* Main content — all four cards stay visible here, unchanged, for good */}
          <div className="flex-1 px-2.5 py-1.5 overflow-hidden flex flex-col gap-1">

            <div
              className={`bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 transition-[filter,opacity,border-color,box-shadow] duration-700 motion-reduce:transition-none ${cardTreatment(1, phase, canPop)}`}
            >
              <p className="text-[7px] font-medium text-[#6A97B4] uppercase tracking-wide mb-0.5">{health.label}</p>
              <span className={`text-[8.5px] font-semibold px-1.5 py-0.5 rounded-md inline-block mb-0.5 ${health.badgeClass}`}>
                {health.badge}
              </span>
              <p className={`text-[7px] leading-snug ${health.bodyClass ?? "text-[#7BA8C4]"}`}>{health.body}</p>
            </div>

            <div
              className={`bg-[#D4A2540A] border border-[#D4A25425] rounded-lg p-1.5 transition-[filter,opacity,border-color,box-shadow] duration-700 motion-reduce:transition-none ${cardTreatment(2, phase, canPop)}`}
            >
              <p className="text-[7px] font-medium text-[#6A97B4] uppercase tracking-wide mb-0.5">{cashflowRisk.label}</p>
              <p className="text-[12px] font-bold text-[#D4A254] mb-0.5 leading-none">{cashflowRisk.title}</p>
              <p className="text-[7px] text-[#7BA8C4] leading-snug mb-0.5">{cashflowRisk.desc}</p>
              <p className="text-[6.5px] text-[#6A97B4]">{cashflowRisk.monthsPositive}</p>
            </div>

            <div
              className={`bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 transition-[filter,opacity,border-color,box-shadow] duration-700 motion-reduce:transition-none ${cardTreatment(3, phase, canPop)}`}
            >
              <p className="text-[7px] font-medium text-[#6A97B4] uppercase tracking-wide mb-0.5">{direction.label}</p>
              <span className={`text-[8.5px] font-semibold px-1.5 py-0.5 rounded-md inline-block mb-0.5 ${direction.badgeClass}`}>
                {direction.badge}
              </span>
              <p className={`text-[7px] leading-snug ${direction.bodyClass ?? "text-[#7BA8C4]"}`}>{direction.body}</p>
            </div>

            <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-1.5">
              <p className="text-[7px] font-medium text-[#6A97B4] uppercase tracking-wide mb-1">{howBuilt.label}</p>

              <div className="grid grid-cols-2 gap-1 mb-1.5">
                {howBuilt.tiles.map((tile, i) => (
                  <div key={i} className="bg-[#1A3048] rounded-lg p-1">
                    <p className="text-[6px] font-medium text-[#6A97B4] uppercase tracking-wide mb-0.5">{tile.label}</p>
                    <p className={`text-[7.5px] font-semibold leading-tight ${tile.color ?? "text-[#A8C6E0]"}`}>{tile.value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#1E3550] pt-1">
                <p className="text-[7.5px] font-medium text-[#A8C6E0] leading-none mb-0.5">{howBuilt.methodologyLabel}</p>
                <p className="text-[6px] text-[#6A97B4] mb-0.5">{howBuilt.methodologySubtitle}</p>

                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[6.5px] font-medium text-[#6A97B4]">{howBuilt.confidenceScoreLabel}</span>
                  <span className="text-[8.5px] font-bold text-[#4CC4A4] tabular-nums">{howBuilt.confidencePct}%</span>
                </div>
                <div className="h-1 bg-[#1A3048] rounded-full overflow-hidden mb-0.5">
                  <div className="h-full bg-[#4CC4A4] rounded-full" style={{ width: `${howBuilt.confidencePct}%` }} />
                </div>
                <ul className="space-y-0.5">
                  {howBuilt.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-1 text-[6px] text-[#6A97B4] leading-snug">
                      <span className="text-[#3AB5A0] flex-shrink-0">·</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex-shrink-0 bg-[#132537] border-t border-[#243F5E] pb-1">
            <div className="flex items-stretch">
              {MOBILE_NAV.map(({ key, Icon }) => {
                const active = key === "forecast";
                return (
                  <div key={key} className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 ${active ? "text-[#3AB5A0]" : "text-[#6A97B4]"}`}>
                    {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#3AB5A0] rounded-full" />}
                    <Icon />
                    <span className={`text-[6.5px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                      {navLabels[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PhoneFrame>

      {canPop && (
        <>
          {/* Health — pops over the phone's right edge first */}
          <Popup visible={phase >= 1} side="right" style={{ top: "70px", right: "10px" }}>
            <div className="bg-[#0D1B2B] border border-[#1E3550] rounded-xl p-4 shadow-2xl shadow-black/40">
              <p className="text-[10px] font-medium text-[#6A97B4] uppercase tracking-wide mb-2">{health.label}</p>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-md inline-block mb-2 ${health.badgeClass}`}>
                {health.badge}
              </span>
              <p className={`text-[11px] leading-relaxed ${health.bodyClass ?? "text-[#7BA8C4]"}`}>{health.body}</p>
            </div>
          </Popup>

          {/* Cashflow Risk — pops over the phone's left edge second */}
          <Popup visible={phase >= 2} side="left" style={{ top: "190px", left: "10px" }}>
            <div className="bg-[#0D1B2B] border border-[#D4A25425] rounded-xl p-4 shadow-2xl shadow-black/40">
              <p className="text-[10px] font-medium text-[#6A97B4] uppercase tracking-wide mb-2">{cashflowRisk.label}</p>
              <p className="text-lg font-bold text-[#D4A254] mb-1.5 leading-none">{cashflowRisk.title}</p>
              <p className="text-[11px] text-[#7BA8C4] leading-relaxed mb-2">{cashflowRisk.desc}</p>
              <p className="text-[10px] text-[#6A97B4]">{cashflowRisk.monthsPositive}</p>
            </div>
          </Popup>

          {/* Business Direction — pops over the phone's right edge third, below Health */}
          <Popup visible={phase >= 3} side="right" style={{ top: "280px", right: "10px" }}>
            <div className="bg-[#0D1B2B] border border-[#1E3550] rounded-xl p-4 shadow-2xl shadow-black/40">
              <p className="text-[10px] font-medium text-[#6A97B4] uppercase tracking-wide mb-2">{direction.label}</p>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-md inline-block mb-2 ${direction.badgeClass}`}>
                {direction.badge}
              </span>
              <p className={`text-[11px] leading-relaxed ${direction.bodyClass ?? "text-[#7BA8C4]"}`}>{direction.body}</p>
            </div>
          </Popup>
        </>
      )}
    </div>
  );
}
