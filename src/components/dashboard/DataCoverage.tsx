import { getTranslations } from "next-intl/server";
import type { DataCoverage } from "@/lib/analytics-engine";

interface Props {
  coverage: DataCoverage;
  lastImportedAt?: Date | null;
}

export default async function DataCoverage({ coverage, lastImportedAt }: Props) {
  if (coverage.count === 0) return null;

  const t = await getTranslations("dashboard.dataCoverage");

  const daysSinceImport = lastImportedAt
    ? Math.floor((Date.now() - new Date(lastImportedAt).getTime()) / 86_400_000)
    : null;

  let span: string;
  if (coverage.years >= 1) {
    const remainder = coverage.months - coverage.years * 12;
    span = remainder >= 1
      ? t("yearsAndMonths", { years: coverage.years, months: remainder })
      : t("years", { count: coverage.years });
  } else {
    span = t("months", { count: coverage.months });
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-[#4CC4A412] border border-[#4CC4A428] rounded-xl">
      <div className="w-5 h-5 rounded-full bg-[#4CC4A4] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-0.5 sm:gap-x-4 min-w-0">
        <span className="text-sm font-semibold text-[#4CC4A4]">
          {t("summary", { span, count: coverage.count })}
        </span>
        {coverage.rangeLabel && (
          <span className="text-xs text-[#6A97B4]">{t("analysisRange", { range: coverage.rangeLabel })}</span>
        )}
        {daysSinceImport !== null && (
          <span className="text-xs text-[#6A97B4]/75">
            {daysSinceImport === 0
              ? t("lastUpdatedToday")
              : t("lastUpdated", { days: daysSinceImport })}
          </span>
        )}
      </div>
    </div>
  );
}
