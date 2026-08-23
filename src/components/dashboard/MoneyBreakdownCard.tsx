import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { MoneyBreakdown } from "@/lib/money-breakdown";

// Spec section 9's "one small 'Your money' breakdown" — headline numbers
// plus a <details> expansion for the line items, not a new accounting
// screen. Every figure here comes from getMoneyBreakdown(), the same engine
// the Money Received confirmation, Expected Payment detail, and Forecast's
// runway all read — this card cannot disagree with them because it isn't a
// second calculation of anything.
export default async function MoneyBreakdownCard({
  breakdown,
  locale,
}: {
  breakdown: MoneyBreakdown;
  locale: Locale;
}) {
  const t = await getTranslations("dashboard.moneyBreakdown");
  const tCard = await getTranslations("dashboard.financialReserveCard");
  const fmt = (n: number) => formatCurrency(n, locale);

  return (
    <div className="card-sm">
      <p className="label mb-2">{t("label")}</p>

      <div className="grid grid-cols-2 gap-4 mb-1">
        <div>
          <p className="text-[11px] text-[#6A97B4] mb-1">{t("protected")}</p>
          <p className="text-lg font-bold text-[#7BB8E8] tabular-nums">{fmt(breakdown.protectedTotal)}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#6A97B4] mb-1">
            {breakdown.safeToUse !== null ? t("safeToUse") : t("availableAfterProtections")}
          </p>
          <p className="text-lg font-bold text-[#E8F0F8] tabular-nums">
            {fmt(breakdown.safeToUse ?? breakdown.availableAfterProtections)}
          </p>
        </div>
      </div>

      {breakdown.availableAfterProtections < 0 && (
        <p className="text-[11px] text-[#E5484D] mt-1 mb-2">{t("overCommitted")}</p>
      )}

      {/* Spending pace vs. the onboarding estimate — shown regardless of
          whether Runway itself has switched to real data yet, so actual
          overspending is never silent during the first month (spec
          sections 13-18: "fix the silent contradiction"). */}
      {breakdown.spendingPace && (
        <div className="mt-3 pt-3 border-t border-[#25405A]">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-[#A8C6E0]">{t("spendingThisMonth")}</span>
            <span className={`font-medium tabular-nums ${breakdown.spendingPace.exceeded ? "text-[#E5484D]" : "text-[#E8F0F8]"}`}>
              {t("spendingOf", { actual: fmt(breakdown.spendingPace.actualThisMonth), estimate: fmt(breakdown.spendingPace.estimate) })}
            </span>
          </div>
          <p className={`text-[11px] ${breakdown.spendingPace.exceeded ? "text-[#E5484D]" : "text-[#6A97B4]"}`}>
            {breakdown.spendingPace.exceeded
              ? t("spendingExceeded", { overBy: fmt(-breakdown.spendingPace.remaining) })
              : t("spendingRemaining", { remaining: fmt(breakdown.spendingPace.remaining) })}
          </p>
        </div>
      )}

      {/* The one-time (well — one-month-long) callout for when Runway
          switches from the estimate to real observed spending (spec
          section 17: "do not silently switch"). */}
      {breakdown.firstMonthTransition && (
        <div className="mt-3 pt-3 border-t border-[#25405A]">
          <p className="text-xs font-semibold text-[#7BB8E8] mb-1">{t("firstMonthTransitionTitle")}</p>
          <p className="text-[11px] text-[#6A97B4] leading-relaxed">
            {t("firstMonthTransitionBody", {
              estimate: fmt(breakdown.firstMonthTransition.estimate),
              actual: fmt(breakdown.firstMonthTransition.actualFirstMonth),
              difference: fmt(Math.abs(breakdown.firstMonthTransition.difference)),
              direction: breakdown.firstMonthTransition.difference > 0 ? t("more") : t("less"),
            })}
          </p>
        </div>
      )}

      <details className="mt-2 group">
        <summary className="text-xs font-medium text-[#3AB5A0] cursor-pointer hover:text-[#4CC4A4] list-none">
          {t("seeBreakdown")}
        </summary>
        <div className="mt-3 space-y-2.5 pt-3 border-t border-[#25405A]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#A8C6E0]">
              {t("taxReserve")}
              {breakdown.taxReserve.rate !== null && (
                <span className="text-[#6A97B4]"> ({breakdown.taxReserve.rate}%)</span>
              )}
            </span>
            <span className="font-medium text-[#E8F0F8] tabular-nums">{fmt(breakdown.taxReserve.amount)}</span>
          </div>
          {breakdown.taxReserve.confidence === "estimated" && (
            <p className="text-[11px] text-[#6A97B4] -mt-1.5">{tCard("estimatedDisclaimer")}</p>
          )}
          {breakdown.taxReserve.source === "urssaf-outstanding" && (
            <p className="text-[11px] text-[#6A97B4] -mt-1.5">{t("urssafOutstandingNote")}</p>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#A8C6E0]">{t("commitments")}</span>
            <span className="font-medium text-[#E8F0F8] tabular-nums">{fmt(breakdown.recurringCommitmentsMonthly)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#A8C6E0]">{t("safetyBuffer")}</span>
            {breakdown.safetyBuffer.months !== null ? (
              <span className="font-medium text-[#E8F0F8] tabular-nums">{fmt(breakdown.safetyBuffer.amount)}</span>
            ) : (
              <Link href="/settings" className="text-xs font-medium text-[#3AB5A0] hover:text-[#4CC4A4]">
                {t("setBuffer")}
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between text-sm pt-2 border-t border-[#25405A]">
            <span className="text-[#A8C6E0] font-medium">{t("protectedTotal")}</span>
            <span className="font-semibold text-[#7BB8E8] tabular-nums">{fmt(breakdown.protectedTotal)}</span>
          </div>

          <p className="text-[11px] text-[#6A97B4] pt-1">{t("availableExplainer")}</p>
        </div>
      </details>
    </div>
  );
}
