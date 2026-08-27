import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { formatCurrency } from "@/utils/finance";
import InsightText from "@/components/ui/InsightText";

// Section 3.5's product preview — a flat floating panel (no laptop photo)
// showing the real Forecast page next to the real +Add menu, open, exactly
// like the reference screenshot's composition. Every number on the left is
// a frozen real snapshot from the live account's own Forecast page (not
// computed here, not invented — copied verbatim, the same "real snapshot"
// convention src/lib/landing-demo-data.ts's header comment already
// establishes for the Dashboard preview above this one), because
// reproducing Forecast's Business Health/Cashflow Risk/Business Direction
// signals live would mean re-deriving several gated analytics engines just
// for a static marketing preview — a real but frozen number is honest here;
// a guessed one would not be. The +Add menu list reuses QuickAddDrawer's own
// real copy (manual.quickAdd.menu.*), same reasoning as the nav bar below:
// presentational chrome, real labels, not the live stateful drawer (which
// calls an authenticated API an anonymous visitor can't reach).
const MENU_ITEMS = [
  { key: "income", icon: "↓", color: "text-[#4CC4A4]" },
  { key: "expense", icon: "↑", color: "text-[#D4A254]" },
  { key: "expectedPayment", icon: "◷", color: "text-[#7BB8E8]" },
  { key: "recurringExpense", icon: "↻", color: "text-[#A78BFA]" },
  { key: "payMyself", icon: "⇄", color: "text-[#4CC4A4]" },
] as const;

// Real snapshot, captured from the live Forecast page (Business account,
// August 2026) — see the file-level comment above.
const SNAPSHOT = {
  upcoming: [
    { day: 30 as const, net: 1979.01, expected: 2000, committed: 20.99 },
    { day: 60 as const, net: 1958.02, expected: 2000, committed: 41.98 },
    { day: 90 as const, net: 1937.03, expected: 2000, committed: 62.97 },
  ],
  positiveMonths: 20,
  totalMonths: 20,
};

