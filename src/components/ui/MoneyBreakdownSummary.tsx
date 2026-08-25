"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { MoneyBreakdown } from "@/lib/money-breakdown";

// The compact "what does this money mean" result Money Received and the
// Expected Payment "if it arrives" scenario both show (spec sections 3, 27)
// — reuses the dashboard.moneyBreakdown translation namespace so the copy
// can never drift between the card and this summary, and renders exactly
// the fields getMoneyBreakdown() computed server-side. No calculation here.
export default function MoneyBreakdownSummary({ breakdown }: { breakdown: MoneyBreakdown }) {
  const t = useTranslations("dashboard.moneyBreakdown");
  const locale = useLocale() as Locale;
  const fmt = (n: number) => formatCurrency(n, locale);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6A97B4]">{t("protected")}</span>
        <span className="font-semibold text-[#7BB8E8] tabular-nums">{fmt(breakdown.protectedTotal)}</span>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{breakdown.safeToUse !== null ? t("safeToUse") : t("availableAfterProtections")}</span>
          <span className="font-semibold text-[#E8F0F8] tabular-nums">{fmt(breakdown.safeToUse ?? breakdown.availableAfterProtections)}</span>
        </div>
        {/* No methodology was stated anywhere on this screen before — a user
            stopping here right after logging income would see this figure
            with zero indication of what it's built from. */}
        <p className="text-[11px] text-[#6A97B4] mt-0.5">{t("availableExplainer")}</p>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("runway")}</span>
          <span className="font-semibold text-[#E8F0F8] tabular-nums">
            {breakdown.runway.months === null
              ? t("runwayUnknown")
              : breakdown.runway.months < 0
                ? t("runwayAlreadyBehind")
                : t("runwayMonths", {
                    // A rough onboarding guess doesn't earn a tenth-of-a-month
                    // of precision — only round to a decimal once it's backed
                    // by real observed spending.
                    months: breakdown.runway.source === "estimated"
                      ? Math.round(breakdown.runway.months)
                      : Math.round(breakdown.runway.months * 10) / 10,
                  })}
          </span>
        </div>
        {/* This same CashRunway object is shown with its source label intact
            everywhere else (Forecast page, Personal Dashboard) — this was the
            one place it got silently stripped, right after the emotionally
            significant moment of logging income. */}
        {breakdown.runway.months !== null && breakdown.runway.months >= 0 && (
          <p className="text-[11px] text-[#6A97B4] mt-0.5">
            {breakdown.runway.source === "estimated"
              ? t("runwayEstimatedNote", { amount: fmt(breakdown.runway.monthlySpend) })
              : t("runwayCalculatedNote", { months: breakdown.runway.basedOnMonths })}
          </p>
        )}
      </div>
    </div>
  );
}
