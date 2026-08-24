import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import TodayLayer from "@/components/dashboard/TodayLayer";
import MoneyBreakdownCard from "@/components/dashboard/MoneyBreakdownCard";
import DashboardShowcase from "./DashboardShowcase";
import {
  DEMO_PAYMENT_ID, buildDemoTodayFacts, buildDemoScenario, buildDemoAfter, buildDemoMoneyBreakdown,
} from "@/lib/landing-demo-data";

// The hero's product preview — genuinely the real Dashboard components
// (TodayLayer, MoneyBreakdownCard, and via TodayLayer -> UpcomingList, the
// real ExpectedPaymentDrawer), not a redrawn mockup. Fed the real
// screenshotted Camille Farm demo data (src/lib/landing-demo-data.ts),
// framed in a polished app-shell (DashboardShowcase). The interaction is
// genuinely live: the "Coming up" row really opens the real drawer
// component (auto-triggered on a loop while in view, and also clickable by
// a visitor at any time), and "Mark as received" runs the real component's
// own confirm flow — only the actual network mutation is swapped for a
// simulated result (src/lib/landing-demo-data.ts's real, honestly-computed
// reserve figures), since an anonymous visitor's demo click must never
// attempt to write to a real account.
export default async function ProductDemoReel() {
  const locale = (await getLocale()) as Locale;

  const scenario = buildDemoScenario();
  const after = buildDemoAfter();

  return (
    <div>
      <DashboardShowcase
        before={
          <TodayLayer
            facts={buildDemoTodayFacts(false)}
            locale={locale}
            demoAutoPlayTargetId={DEMO_PAYMENT_ID}
            demoScenario={scenario}
            demoAfter={after}
          />
        }
        after={<TodayLayer facts={buildDemoTodayFacts(true)} locale={locale} />}
        moneyBefore={<MoneyBreakdownCard breakdown={buildDemoMoneyBreakdown(false)} locale={locale} />}
        moneyAfter={<MoneyBreakdownCard breakdown={buildDemoMoneyBreakdown(true)} locale={locale} />}
      />
    </div>
  );
}
