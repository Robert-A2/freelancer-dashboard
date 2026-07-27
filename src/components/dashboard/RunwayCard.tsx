import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { RunwaySummary } from "@/lib/runway-engine";

function coverageColor(months: number): string {
  if (months < 1) return "text-[#E5484D]";
  if (months < 3) return "text-[#D4A254]";
  return "text-[#4CC4A4]";
}

// The dashboard's hero number — "how long do I survive," not "how much will
// I make." Callers only render this once the user has at least one project
// (see ProjectsPromoCard for the "no projects yet" state) — data is always present.
export default async function RunwayCard({ data, locale }: { data: RunwaySummary; locale: Locale }) {
  const t = await getTranslations("dashboard.runwayCard");

  return (
    <div className="card">
      <p className="label mb-3">{t("label")}</p>

      {data.pipelineCount === 0 ? (
        <>
          <p className="text-lg font-bold text-[#A8C6E0] mb-1">{t("noPipeline")}</p>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">{t("noPipelineBody")}</p>
        </>
      ) : data.coverageMonths == null ? (
        <>
          <p className="text-lg font-bold text-[#A8C6E0] mb-1">{formatCurrency(data.netPipelineValue, locale)}</p>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">{t("notEnoughHistory")}</p>
        </>
      ) : (
        <>
          <p className={`text-4xl font-bold tabular-nums mb-1 ${coverageColor(data.coverageMonths)}`}>
            {t("months", { count: Math.max(0, Math.floor(data.coverageMonths)) })}
          </p>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">
            {t("body", {
              net: formatCurrency(data.netPipelineValue, locale),
              count: data.pipelineCount,
              burn: formatCurrency(data.avgMonthlyBurn, locale),
            })}
          </p>
          <p className="text-xs text-[#6A97B4] mt-2">
            {t("taxNote", {
              gross: formatCurrency(data.grossPipelineValue, locale),
              pct: Math.round(data.taxReservePct),
            })}
          </p>
        </>
      )}
    </div>
  );
}
