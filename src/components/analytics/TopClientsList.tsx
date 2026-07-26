"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@/i18n/locales";
import type { ClientProfile } from "@/lib/analytics-engine";
import { formatCurrency } from "@/utils/finance";
import Link from "next/link";

interface Props {
  clients: ClientProfile[];
}

const TOP_COUNT = 6;

export default function TopClientsList({ clients }: Props) {
  const t = useTranslations("analytics.clientInsights");
  const locale = useLocale() as Locale;
  const [expanded, setExpanded] = useState(false);

  function durationLabel(months: number): string {
    if (months < 12) return t("duration.months", { count: months });
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? t("duration.yearsAndMonths", { years: y, months: m }) : t("duration.years", { count: y });
  }

  const visible = expanded ? clients : clients.slice(0, TOP_COUNT);

  return (
    <div className="card">
      <div className="mb-4">
        <p className="label mb-1">{t("topClients.title")}</p>
        <p className="text-[13px] text-[#6A97B4]">{t("topClients.subtitle")}</p>
      </div>

      <div className="space-y-3">
        {visible.map((c, i) => (
          <div key={c.name} className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-bold text-[#6A97B4] w-5 flex-shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/clients/${encodeURIComponent(c.name)}`}
                      className="text-sm font-medium text-[#E8F0F8] hover:text-[#3AB5A0] transition-colors truncate"
                    >
                      {c.name}
                    </Link>
                    {c.isPaymentProcessor && (
                      <span className="text-xs text-[#6A97B4] bg-[#1A3048] px-1.5 py-0.5 rounded flex-shrink-0">{t("processor")}</span>
                    )}
                    {c.isNew && (
                      <span className="text-xs text-[#4CC4A4] bg-[#4CC4A415] px-1.5 py-0.5 rounded flex-shrink-0">{t("new")}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6A97B4]">
                    {t("payments", { count: c.paymentCount })}
                    {" · "}{t("active", { duration: durationLabel(c.monthsActive) })}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[#4CC4A4]">{formatCurrency(c.totalRevenue, locale)}</p>
                <p className="text-xs text-[#6A97B4]">{t("topClients.ofIncome", { pct: String(c.revenueShare) })}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {clients.length > TOP_COUNT && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-5 flex items-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#2E9D8A] font-medium transition-colors w-full justify-center py-1"
        >
          {expanded ? (
            <>
              {t("topClients.showLess")}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            </>
          ) : (
            <>
              {t("topClients.showAll", { count: clients.length })}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}
