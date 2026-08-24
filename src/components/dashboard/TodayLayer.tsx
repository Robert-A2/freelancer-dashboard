import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { TodayFacts } from "@/lib/today-facts";
import type { ReserveForPayment } from "@/lib/reserve-engine";
import type { MoneyBreakdown, MoneyBreakdownProjection } from "@/lib/money-breakdown";
import TodayStatsGrid from "./TodayStatsGrid";
import UpcomingList from "./UpcomingList";

// Nonodia's factual "Today" layer (spec section 10) — works on Day 1 from a
// single cash checkpoint, no transaction history required. Sits ABOVE the
// existing Business Health / Cashflow Position / Forecast Health layer on
// the SAME dashboard page; not a second dashboard, not a new analytics
// engine — every figure here comes from getTodayFacts(), which itself just
// reads the same Transaction/RecurringExpense/ExpectedPayment tables the
// rest of the app already reads.
export default async function TodayLayer({
  facts,
  locale,
  demoAutoPlayTargetId,
  demoScenario,
  demoAfter,
}: {
  facts: TodayFacts;
  locale: Locale;
  /** Landing-page product showcase only — forwarded to UpcomingList
   * unchanged (src/lib/landing-demo-data.ts). Undefined for every real
   * dashboard usage. */
  demoAutoPlayTargetId?: string;
  demoScenario?: { reserve: ReserveForPayment; current: MoneyBreakdown; scenario: MoneyBreakdownProjection };
  demoAfter?: { currentCash: number; moneyInThisMonth: number };
}) {
  const t = await getTranslations("manual.today");
  const tCat = await getTranslations("categories");
  const fmt = (n: number) => formatCurrency(n, locale);

  const topSpending = facts.spendingByCategoryThisMonth.slice(0, 5);
  const upcoming = facts.upcoming.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Current position + this month, at a glance */}
      <TodayStatsGrid facts={facts} locale={locale} />

      {facts.reserved !== null && (
        <div className="card-sm inline-block">
          <p className="label mb-1">{t("reserved")}</p>
          <p className="text-lg font-bold text-[#7BB8E8] tabular-nums">{fmt(facts.reserved)}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Coming up */}
        <UpcomingList
          upcoming={upcoming}
          demoAutoPlayTargetId={demoAutoPlayTargetId}
          demoScenario={demoScenario}
          demoAfter={demoAfter}
        />

        {/* Spending this month */}
        <div className="card-sm">
          <div className="flex items-baseline justify-between mb-3">
            <p className="label">{t("spendingThisMonth")}</p>
            <p className="text-[11px] text-[#6A97B4]">{t("spendingSoFar")}</p>
          </div>
          {topSpending.length === 0 ? (
            <p className="text-sm text-[#6A97B4]">{t("spendingEmpty")}</p>
          ) : (
            <ul className="space-y-2.5">
              {topSpending.map((c) => (
                <li key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-[#A8C6E0] capitalize">{tCat.has(c.category) ? tCat(c.category) : c.category}</span>
                  <span className="font-medium text-[#E8F0F8] tabular-nums">{fmt(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
