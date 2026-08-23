import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { TodayFacts } from "@/lib/today-facts";
import type { CashRunway } from "@/lib/data-maturity";
import UpcomingList from "./UpcomingList";
import RecentTransactions from "./RecentTransactions";

// The Personal Dashboard answers a completely different set of questions
// than the Business one — not "is my business healthy," but "what do I
// personally have, what have I spent, what do I still need this month, and
// how long will it last me." No Business Health, Tax Reserve, Cashflow
// Risk, or client concentration here — those are business concepts that
// don't apply to a freelancer's personal money. Same visual language as the
// Business dashboard (card-sm grid, label/value pattern) but a genuinely
// different set of cards computed from personal-scoped data — never the
// Business figures relabeled.
export default async function PersonalDashboard({
  facts,
  runway,
  personalSpendingEstimate,
  recentTransactions,
  locale,
}: {
  facts: TodayFacts;
  runway: CashRunway;
  personalSpendingEstimate: number | null;
  recentTransactions: Parameters<typeof RecentTransactions>[0]["transactions"];
  locale: Locale;
}) {
  const t = await getTranslations("manual.personalDashboard");
  const tToday = await getTranslations("manual.today");
  const tCat = await getTranslations("categories");
  const fmt = (n: number) => formatCurrency(n, locale);

  const remaining = personalSpendingEstimate != null ? personalSpendingEstimate - facts.moneyOutThisMonth : null;
  const exceeded = remaining != null && remaining < 0;
  const topSpending = facts.spendingByCategoryThisMonth.slice(0, 5);
  const upcoming = facts.upcoming.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Personal Current Cash — never the Business figure. Only grows via a
          recorded "Pay yourself" transfer or genuinely personal income,
          never by receiving client money directly (spec: a client payment
          belongs to Business, even after it's received). */}
      <div className="card-sm">
        <p className="label mb-2">{t("currentCash")}</p>
        <p className="text-2xl font-bold text-[#E8F0F8] tabular-nums">{fmt(facts.currentCash)}</p>
        <p className="text-[11px] text-[#6A97B4] mt-1">{t("currentCashNote")}</p>
      </div>

      {/* Personal spending this month — available (received), spent, remaining */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-sm">
          <p className="label mb-2">{t("received")}</p>
          <p className="text-lg font-bold text-[#4CC4A4] tabular-nums">{fmt(facts.moneyInThisMonth)}</p>
        </div>
        <div className="card-sm">
          <p className="label mb-2">{t("spent")}</p>
          <p className="text-lg font-bold text-[#D4A254] tabular-nums">{fmt(facts.moneyOutThisMonth)}</p>
        </div>
        <div className="card-sm">
          <p className="label mb-2">{t("remaining")}</p>
          <p className="text-lg font-bold text-[#E8F0F8] tabular-nums">{fmt(facts.moneyInThisMonth - facts.moneyOutThisMonth)}</p>
        </div>
      </div>

      {/* Personal monthly need — the exact figure asked at onboarding
          ("How much do you normally need each month for living expenses?")
          finally put to use: spent so far vs. that usual need. */}
      {personalSpendingEstimate != null && (
        <div className="card-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="label">{t("monthlyNeed")}</p>
            <span className="text-[11px] text-[#6A97B4]">{t("monthlyNeedValue", { amount: fmt(personalSpendingEstimate) })}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-[#A8C6E0]">{t("spentSoFar")}</span>
            <span className={`font-semibold tabular-nums ${exceeded ? "text-[#E5484D]" : "text-[#E8F0F8]"}`}>{fmt(facts.moneyOutThisMonth)}</span>
          </div>
          <p className={`text-[11px] ${exceeded ? "text-[#E5484D]" : "text-[#6A97B4]"}`}>
            {exceeded ? t("overNeed", { amount: fmt(Math.abs(remaining!)) }) : t("remainingAgainstNeed", { amount: fmt(remaining!) })}
          </p>
        </div>
      )}

      {/* Personal Runway — deliberately labeled distinctly from Business
          Runway (Forecast page), even though it's the same kind of
          calculation, so the two are never mistaken for one another. */}
      {runway.months !== null && (
        <div className="card-sm">
          <p className="label mb-2">{t("personalRunway")}</p>
          {/* A negative months figure ("-0.8 months") is meaningless — your
              personal cash is already short of what your monthly need
              implies (e.g. real recurring commitments recorded before any
              income or "pay yourself" transfer has landed) — say that
              plainly instead of printing a negative decimal. */}
          {runway.months < 0 ? (
            <p className="text-lg font-bold text-[#E5484D] tabular-nums mb-1">{t("runwayAlreadyBehind")}</p>
          ) : (
            <p className="text-xl font-bold text-[#E8F0F8] tabular-nums mb-1">{t("runwayMonths", { count: Math.round(runway.months * 10) / 10 })}</p>
          )}
          <p className="text-[11px] text-[#6A97B4]">
            {runway.source === "estimated" ? t("runwayEstimatedCaption", { amount: fmt(runway.monthlySpend) }) : t("runwayCalculatedCaption", { months: runway.basedOnMonths })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal upcoming — recurring personal commitments only, never
            expected client payments (those belong to Business). */}
        <UpcomingList upcoming={upcoming} />

        {/* Personal spending categories */}
        <div className="card-sm">
          <div className="flex items-baseline justify-between mb-3">
            <p className="label">{t("categories")}</p>
            <p className="text-[11px] text-[#6A97B4]">{tToday("spendingSoFar")}</p>
          </div>
          {topSpending.length === 0 ? (
            <p className="text-sm text-[#6A97B4]">{tToday("spendingEmpty")}</p>
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

      {/* Personal Activity — same RecentTransactions component the Business
          view uses, just fed personal-account-scoped data (spec: "Same
          Activity component/design, different filtered data"). */}
      <div>
        <p className="label mb-3">{t("activity")}</p>
        <RecentTransactions transactions={recentTransactions} />
        <Link href="/history" className="block text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4] mt-3">
          {tToday("viewAllActivity")}
        </Link>
      </div>
    </div>
  );
}
