"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { ReserveForPayment } from "@/lib/reserve-engine";

// "Money received must never be confirmed silently" — the same one
// calculation everywhere else (never a second one): the flat generic
// estimate for most countries, or the fully itemized French micro-
// entrepreneur breakdown (social contributions / CFP / versement libératoire
// / VAT collected) when that engine applies. Shared by Quick Add's income
// reward, the Expected Payment detail/received views, and Forecast's
// scenario — one component renders every one of them.
export default function ReserveBreakdown({ reserve }: { reserve: ReserveForPayment }) {
  const t = useTranslations("manual.reserve");
  const tCard = useTranslations("dashboard.financialReserveCard");
  const locale = useLocale() as Locale;
  const fmt = (n: number) => formatCurrency(n, locale);

  if (reserve.engine === "generic") {
    const { result } = reserve;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("setAside", { pct: result.pct })}</span>
          <span className="font-semibold text-[#D4A254] tabular-nums">{fmt(result.reserveAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("netForYou")}</span>
          <span className="font-semibold text-[#4CC4A4] tabular-nums">{fmt(result.netAmount)}</span>
        </div>
        {result.isEstimate && (
          <p className="text-xs text-[#6A97B4] leading-relaxed">{tCard("estimatedDisclaimer")}</p>
        )}
      </div>
    );
  }

  // engine === "france" — the itemized breakdown (Tax & Contributions spec
  // sections 22-25, 34): "I received X, but approximately Y should not be
  // treated as freely available," with every line explainable.
  const r = reserve.result;
  const incomeTaxReasonKey =
    r.incomeTaxExcludedReason === "vfl-unknown" ? "incomeTaxVflUnknown" :
    r.incomeTaxExcludedReason === "vfl-not-set" ? "incomeTaxVflNotSet" :
    "incomeTaxNotIncluded";
  return (
    <div className="space-y-2">
      {r.vat && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("vatCollected", { pct: r.vat.rate })}</span>
          <span className="font-semibold text-[#D4A254] tabular-nums">{fmt(r.vat.amount)}</span>
        </div>
      )}
      {/* VAT wasn't dropped because it doesn't apply — it's missing because
          no rate has been set yet, and that must never look identical to
          "not VAT-registered" (spec section 27's "one shared source of
          truth" — Settings' reserve card already says this, the per-payment
          view must too). */}
      {r.vatRegisteredRateMissing && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("vat")}</span>
          <span className="text-xs text-[#D4A254]">{t("vatRateMissing")}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6A97B4]">{t("socialContributions", { pct: Math.round(r.socialContribution!.rate * 1000) / 10 })}</span>
        <span className="font-semibold text-[#D4A254] tabular-nums">{fmt(r.socialContribution!.amount)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6A97B4]">{t("cfp", { pct: Math.round(r.cfp!.rate * 1000) / 10 })}</span>
        <span className="font-semibold text-[#D4A254] tabular-nums">{fmt(r.cfp!.amount)}</span>
      </div>
      {r.vfl!.included ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("vfl", { pct: Math.round(r.vfl!.rate * 1000) / 10 })}</span>
          <span className="font-semibold text-[#D4A254] tabular-nums">{fmt(r.vfl!.amount)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6A97B4]">{t("incomeTax")}</span>
          <span className="text-xs text-[#6A97B4]">{t(incomeTaxReasonKey)}</span>
        </div>
      )}
      {r.acreApplied && (
        <p className="text-xs text-[#4CC4A4]">{t("acreApplied")}</p>
      )}
      <div className="flex items-center justify-between text-sm pt-2 border-t border-[#1E3446]">
        <span className="text-[#A8C6E0] font-medium">{t("keepProtected")}</span>
        <span className="font-semibold text-[#D4A254] tabular-nums">{fmt(r.knownMandatoryReserve)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6A97B4]">{t("netForYou")}</span>
        <span className="font-semibold text-[#4CC4A4] tabular-nums">{fmt(r.afterKnownStatutoryReserves)}</span>
      </div>
    </div>
  );
}
