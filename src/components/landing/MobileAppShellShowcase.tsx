import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import TodayStatsGrid from "@/components/dashboard/TodayStatsGrid";
import UpcomingList from "@/components/dashboard/UpcomingList";
import { DEMO_PAYMENT_ID, buildDemoTodayFacts, buildDemoScenario, buildDemoAfter } from "@/lib/landing-demo-data";

// The mobile counterpart to ProductDemoReel/DashboardShowcase — same real
// components (TodayStatsGrid and UpcomingList, the exact code the real
// dashboard itself renders — TodayStatsGrid extracted from TodayLayer so
// both places use identical, unmodified markup) and the exact same real
// demo data, curated to the two most important pieces: the four headline
// numbers and the one live interaction (the real "Coming up" row really
// opens the real Expected Payment drawer, same demo props as desktop). No
// phone bezel/notch illustration (that reads as a fake mockup, not the
// real responsive UI) and no attempt to cram the full desktop card stack
// ("Spending this month" / "Your money") into a narrow column, which is
// what produces the tall, scrolling-screenshot feel this is deliberately
// avoiding. Same app-shell chrome language as the desktop showcase (dark
// strip, rounded card, shadow, account pills), just phone-proportioned and
// shorter — and since this only ever renders below the lg breakpoint (see
// page.tsx's lg:hidden), the real drawer's own responsive width (full
// width below sm, 420px between sm/lg) always lands at a genuinely
// mobile-appropriate size here, not a desktop-scale popup.
export default async function MobileAppShellShowcase() {
  const tCommon = await getTranslations("common");
  const tDash = await getTranslations("dashboard");
  const locale = (await getLocale()) as Locale;
  const facts = buildDemoTodayFacts(false);
  const scenario = buildDemoScenario();
  const after = buildDemoAfter();
  const upcoming = facts.upcoming.slice(0, 5);

  return (
    <div className="max-w-[300px] mx-auto w-full bg-[#112232] border border-[#25405A] rounded-2xl shadow-[0_16px_36px_-20px_rgba(13,27,43,0.4)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D1B2B] border-b border-[#1E3446]">
        <span className="font-bold text-[#E8F0F8] text-sm">Nonodia</span>
        <span className="w-5 h-5 rounded-full bg-[#3AB5A0] text-[#0D1B2B] text-[10px] font-bold flex items-center justify-center">S</span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 flex-wrap mb-3.5">
          <span className="px-2 py-0.5 rounded-full bg-[#1E3446] text-[#7BA8C4] text-[10px] font-medium">
            {tDash("accountFilter.allAccounts")}
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1E3446] text-[#E8F0F8] ring-1 ring-[#3AB5A0] text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CC4A4]" />
            Business (manual)
          </span>
        </div>

        <p className="text-[11px] text-[#94A3B8] mb-0.5">{tDash("welcomeBack", { name: "Sophie" })}</p>
        <p className="text-base font-bold text-[#E8F0F8] leading-tight mb-3.5">{tCommon("nav.dashboard")}</p>

        <TodayStatsGrid facts={facts} locale={locale} />

        <div className="mt-3">
          <UpcomingList
            upcoming={upcoming}
            demoAutoPlayTargetId={DEMO_PAYMENT_ID}
            demoScenario={scenario}
            demoAfter={after}
          />
        </div>
      </div>
    </div>
  );
}
