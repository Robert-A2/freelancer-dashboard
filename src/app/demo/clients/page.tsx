import { getTranslations, getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { getDemoDataset } from "@/lib/demo";
import Link from "next/link";
import ClientSummaryBar from "@/components/clients/ClientSummaryBar";
import ClientListRows from "@/components/clients/ClientListRows";

export const dynamic = "force-dynamic";

export default async function DemoClientsPage() {
  const t      = await getTranslations("clients");
  const locale = (await getLocale()) as Locale;

  const { clientData } = getDemoDataset(locale);
  const { clients, currentCount, followUpCount, inactiveCount } = clientData;

  return (
    <div className="space-y-8">
      <div>
        <p className="label mb-1">{t("label")}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-[#7BA8C4] text-sm mt-0.5">{t("subtitle")}</p>
      </div>

      {clients.length > 0 && (
        <>
          <ClientSummaryBar
            totalClients={clients.length}
            currentCount={currentCount}
            followUpCount={followUpCount}
            inactiveCount={inactiveCount}
          />

          {/* Follow-up alerts */}
          {followUpCount > 0 && (() => {
            const overdueClients = clients.filter(c => c.status === "risk");
            if (overdueClients.length === 0) return null;
            const shown = overdueClients.slice(0, 3);
            const rest  = overdueClients.length - 3;
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
                      href={`/demo/clients/${encodeURIComponent(c.name)}`}
                      className="text-xs text-[#6A97B4] hover:text-[#3AB5A0] flex-shrink-0 transition-colors"
                    >
                      {t("alerts.viewClient")} →
                    </Link>
                  </div>
                ))}
                {rest > 0 && (
                  <p className="text-xs text-[#6A97B4] px-1">{t("alerts.andMore", { count: rest })}</p>
                )}
              </div>
            );
          })()}

          {/* Client list */}
          <div className="card">
            <p className="label mb-1">{t("list.title")}</p>
            <p className="text-[13px] text-[#6A97B4] mb-5">{t("list.subtitle")}</p>
            <ClientListRows clients={clients} basePath="/demo/clients" />
          </div>
        </>
      )}
    </div>
  );
}
