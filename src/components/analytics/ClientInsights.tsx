import { getTranslations, getLocale } from "next-intl/server";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import type { ClientInsightsData } from "@/lib/analytics-engine";
import { formatCurrency } from "@/utils/finance";
import Link from "next/link";

interface Props { data: ClientInsightsData; dataYear: number; }

export default async function ClientInsights({ data, dataYear }: Props) {
  const {
    clients, topClientShare, hasConcentrationRisk,
    activeClients, avgClientsPerMonth, newClientsThisYear,
    inactiveClients, diversification,
  } = data;

  const t = await getTranslations("analytics.clientInsights");
  const locale = (await getLocale()) as Locale;

  function durationLabel(months: number): string {
    if (months < 12) return t("duration.months", { count: months });
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m > 0 ? t("duration.yearsAndMonths", { years: y, months: m }) : t("duration.years", { count: y });
  }

  function daysAgoLabel(days: number): string {
    if (days <= 1) return t("daysAgo.today");
    if (days < 7) return t("daysAgo.days", { count: days });
    if (days < 30) return t("daysAgo.weeks", { count: Math.round(days / 7) });
    if (days < 365) return t("daysAgo.months", { count: Math.round(days / 30) });
    return t("daysAgo.years", { count: Math.round(days / 365) });
  }

  function yoyChip(value: number | null) {
    if (value === null) return <span className="text-xs text-[#6A97B4]">{t("firstYear")}</span>;
    const good = value >= 0;
    return (
      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-[#4CC4A415] text-[#4CC4A4]" : "bg-[#D9707015] text-[#D97070]"}`}>
        {t("yoyChange", { arrow: value >= 0 ? "↑" : "↓", pct: String(Math.abs(value)) })}
      </span>
    );
  }


  const diversificationConfig = {
    concentrated: { label: t("diversification.concentrated"), color: "text-[#D97070]" },
    moderate: { label: t("diversification.moderate"), color: "text-[#D4A254]" },
    diversified: { label: t("diversification.diversified"), color: "text-[#4CC4A4]" },
  }[diversification];

  const nonProc = clients.filter(c => !c.isPaymentProcessor);
  const topClient = clients[0] ?? null;

  return (
    <div className="space-y-5">

      {/* ── Overview metrics ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "topClientShare", label: t("metrics.topClientShare"), value: `${topClientShare}%`, color: hasConcentrationRisk ? "text-[#D97070]" : "text-[#4CC4A4]" },
          { key: "activeClients", label: t("metrics.activeClients"), value: String(activeClients), color: "text-[#3AB5A0]" },
          { key: "avgPerMonth", label: t("metrics.avgPerMonth"), value: String(avgClientsPerMonth), color: "text-[#A8C6E0]" },
          { key: "diversification", label: t("metrics.diversification"), value: diversificationConfig.label, color: diversificationConfig.color },
        ].map(m => (
          <div key={m.key} className="bg-[#1A3048] rounded-xl p-3">
            <p className="label mb-1">{m.label}</p>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Concentration risk alert ──────────────────────────────────────────── */}
      {hasConcentrationRisk && topClient && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#D970700A] border border-[#D9707025] rounded-xl">
          <span className="text-[#D97070] text-base flex-shrink-0">⚠</span>
          <p className="text-sm text-[#A8C6E0]">
            {t.rich("concentrationRisk", {
              pct: String(topClientShare),
              client: topClient.name,
              threshold: "50",
              processorNote: topClient.isPaymentProcessor ? t("processorNote") : "",
              warn: (chunks) => <span className="text-[#D97070] font-semibold">{chunks}</span>,
              b: (chunks) => <span className="text-[#E8F0F8] font-medium">{chunks}</span>,
            })}
          </p>
        </div>
      )}

      {/* ── Top clients table ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-4">
          <p className="label mb-1">{t("topClients.title")}</p>
          <p className="text-[13px] text-[#6A97B4]">{t("topClients.subtitle")}</p>
        </div>

        <div className="space-y-3">
          {clients.map((c, i) => (
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
      </div>

      {/* ── Client growth + Inactive ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Client growth — YoY */}
        <div className="card">
          <p className="label mb-1">{t("growth.title")}</p>
          <p className="text-[13px] text-[#6A97B4] mb-4">{t("growth.subtitle")}</p>
          {nonProc.length === 0 ? (
            <p className="text-sm text-[#6A97B4]">{t("growth.noDirectClients")}</p>
          ) : (
            <div className="space-y-3">
              {nonProc.slice(0, 6).map(c => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#E8F0F8] truncate">{c.name}</p>
                    {c.currentYearRevenue > 0 && (
                      <p className="text-xs text-[#6A97B4]">{t("growth.thisYear", { amount: formatCurrency(c.currentYearRevenue, locale), dataYear: String(dataYear) })}</p>
                    )}
                  </div>
                  {yoyChip(c.yoyGrowth)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive clients */}
        <div className="card">
          <p className="label mb-1">{t("activity.title")}</p>
          <p className="text-[13px] text-[#6A97B4] mb-4">{t("activity.subtitle")}</p>
          {inactiveClients.length === 0 ? (
            <div className="flex items-start gap-2.5 py-2">
              <span className="text-[#4CC4A4] text-lg flex-shrink-0">✓</span>
              <p className="text-sm text-[#A8C6E0]">{t("activity.noneDetected")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inactiveClients.map(c => (
                <div key={c.name} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#E8F0F8] truncate">{c.name}</p>
                    <p className="text-xs text-[#6A97B4]">
                      {t("activity.lifetime", { payments: t("payments", { count: c.paymentCount }), amount: formatCurrency(c.totalRevenue, locale) })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-[#D4A254]">
                      {daysAgoLabel(c.daysSinceLastPayment)}
                    </p>
                    <p className="text-xs text-[#6A97B4]">{t("activity.lastPayment")}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-[#6A97B4] pt-1">
                {t("activity.reachOut")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── New clients + Strongest relationship ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* New clients this year */}
        <div className="card">
          <p className="label mb-1">{t("newClients.title")}</p>
          <p className="text-[13px] text-[#6A97B4] mb-4">{t("newClients.subtitle", { dataYear: String(dataYear) })}</p>
          {newClientsThisYear.length === 0 ? (
            <p className="text-sm text-[#6A97B4]">{t("newClients.noneDetected", { dataYear: String(dataYear) })}</p>
          ) : (
            <div className="space-y-3">
              {newClientsThisYear.slice(0, 5).map(c => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#E8F0F8] truncate">{c.name}</p>
                    <p className="text-xs text-[#6A97B4]">{t("payments", { count: c.paymentCount })}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#4CC4A4] flex-shrink-0">{formatCurrency(c.totalRevenue, locale)}</p>
                </div>
              ))}
              <div className="pt-2">
                <p className="text-xs text-[#6A97B4]">
                  {t.rich("newClients.summary", {
                    count: newClientsThisYear.length,
                    amount: formatCurrency(newClientsThisYear.reduce((s, c) => s + c.totalRevenue, 0), locale),
                    dataYear: String(dataYear),
                    b: (chunks) => <span className="text-[#E8F0F8] font-medium">{chunks}</span>,
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Strongest relationship */}
        {topClient && !topClient.isPaymentProcessor && (
          <div className="card bg-[#4CC4A40A] border-[#4CC4A418]">
            <p className="label mb-3">{t("strongest.title")}</p>
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold text-[#E8F0F8]">{topClient.name}</p>
                <p className="text-xs text-[#6A97B4] mt-0.5">
                  {t("strongest.since", { date: new Date(topClient.firstPayment).toLocaleDateString(INTL_LOCALES[locale], { month: "short", year: "numeric", timeZone: "UTC" }) })}
                  {" · "}{t("strongest.relationship", { duration: durationLabel(topClient.monthsActive) })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "lifetimeRevenue", label: t("strongest.lifetimeRevenue"), value: formatCurrency(topClient.totalRevenue, locale), color: "text-[#4CC4A4]" },
                  { key: "totalPayments", label: t("strongest.totalPayments"), value: String(topClient.paymentCount), color: "text-[#3AB5A0]" },
                  { key: "avgPerPayment", label: t("strongest.avgPerPayment"), value: formatCurrency(topClient.avgPaymentSize, locale), color: "text-[#A8C6E0]" },
                  { key: "revenueShare", label: t("strongest.revenueShare"), value: `${topClient.revenueShare}%`, color: topClient.revenueShare >= 50 ? "text-[#D4A254]" : "text-[#6A97B4]" },
                ].map(m => (
                  <div key={m.key} className="bg-[#1A3048] rounded-xl p-2.5">
                    <p className="text-xs text-[#6A97B4] uppercase tracking-wide mb-0.5">{m.label}</p>
                    <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              {topClient.yoyGrowth !== null && (
                <p className="text-xs text-[#6A97B4]">
                  {t.rich("strongest.yoy", {
                    arrow: topClient.yoyGrowth >= 0 ? "↑" : "↓",
                    pct: String(Math.abs(topClient.yoyGrowth)),
                    change: (chunks) => <span className={topClient.yoyGrowth! >= 0 ? "text-[#4CC4A4]" : "text-[#D97070]"}>{chunks}</span>,
                  })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
