import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getClientRiskProfiles } from "@/lib/client-risk-engine";
import type { ClientStatus } from "@/lib/client-risk-engine";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ClientStatus, { dot: string; text: string; bg: string }> = {
  green:  { dot: "bg-[#4CC4A4]", text: "text-[#4CC4A4]", bg: "bg-[#4CC4A415]"  },
  yellow: { dot: "bg-[#D4A254]", text: "text-[#D4A254]", bg: "bg-[#D4A25415]"  },
  red:    { dot: "bg-[#D97070]", text: "text-[#D97070]", bg: "bg-[#D9707015]"  },
};

function StatusBadge({ status, label }: { status: ClientStatus; label: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {label}
    </span>
  );
}

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t      = await getTranslations("clients");
  const locale = (await getLocale()) as Locale;
  const data   = await getClientRiskProfiles(user.id);
  const { clients, highRiskCount, watchCount, reliableCount, hasIntentData } = data;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <p className="label mb-1">{t("label")}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      {/* Intent data notice */}
      {!hasIntentData && clients.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#D4A25408] border border-[#D4A25425] rounded-xl">
          <span className="text-[#D4A254] flex-shrink-0 text-base mt-0.5">ℹ</span>
          <p className="text-sm text-[#A8C6E0]">{t("intentDataWarning")}</p>
        </div>
      )}

      {/* Empty state */}
      {clients.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-xl font-semibold mb-2">{t("emptyState.heading")}</h2>
          <p className="text-[#7BA8C4] mb-6 max-w-sm mx-auto">{t("emptyState.body")}</p>
          <Link href="/upload" className="btn-primary inline-block">{t("emptyState.cta")}</Link>
        </div>
      )}

      {clients.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t("summary.totalClients"), value: clients.length, color: "text-[#E8F0F8]" },
              { label: t("summary.reliable"),     value: reliableCount,  color: "text-[#4CC4A4]" },
              { label: t("summary.watching"),     value: watchCount,     color: "text-[#D4A254]" },
              { label: t("summary.highRisk"),     value: highRiskCount,  color: "text-[#D97070]" },
            ].map(m => (
              <div key={m.label} className="bg-[#1A3048] rounded-xl p-4">
                <p className="label mb-1">{m.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Risk alerts — show top 3 only */}
          {highRiskCount > 0 && (() => {
            const redClients = clients.filter(c => c.status === "red");
            const shown = redClients.slice(0, 3);
            const rest = redClients.length - 3;
            return (
              <div className="space-y-2">
                {shown.map(c => (
                  <div key={c.name} className="flex items-center gap-3 py-2">
                    <span className="text-[#D97070] text-sm flex-shrink-0">⚠</span>
                    <p className="text-sm text-[#A8C6E0] flex-1">
                      <span className="font-semibold text-[#E8F0F8]">{c.name}</span>
                      {" — "}
                      {t("alerts.red", { days: c.currentGapDays })}
                    </p>
                    <Link
                      href={`/clients/${encodeURIComponent(c.name)}`}
                      className="text-xs text-[#6A97B4] hover:text-[#3AB5A0] flex-shrink-0 transition-colors"
                    >
                      {t("alerts.viewClient")} →
                    </Link>
                  </div>
                ))}
                {rest > 0 && (
                  <p className="text-xs text-[#6A97B4] px-1">
                    {t("alerts.andMore", { count: rest })}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Client list */}
          <div className="card">
            <p className="label mb-1">{t("list.title")}</p>
            <p className="text-[13px] text-[#6A97B4] mb-5">{t("list.subtitle")}</p>

            <div className="space-y-1">
              {clients.map((c, i) => (
                <Link
                  key={c.name}
                  href={`/clients/${encodeURIComponent(c.name)}`}
                  className="flex items-center gap-3 py-3 rounded-xl hover:bg-[#1A3048] -mx-2 px-2 transition-colors group"
                >
                  <span className="text-xs font-bold text-[#6A97B4] w-5 flex-shrink-0 tabular-nums">{i + 1}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-medium text-[#E8F0F8] truncate">{c.name}</p>
                      <StatusBadge status={c.status} label={t(`status.${c.status}`)} />
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
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
