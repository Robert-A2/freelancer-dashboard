"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import type { ClientRiskProfile } from "@/lib/client-risk-engine";
import { UNIDENTIFIED_SOURCE } from "@/lib/client-identity";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import StatusBadge from "@/components/clients/StatusBadge";

export default function ClientListRows({ clients, basePath, limit }: {
  clients: ClientRiskProfile[]; basePath: string; limit?: number;
}) {
  const t = useTranslations("clients");
  const locale = useLocale() as Locale;
  const rows = limit ? clients.slice(0, limit) : clients;

  return (
    <div className="space-y-1">
      {rows.map((c, i) => {
        const isUnidentified = c.name === UNIDENTIFIED_SOURCE;
        return (
          <Link
            key={c.name}
            href={`${basePath}/${encodeURIComponent(c.name)}`}
            className="flex items-center gap-3 py-3 rounded-xl hover:bg-[#1A3048] -mx-2 px-2 transition-colors group"
          >
            <span className="text-xs font-bold text-[#6A97B4] w-5 flex-shrink-0 tabular-nums">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className={`text-sm font-medium truncate ${isUnidentified ? "text-[#6A97B4] italic" : "text-[#E8F0F8]"}`}>
                  {c.name}
                </p>
                {!isUnidentified && (
                  <StatusBadge status={c.status} label={t(`status.${c.status}`)} />
                )}
                {!isUnidentified && (c.confidence === "medium" || c.confidence === "low") && (
                  <span className="text-[11px] font-medium text-[#D4A254] bg-[#D4A25410] border border-[#D4A25425] px-1.5 py-0.5 rounded-full">
                    {t(`confidence.${c.confidence}`)}
                  </span>
                )}
                {isUnidentified && (
                  <span className="text-[11px] text-[#4A7A9B] bg-[#1A304880] px-1.5 py-0.5 rounded">
                    {t("status.unidentified")}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6A97B4]">
                {t("list.lastPayment", {
                  date: new Date(c.lastPayment).toLocaleDateString(INTL_LOCALES[locale], {
                    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
                  }),
                })}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-[#4CC4A4] tabular-nums">{formatCurrency(c.totalRevenue, locale)}</p>
              <p className="text-xs text-[#6A97B4]">{t("list.ofIncome", { pct: c.revenueContributionPct })}</p>
            </div>
            <svg className="w-4 h-4 text-[#6A97B4] group-hover:text-[#3AB5A0] flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}
