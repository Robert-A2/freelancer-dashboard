import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { TodayFacts } from "@/lib/today-facts";

// The "at a glance" stat row from the top of the Today layer, split out into
// its own component so it can be reused exactly as-is anywhere a compact
// glance at the same real numbers is needed — currently: TodayLayer itself,
// and the landing page's mobile app-shell showcase (which shows a curated,
// shorter slice of the real dashboard rather than the whole page). Same
// component, same markup, same real getTodayFacts() data either place.
export default async function TodayStatsGrid({ facts, locale }: { facts: TodayFacts; locale: Locale }) {
  const t = await getTranslations("manual.today");
  const fmt = (n: number) => formatCurrency(n, locale);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card-sm">
        <p className="label mb-2">{t("currentCash")}</p>
        <p className="text-xl font-bold text-[#E8F0F8] tabular-nums">{fmt(facts.currentCash)}</p>
        {/* Same underlying figure and same caption as Forecast's "Cash
            position" — kept word-for-word identical so the two labels for
            one number don't drift into disagreement. */}
        <p className="text-[10px] text-[#6A97B4] mt-1">{t("currentCashCaption")}</p>
      </div>
      <div className="card-sm">
        <p className="label mb-2">{t("moneyIn")}</p>
        <p className="text-xl font-bold text-[#4CC4A4] tabular-nums">{fmt(facts.moneyInThisMonth)}</p>
      </div>
      <div className="card-sm">
        <p className="label mb-2">{t("moneyOut")}</p>
        <p className="text-xl font-bold text-[#D4A254] tabular-nums">{fmt(facts.moneyOutThisMonth)}</p>
      </div>
      <div className="card-sm">
        <p className="label mb-2">{t("knownCommitments")}</p>
        <p className="text-xl font-bold text-[#E8F0F8] tabular-nums">
          {fmt(facts.knownCommitmentsMonthly)} <span className="text-xs font-normal text-[#6A97B4]">{t("perMonth")}</span>
        </p>
      </div>
    </div>
  );
}
