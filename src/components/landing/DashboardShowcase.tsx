"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

// The hero's product preview — a real app-shell frame around the actual
// Dashboard components (TodayLayer, MoneyBreakdownCard, and — via
// UpcomingList — the real ExpectedPaymentDrawer), fed real screenshotted
// demo data. This wrapper itself only does two things: (1) provides the
// polished browser-chrome-style frame, and (2) toggles which pre-rendered
// pair ("before"/"after" the demo payment lands) is visible.
//
// The toggle has to happen this way rather than through ordinary React
// state/props: TodayLayer is a Server Component (it calls next-intl's
// server-side getTranslations), so once it's rendered into `before`/`after`
// here it's frozen — a client parent can't reach into it and change its
// props after the fact. The real interaction (opening the drawer, tapping
// "Mark as received") happens for real, deep inside that frozen tree, in
// the real client components (UpcomingList/ExpectedPaymentDrawer). Those
// broadcast a "nonodia-demo-state" window event when a demo cycle starts or
// completes — the only way to bridge back out to this shell — and this
// component just listens and swaps which pre-rendered pair is showing.
export default function DashboardShowcase({
  before, after, moneyBefore, moneyAfter,
}: {
  before: ReactNode;
  after: ReactNode;
  moneyBefore: ReactNode;
  moneyAfter: ReactNode;
}) {
  const [received, setReceived] = useState(false);
  const tNav = useTranslations("common");
  const tFilter = useTranslations("dashboard.accountFilter");
  const tQuickAdd = useTranslations("manual.quickAdd");

  useEffect(() => {
    function onDemoState(e: Event) {
      const detail = (e as CustomEvent<{ received: boolean }>).detail;
      if (detail) setReceived(detail.received);
    }
    window.addEventListener("nonodia-demo-state", onDemoState);
    return () => window.removeEventListener("nonodia-demo-state", onDemoState);
  }, []);

  return (
    <div className="w-full max-w-full bg-[#112232] border border-[#25405A] rounded-xl shadow-[0_16px_36px_-20px_rgba(13,27,43,0.4)] overflow-hidden">
      {/* The real app's own top nav and account filter — purely presentational
          framing (no real links, so it can never accidentally route an
          anonymous visitor into an authenticated-only page), but reusing the
          exact real labels/wording (common.nav.*, dashboard.accountFilter.*,
          manual.quickAdd.*) rather than inventing new copy. */}
      <div className="px-4 sm:px-5 pt-3.5 pb-3 border-b border-[#1E3446]">
        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-[#E8F0F8] text-sm">Nonodia</span>
            <div className="hidden sm:flex items-center gap-3.5 text-xs font-medium">
              <span className="text-[#3AB5A0]">{tNav("nav.dashboard")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.upload")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.history")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.analytics")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.forecast")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold text-[#3AB5A0] border border-[#3AB5A0] rounded-lg px-2 py-1">
              + {tQuickAdd("button")}
            </span>
            <span className="hidden sm:inline text-[10px] text-[#7BA8C4]">EN | FR</span>
            <span className="w-5 h-5 rounded-full bg-[#3AB5A0] text-[#0D1B2B] text-[10px] font-bold flex items-center justify-center">S</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-[#1E3446] text-[#7BA8C4] text-[11px] font-medium">
            {tFilter("allAccounts")}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1E3446] text-[#E8F0F8] ring-1 ring-[#3AB5A0] text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CC4A4]" />
            Business (manual)
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1E3446] text-[#7BA8C4] text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7BA8C4]" />
            Personal (manual)
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="relative">
          <div className={received ? "hidden" : ""}>{before}</div>
          <div className={received ? "" : "hidden"}>{after}</div>
        </div>

        <div className="mt-3">
          <div className={received ? "hidden" : ""}>{moneyBefore}</div>
          <div className={received ? "" : "hidden"}>{moneyAfter}</div>
        </div>
      </div>
    </div>
  );
}
