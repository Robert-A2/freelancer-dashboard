import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { ReserveSummary } from "@/lib/reserve-engine";
import ReserveAdjustment from "@/components/dashboard/ReserveAdjustment";

// Lives on Settings, directly below FinancialProfileSection — this is the
// live result of that form, not a standalone dashboard widget, so there's no
// separate "complete your profile" link here; the form is right above it.
export default async function FinancialReserveCard({ data, locale }: { data: ReserveSummary; locale: Locale }) {
  const t = await getTranslations("dashboard.financialReserveCard");

  const volatilityKey = `emergencyBuffer${data.emergencyBufferVolatility.charAt(0).toUpperCase()}${data.emergencyBufferVolatility.slice(1)}`;

  return (
    <div className="card">
      <p className="label mb-3">{t("label")}</p>

      {!data.isProfileComplete ? (
        <div className="mb-3">
          <p className="text-lg font-bold text-[#D4A254] mb-1">{t("estimatedHeading")}</p>
          <p className="text-xs text-[#6A97B4] leading-relaxed mb-2">
            {data.isManualOverride ? t("manualOverrideNote", { rate: data.estimatedReservePct }) : t("estimatedDisclaimer")}
          </p>
          <ReserveAdjustment currentPct={data.estimatedReservePct} />
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {data.buckets.map((bucket) => (
            <div key={bucket.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[#C8DCF0]">{t(`buckets.${bucket.key}`)}</p>
                {bucket.noteKey && <p className="text-xs text-[#6A97B4]">{t(`notes.${bucket.noteKey}`)}</p>}
              </div>
              <span className="text-sm font-semibold text-[#E8F0F8] tabular-nums flex-shrink-0">
                {bucket.pct != null ? `${bucket.pct}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 py-2.5 border-t border-[#1E3550]">
        <div className="min-w-0">
          <p className="text-sm text-[#C8DCF0]">{t("buckets.emergencyBuffer")}</p>
          <p className="text-xs text-[#6A97B4]">{t(`notes.${volatilityKey}`)}</p>
        </div>
        <span className="text-sm font-semibold text-[#E8F0F8] tabular-nums flex-shrink-0">{data.emergencyBufferPct}%</span>
      </div>

      <div className="pt-3 border-t border-[#1E3550]">
        <p className="text-xs text-[#6A97B4] mb-1">{t("availableToSpend")}</p>
        <p className="text-xl font-bold text-[#4CC4A4] tabular-nums">{formatCurrency(data.availableToSpendThisMonth, locale)}</p>
      </div>

      {!data.isProfileComplete && (
        <p className="mt-3 text-xs font-medium text-[#D4A254]">{t("completeProfile")}</p>
      )}

      <p className="text-[10px] text-[#4A7A9B] mt-3">{t("footer")}</p>
    </div>
  );
}