export default async function ProductPanelShowcase() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("manual.quickAdd");
  const tNav = await getTranslations("common");
  const tFilter = await getTranslations("dashboard.accountFilter");
  const tForecast = await getTranslations("forecast");
  const tHealth = await getTranslations("dashboard.health");
  const tLanding = await getTranslations("landing.productShowcase");
  const fmt = (n: number) => formatCurrency(n, locale);

  // Scale-to-fit shell: the panel below is a fixed 860×623px design — the
  // exact same layout at every screen size, never a reflowed/simplified
  // mobile version. The outer box is sized per breakpoint to match that
  // design's aspect ratio (860:623) at the panel's actual on-screen size;
  // the inner box stays fixed at 860px wide and is scaled down to fit,
  // origin top-left, so it shrinks uniformly instead of overflowing or
  // wrapping differently. The lg value (0.9) is the exact scale already
  // tuned by hand for desktop — untouched; only the breakpoints below it
  // are new, each picked from the real available width at that breakpoint
  // (CONTAINER's own padding) so nothing clips on real phone widths.
  return (
    <div className="w-[318px] sm:w-[559px] md:w-[688px] lg:w-[774px] aspect-[860/623] overflow-hidden mx-auto lg:mx-0">
      <div className="w-[860px] origin-top-left scale-[0.37] sm:scale-[0.65] md:scale-[0.8] lg:scale-90 bg-[#112232] border border-[#25405A] rounded-2xl shadow-[0_24px_60px_-24px_rgba(13,27,43,0.28)] overflow-hidden">
      {/* Nav + account pills — same real labels as the real app's own top
          bar (purely presentational: no real links, so it can never route
          an anonymous visitor into an authenticated-only page). */}
      <div className="px-5 pt-3.5 pb-3 border-b border-[#1E3446]">
        <div className="flex items-center justify-between gap-y-2 mb-3">
          <div className="flex items-center gap-4">
            <span className="font-bold text-[#E8F0F8] text-sm">Nonodia</span>
            <div className="flex items-center gap-3.5 text-xs font-medium">
              <span className="text-[#7BA8C4]">{tNav("nav.dashboard")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.upload")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.history")}</span>
              <span className="text-[#7BA8C4]">{tNav("nav.analytics")}</span>
              <span className="text-[#3AB5A0]">{tNav("nav.forecast")}</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#3AB5A0] border border-[#3AB5A0] rounded-lg px-2 py-1">
            + {t("button")}
          </span>
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

      {/* Always side-by-side, at a fixed internal width — this panel never
          reflows into a different (stacked/simplified) layout at any screen
          size. Small screens instead get the exact same layout scaled down
          to fit (see the wrapper in the default export below), so a phone
          and a desktop show the identical structure, just at a different
          size — not a different arrangement. */}
      <div className="flex flex-row">
        {/* Real Forecast page content, frozen snapshot (see SNAPSHOT above). */}
        <div className="flex-1 min-w-0 p-5 space-y-4">
          <div>
            <p className="text-base font-bold text-[#E8F0F8] leading-tight">{tForecast("title")}</p>
            <p className="text-[13px] font-medium text-[#4CC4A4] mt-0.5">{tForecast("subtitle.answerLow")}</p>
          </div>

          {/* Upcoming cash 30/60/90 */}
          <div className="card-sm">
            <p className="label mb-1">{tForecast("upcomingCashWindow.label")}</p>
            <p className="text-[11px] text-[#6A97B4] mb-4">{tForecast("upcomingCashWindow.scope")}</p>
            <div className="grid grid-cols-3 gap-3">
              {SNAPSHOT.upcoming.map((b) => (
                <div key={b.day}>
                  <p className="text-[11px] text-[#6A97B4] mb-1">{tForecast(`upcomingCashWindow.day${b.day}`)}</p>
                  <p className="text-base font-bold text-[#E8F0F8] tabular-nums mb-0.5">{fmt(b.net)}</p>
                  <p className="text-[10px] text-[#4CC4A4] tabular-nums">
                    {tForecast("upcomingCashWindow.expectedIncome", { amount: fmt(b.expected) })}
                  </p>
                  <p className="text-[10px] text-[#D4A254] tabular-nums">
                    {tForecast("upcomingCashWindow.committedExpenses", { amount: fmt(b.committed) })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Business Health / Cashflow Risk / Business Direction */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card-sm">
              <p className="label mb-1">{tForecast("healthScore.label")}</p>
              <p className="text-[10px] text-[#6A97B4] mb-2">{tForecast("healthScore.caption")}</p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg inline-block mb-2 bg-[#4CC4A40A] text-[#4CC4A4]">
                {tHealth("healthy")}
              </span>
              <p className="text-[11px] leading-relaxed text-[#4CC4A4]">
                <InsightText insight={{ key: "insights.health.healthyStable", values: { posMo: SNAPSHOT.positiveMonths, totalMo: SNAPSHOT.totalMonths } }} />
              </p>
            </div>

            <div className="card-sm bg-[#4CC4A40A] border-[#4CC4A425]">
              <p className="label mb-2">{tForecast("cashflowRiskLabel")}</p>
              <p className="text-lg font-bold mb-1 text-[#4CC4A4]">{tForecast("cashflowRisk.low.label")}</p>
              <p className="text-[11px] text-[#7BA8C4] leading-relaxed">{tForecast("cashflowRisk.low.desc")}</p>
              <p className="text-[10px] text-[#6A97B4] mt-1.5">
                {tForecast("monthsPositive", { positive: SNAPSHOT.positiveMonths, total: SNAPSHOT.totalMonths })}
              </p>
            </div>

            <div className="card-sm">
              <p className="label mb-2">{tForecast("businessDirection")}</p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg inline-block mb-2 bg-[#4CC4A415] text-[#4CC4A4]">
                {tForecast("trend.improving")}
              </span>
              <p className="text-[11px] text-[#7BA8C4] leading-relaxed">
                {tLanding("businessDirectionSnapshot", {
                  months: SNAPSHOT.totalMonths,
                  range: "Jan 2025 – Aug 2026",
                  pct: 46,
                  from: fmt(6794.25),
                  to: fmt(9953.35),
                })}
              </p>
            </div>
          </div>
        </div>

        {/* +Add menu, shown open — same real option list as
            QuickAddDrawer.tsx, same order, same icons/colors. */}
        <div className="w-[240px] flex-shrink-0 border-l border-[#1E3446] bg-[#0D2137] p-5">
          <p className="text-sm font-bold text-[#E8F0F8] mb-3.5">{t("menu.title")}</p>
          <div className="space-y-2">
            {MENU_ITEMS.map((opt) => (
              <div
                key={opt.key}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[#25405A] bg-[#112232]"
              >
                <span className={`text-base font-bold ${opt.color}`}>{opt.icon}</span>
                <span className="text-[12px] font-semibold text-[#E8F0F8] leading-tight">{t(`menu.${opt.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
