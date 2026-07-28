import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { RunwaySummary } from "@/lib/runway-engine";

function coverageColor(months: number): string {
  if (months < 1) return "text-[#C0392B]";
  if (months < 3) return "text-[#A66A0A]";
  return "text-[#1F8A73]";
}

// "How long do I survive," not "how much will I make." Lives on the Projects
// page (moved from the Dashboard, which is now strictly the two-layer "state
// of my business" view — see project_layered_ia memory) since runway is
// computed straight from the project/milestone pipeline. Callers only render
// this once the user has at least one project — data is always present.
export default async function RunwayCard({ data, locale }: { data: RunwaySummary; locale: Locale }) {
  const t = await getTranslations("dashboard.runwayCard");

  return (
    <div className="card-light">
      <p className="label-light mb-3">{t("label")}</p>

      {data.pipelineCount === 0 ? (
        <>
          <p className="text-lg font-bold text-[#42586B] mb-1">{t("noPipeline")}</p>
          <p className="text-sm text-[#5B7185] leading-relaxed">{t("noPipelineBody")}</p>
        </>
      ) : data.coverageMonths == null ? (
        <>
          <p className="text-lg font-bold text-[#42586B] mb-1">{formatCurrency(data.netPipelineValue, locale)}</p>
          <p className="text-sm text-[#5B7185] leading-relaxed">{t("notEnoughHistory")}</p>
        </>
      ) : (
        <>
          <p className={`text-4xl font-bold tabular-nums mb-1 ${coverageColor(data.coverageMonths)}`}>
            {t("months", { count: Math.max(0, Math.floor(data.coverageMonths)) })}
          </p>
          <p className="text-sm text-[#5B7185] leading-relaxed">
            {t("body", {
              net: formatCurrency(data.netPipelineValue, locale),
              count: data.pipelineCount,
              burn: formatCurrency(data.avgMonthlyBurn, locale),
            })}
          </p>
          <p className="text-xs text-[#8A9BAC] mt-2">
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
