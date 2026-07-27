import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getClientRiskProfiles } from "@/lib/client-risk-engine";
import NameSourceButton from "@/components/clients/NameSourceButton";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import Link from "next/link";
import ClientSummaryBar from "@/components/clients/ClientSummaryBar";
import ClientListRows from "@/components/clients/ClientListRows";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t      = await getTranslations("clients");
  const locale = (await getLocale()) as Locale;
  const data   = await getClientRiskProfiles(user.id);
  const { clients, currentCount, followUpCount, inactiveCount, hasIntentData, unresolvedGroups } = data;

  return (
    <div className="space-y-8">

      {/* Header — question first, verdict count below */}
      <div>
        <p className="label mb-1">{t("label")}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {clients.length > 0 ? (
          <p className={`text-sm font-medium mt-0.5 ${
            followUpCount === 0 ? "text-[#4CC4A4]" :
            followUpCount < currentCount ? "text-[#D4A254]" :
            "text-[#E5484D]"
          }`}>
            {followUpCount === 0 && currentCount > 0
              ? t("verdictAllReliable", { n: currentCount })
              : followUpCount > 0 && currentCount > 0
              ? t("verdictMixed", { current: currentCount, followUp: followUpCount })
              : followUpCount > 0
              ? t("verdictAllNeedAttention", { n: followUpCount })
              : t("verdictAllInactive", { n: clients.length })}
          </p>
        ) : (
          <p className="text-[#7BA8C4] text-sm mt-0.5">{t("verdictNone")}</p>
        )}
        <p className="text-xs text-[#4A7A9B] mt-1">{t("subtitle")}</p>
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
          <ClientSummaryBar
            totalClients={clients.length}
            currentCount={currentCount}
            followUpCount={followUpCount}
            inactiveCount={inactiveCount}
          />

          {/* Follow-up alerts — only for genuinely overdue active clients */}
          {followUpCount > 0 && (() => {
            const overdueClients = clients.filter(c => c.status === "risk");
            if (overdueClients.length === 0) return null;
            const shown = overdueClients.slice(0, 3);
            const rest = overdueClients.length - 3;
            return (
              <div className="space-y-2">
                {shown.map(c => (
                  <div key={c.name} className="flex items-center gap-3 py-2">
                    <span className="text-[#D4A254] text-sm flex-shrink-0">⚠</span>
                    <p className="text-sm text-[#A8C6E0] flex-1">
                      <span className="font-semibold text-[#E8F0F8]">{c.name}</span>
                      {" — "}
                      {t("alerts.late", { days: c.currentGapDays })}
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
            <ClientListRows clients={clients} basePath="/clients" />
            <p className="text-[11px] text-[#475569] leading-relaxed mt-4 px-1">
              {t("list.multiProcessorNote")}
            </p>
          </div>

          {/* Unresolved payments — couldn't identify any sender name */}
          {unresolvedGroups.length > 0 && (
            <div className="card">
              <p className="label mb-1">{t("unresolved.title")}</p>
              <p className="text-[13px] text-[#6A97B4] mb-5">{t("unresolved.subtitle")}</p>

              <div className="divide-y divide-[#1A3048]">
                {unresolvedGroups.map((g) => (
                  <div key={g.fingerprint} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#A8C6E0] font-mono truncate">{g.description}</p>
                        <p className="text-xs text-[#6A97B4] mt-0.5">
                          {t("unresolved.summary", {
                            count: g.txCount,
                            amount: formatCurrency(g.totalRevenue, locale),
                          })}
                        </p>
                        <NameSourceButton description={g.description} fingerprint={g.fingerprint} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
