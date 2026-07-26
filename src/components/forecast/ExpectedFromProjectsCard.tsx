import { getTranslations } from "next-intl/server";
import { formatCurrency, monthYearLabel } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { ExpectedIncomeSummary } from "@/lib/milestone-engine";

export default async function ExpectedFromProjectsCard({ data, locale }: { data: ExpectedIncomeSummary; locale: Locale }) {
  const t = await getTranslations("forecast.expectedFromProjects");

  if (data.expectedCount === 0) return null;

  return (
    <div className="card">
      <p className="label mb-1">{t("label")}</p>
      <p className="text-xs text-[#6A97B4] mb-4 leading-relaxed">{t("subtitle")}</p>

      <div className="space-y-2 mb-4">
        {data.upcoming.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 bg-[#1A3048] rounded-xl px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#C8DCF0] truncate">{m.clientName}</p>
                {m.isOverdue && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[#D970701A] text-[#D97070] flex-shrink-0">
                    {t("overdue")}
                  </span>
                )}
                {m.status === "pending" && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[#1E3550] text-[#6A97B4] flex-shrink-0">
                    {t("notSentYet")}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6A97B4] truncate mt-0.5">
                {m.label}
                {m.dueDate && ` · ${monthYearLabel(`${m.dueDate.getUTCFullYear()}-${String(m.dueDate.getUTCMonth() + 1).padStart(2, "0")}`, locale)}`}
              </p>
            </div>
            <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${m.isOverdue ? "text-[#D97070]" : "text-[#D4A254]"}`}>
              {formatCurrency(m.amount, locale)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#1E3550]">
        <span className="text-sm font-semibold text-[#A8C6E0]">{t("total")}</span>
        <span className="text-sm font-bold text-[#D4A254] tabular-nums">{formatCurrency(data.expectedThisMonth, locale)}</span>
      </div>
    </div>
  );
}
