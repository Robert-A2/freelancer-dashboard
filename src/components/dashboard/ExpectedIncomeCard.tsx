import { getTranslations } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { ExpectedIncomeSummary } from "@/lib/milestone-engine";
import Link from "next/link";

export default async function ExpectedIncomeCard({ data, locale, basePath = "" }: { data: ExpectedIncomeSummary; locale: Locale; basePath?: string }) {
  const t = await getTranslations("dashboard.expectedIncome");
  const isDemo = basePath !== "";

  if (data.expectedCount === 0) {
    return (
      <div className="flex items-start gap-4 px-5 py-4 bg-[#1E3446] border border-[#2D4C68] rounded-2xl">
        <span className="text-[#3AB5A0] text-xl flex-shrink-0 mt-0.5">🤝</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#A8C6E0] mb-1">{t("emptyState.title")}</p>
          <p className="text-sm text-[#6A97B4] leading-relaxed">{t("emptyState.body")}</p>
          <Link href={isDemo ? "/signup" : "/projects"} className="inline-block mt-2 text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
            {isDemo ? t("emptyState.ctaDemo") : t("emptyState.cta")} →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 mb-1">
        <p className="label">{t("thisMonth")}</p>
        <Link href={isDemo ? "/signup" : "/projects"} className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors flex-shrink-0">
          {t("viewAll")} →
        </Link>
      </div>
      <p className="text-2xl font-bold text-[#D4A254] tabular-nums mb-1">{formatCurrency(data.expectedThisMonthNet, locale)}</p>
      <p className="text-xs text-[#A8C6E0] font-medium mb-1">
        {t("taxNote", { gross: formatCurrency(data.expectedThisMonth, locale), pct: Math.round(data.taxReservePct) })}
      </p>
      <p className="text-xs text-[#6A97B4] mb-3">{t("fromMilestones", { count: data.expectedCount })}</p>

      {data.overdueCount > 0 && (
        <p className="text-xs text-[#E5484D] mb-3">
          {t("overdueNote", { count: data.overdueCount, amount: formatCurrency(data.overdueAmount, locale) })}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="label">{t("beforeTax")}</p>
        {data.expectedCount > 3 && (
          <p className="text-[11px] text-[#6A97B4] flex-shrink-0">{t("showingOf", { shown: 3, total: data.expectedCount })}</p>
        )}
      </div>

      <div className="space-y-2">
        {data.upcoming.slice(0, 3).map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 bg-[#1E3446] rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-[#C8DCF0] truncate font-medium">{m.clientName}</p>
              <p className="text-xs text-[#6A97B4] truncate">{m.label}</p>
            </div>
            <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${m.isOverdue ? "text-[#E5484D]" : "text-[#E8F0F8]"}`}>
              {formatCurrency(m.amount, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
