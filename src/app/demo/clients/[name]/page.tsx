import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getDemoDataset } from "@/lib/demo";
import type { ClientStatus, ReliabilityScore } from "@/lib/client-risk-engine";
import { UNIDENTIFIED_SOURCE } from "@/lib/client-identity";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import Link from "next/link";
import CollapsibleSection from "@/components/ui/CollapsibleSection";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<ClientStatus, { dot: string; text: string; bg: string; border: string }> = {
  current:  { dot: "bg-[#4CC4A4]", text: "text-[#4CC4A4]", bg: "bg-[#4CC4A415]", border: "border-[#4CC4A425]" },
  watch:    { dot: "bg-[#D4A254]", text: "text-[#D4A254]", bg: "bg-[#D4A25415]", border: "border-[#D4A25425]" },
  risk:     { dot: "bg-[#E5484D]", text: "text-[#E5484D]", bg: "bg-[#E5484D15]", border: "border-[#E5484D25]" },
  inactive: { dot: "bg-[#4A7A9B]", text: "text-[#6A97B4]", bg: "bg-[#132537]",   border: "border-[#243F5E]"   },
};

const RELIABILITY_STYLES: Record<ReliabilityScore, { text: string; bg: string; border: string }> = {
  excellent: { text: "text-[#4CC4A4]", bg: "bg-[#4CC4A415]", border: "border-[#4CC4A430]" },
  good:      { text: "text-[#3AB5A0]", bg: "bg-[#3AB5A010]", border: "border-[#3AB5A025]" },
  watch:     { text: "text-[#D4A254]", bg: "bg-[#D4A25410]", border: "border-[#D4A25430]" },
  risk:      { text: "text-[#E5484D]", bg: "bg-[#E5484D10]", border: "border-[#E5484D30]" },
  inactive:  { text: "text-[#6A97B4]", bg: "bg-[#132537]",   border: "border-[#243F5E]"   },
};

const IMPACT_STYLES = {
  manageable:  { text: "text-[#4CC4A4]", bg: "bg-[#4CC4A410]", border: "border-[#4CC4A425]" },
  significant: { text: "text-[#D4A254]", bg: "bg-[#D4A25410]", border: "border-[#D4A25425]" },
  major:       { text: "text-[#E5484D]", bg: "bg-[#E5484D10]", border: "border-[#E5484D25]" },
  critical:    { text: "text-[#E5484D]", bg: "bg-[#E5484D18]", border: "border-[#E5484D35]" },
};

function durationLabel(months: number, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (months < 12) return t("detail.duration.months", { count: months });
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? t("detail.duration.yearsAndMonths", { years: y, months: m }) : t("detail.duration.years", { count: y });
}

function impactLevel(pct: number): "manageable" | "significant" | "major" | "critical" {
  if (pct >= 50) return "critical";
  if (pct >= 30) return "major";
  if (pct >= 15) return "significant";
  return "manageable";
}

function MiniBarChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => {
        const pctH    = Math.round((d.amount / max) * 100);
        const isEmpty = d.amount === 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
              <div
                className={`w-full rounded-t-sm transition-all ${isEmpty ? "bg-[#1E3550]" : "bg-[#3AB5A0] opacity-80"}`}
                style={{ height: isEmpty ? "2px" : `${Math.max(pctH, 4)}%` }}
              />
            </div>
            <span className="text-[10px] text-[#6A97B4] text-center leading-tight whitespace-nowrap">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function DemoClientDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: encodedName } = await params;
  const clientName = decodeURIComponent(encodedName);

  const t      = await getTranslations("clients");
  const locale = (await getLocale()) as Locale;

  const { clientData, financialLife } = getDemoDataset(locale);

  const clientIdx = clientData.clients.findIndex(c => c.name.toUpperCase() === clientName.toUpperCase());
  if (clientIdx === -1) notFound();

  const client     = clientData.clients[clientIdx];
  const clientRank = clientIdx + 1;

  const isUnidentified  = client.name === UNIDENTIFIED_SOURCE;
  const statusStyle     = STATUS_STYLES[isUnidentified ? "inactive" : client.status];
  const reliabilityStyle = RELIABILITY_STYLES[client.reliabilityScore];
  const impact          = impactLevel(client.revenueContributionPct);
  const impactStyle     = IMPACT_STYLES[impact];

  const dateOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(INTL_LOCALES[locale], dateOpts);

  const hasRecentActivity = client.monthlyRevenue.slice(3).some(m => m.amount > 0);
  const hasPriorActivity  = client.monthlyRevenue.slice(0, 3).some(m => m.amount > 0);
  const momentumDir =
    !hasPriorActivity    ? "new" :
    client.revenueTrend === "increasing" ? "growing" :
    client.revenueTrend === "declining"  ? "shrinking" :
    "stable";

  const momentumColor =
    momentumDir === "growing"   ? "text-[#4CC4A4]" :
    momentumDir === "shrinking" ? "text-[#E5484D]"  :
    momentumDir === "new"       ? "text-[#A8C6E0]"  : "text-[#A8C6E0]";

  const momentumIcon =
    momentumDir === "growing"   ? "↑" :
    momentumDir === "shrinking" ? "↓" :
    momentumDir === "new"       ? "★" : "→";

  const monthlyClientContrib = Math.round(client.totalRevenue / Math.max(client.monthsActive, 1));
  const annualClientContrib  = monthlyClientContrib * 12;

  const baselineMonthlyIncome =
    financialLife.hasEnoughData && financialLife.memory.avgMonthlyIncome12m > 0
      ? financialLife.memory.avgMonthlyIncome12m
      : client.revenueContributionPct > 0
      ? Math.round((client.totalRevenue / (client.revenueContributionPct / 100)) / Math.max(client.monthsActive, 1))
      : 0;
  const annualBaselineIncome = baselineMonthlyIncome * 12;

  const chronoPayments = [...client.payments].reverse();
  const maxPaymentAmt  = Math.max(...chronoPayments.map(p => p.amount), 1);
  const largestAmt     = Math.max(...chronoPayments.map(p => p.amount));

  const TIMELINE_LIMIT    = 24;
  const timelinePayments  = chronoPayments.slice(-TIMELINE_LIMIT);
  const timelineOffset    = chronoPayments.length - timelinePayments.length;

  type PaymentWithGap = {
    date: string; amount: number; description: string;
    gapDays: number | null; isUnusualGap: boolean;
    isLargest: boolean; isFirst: boolean; isLatest: boolean; barPct: number;
  };

  const timelineData: PaymentWithGap[] = timelinePayments.map((p, i) => {
    const globalIdx  = timelineOffset + i;
    const prevPayment = globalIdx > 0 ? chronoPayments[globalIdx - 1] : null;
    const gapDays = prevPayment
      ? Math.round((new Date(p.date).getTime() - new Date(prevPayment.date).getTime()) / 86_400_000)
      : null;
    const isUnusualGap = gapDays !== null && client.avgIntervalDays !== null && gapDays > client.avgIntervalDays * 1.5 && gapDays > 30;
    return {
      ...p, gapDays, isUnusualGap,
      isLargest: p.amount === largestAmt,
      isFirst:   globalIdx === 0,
      isLatest:  globalIdx === chronoPayments.length - 1,
      barPct:    Math.max(Math.round((p.amount / maxPaymentAmt) * 100), 4),
    };
  });

  const ACTION_STYLES = {
    followUp: { icon: "📬", bg: "bg-[#E5484D10]", border: "border-[#E5484D30]", label: "text-[#E5484D]" },
    monitor:  { icon: "👁",  bg: "bg-[#D4A25410]", border: "border-[#D4A25430]", label: "text-[#D4A254]" },
    noAction: { icon: "✓",  bg: "bg-[#4CC4A410]", border: "border-[#4CC4A430]", label: "text-[#4CC4A4]"  },
  };

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Back link */}
      <Link href="/demo/clients" className="inline-flex items-center gap-1.5 text-sm text-[#6A97B4] hover:text-[#3AB5A0] transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("detail.back")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="label mb-1">{t("label")}</p>
          <h1 className={`text-2xl font-bold break-words ${isUnidentified ? "text-[#6A97B4] italic" : "text-[#E8F0F8]"}`}>
            {client.name}
          </h1>
          {isUnidentified ? (
            <p className="text-xs text-[#4A7A9B] mt-1">{t("detail.identityUnknown")}</p>
          ) : (
            <p className="text-xs text-[#6A97B4] mt-1">{t("detail.clientSince", { date: fmtDate(client.firstPayment) })}</p>
          )}
        </div>
        {!isUnidentified && (
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
              <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
              {t(`status.${client.status}`)}
            </span>
            <span className="text-xs text-[#6A97B4]">{t("detail.relationshipHealth.rank", { rank: clientRank })}</span>
          </div>
        )}
      </div>

      {isUnidentified && (
        <div className="flex items-start gap-3 px-4 py-4 bg-[#1A3048] border border-[#243F5E] rounded-xl">
          <span className="text-[#6A97B4] text-base flex-shrink-0 mt-0.5">ℹ</span>
          <div>
            <p className="text-sm font-semibold text-[#A8C6E0] mb-1">{t("detail.identityUnknownTitle")}</p>
            <p className="text-sm text-[#7BA8C4] leading-relaxed">{t("detail.identityUnknownNote")}</p>
          </div>
        </div>
      )}

      {/* ── 1. Relationship Health ────────────────────────────────────────────── */}
      {!isUnidentified && (
        <div>
          <p className="label mb-3">{t("detail.relationshipHealth.title")}</p>
          <div className={`px-5 py-4 rounded-2xl border ${statusStyle.border} bg-[#1A3048] space-y-1 mb-4`}>
            <p className="text-sm text-[#E8F0F8] leading-relaxed">
              {t("detail.relationshipHealth.summary", { name: client.name, duration: durationLabel(client.monthsActive, t) })}
              {" "}
              {t("detail.relationshipHealth.paymentsTotal", { count: client.paymentCount, total: formatCurrency(client.totalRevenue, locale) })}
              {" "}
              {t("detail.relationshipHealth.avgPayment", { avg: formatCurrency(client.avgPayment, locale) })}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t("detail.overview.firstPayment"),  value: fmtDate(client.firstPayment),             color: "text-[#A8C6E0]" },
              { label: t("detail.overview.lastPayment"),   value: fmtDate(client.lastPayment),              color: "text-[#A8C6E0]" },
              { label: t("detail.overview.duration"),      value: durationLabel(client.monthsActive, t),    color: "text-[#6A97B4]" },
              { label: t("detail.overview.paymentCount"),  value: String(client.paymentCount),              color: "text-[#E8F0F8]" },
            ].map(m => (
              <div key={m.label} className="bg-[#1A3048] rounded-xl p-3.5">
                <p className="label mb-1 text-[11px]">{m.label}</p>
                <p className={`text-sm font-bold tabular-nums ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isUnidentified && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("detail.overview.paymentCount"), value: String(client.paymentCount),             color: "text-[#E8F0F8]" },
            { label: t("detail.overview.firstPayment"), value: fmtDate(client.firstPayment),            color: "text-[#A8C6E0]" },
            { label: t("detail.overview.lastPayment"),  value: fmtDate(client.lastPayment),             color: "text-[#A8C6E0]" },
            { label: t("detail.overview.avgPayment"),   value: formatCurrency(client.avgPayment, locale), color: "text-[#A8C6E0]" },
          ].map(m => (
            <div key={m.label} className="bg-[#1A3048] rounded-xl p-3.5">
              <p className="label mb-1 text-[11px]">{m.label}</p>
              <p className={`text-sm font-bold tabular-nums ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 2. Reliability Assessment ─────────────────────────────────────────── */}
      {!isUnidentified && (
        <div className={`card border ${reliabilityStyle.border}`}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="label">{t("detail.reliability.title")}</p>
            <span className={`text-base font-bold ${reliabilityStyle.text}`}>{t(`detail.reliability.${client.reliabilityScore}`)}</span>
          </div>
          <p className="text-sm text-[#A8C6E0] leading-relaxed mb-4">{t(`detail.reliability.${client.reliabilityScore}Desc`)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-[#132537] rounded-xl p-3.5">
              <p className="label mb-1 text-[11px]">{t("detail.pattern.avgInterval")}</p>
              {client.avgIntervalDays !== null ? (
                <p className="text-sm font-bold text-[#A8C6E0] tabular-nums">{t("detail.pattern.days", { count: client.avgIntervalDays })}</p>
              ) : (
                <p className="text-xs text-[#6A97B4]">{t("detail.pattern.noInterval")}</p>
              )}
            </div>
            <div className="bg-[#132537] rounded-xl p-3.5">
              <p className="label mb-1 text-[11px]">{t("detail.pattern.currentGap")}</p>
              <p className={`text-sm font-bold tabular-nums ${statusStyle.text}`}>{t("detail.pattern.days", { count: client.currentGapDays })}</p>
            </div>
            <div className="bg-[#132537] rounded-xl p-3.5 col-span-2 sm:col-span-1">
              <p className="label mb-1 text-[11px]">{t("detail.overview.avgPayment")}</p>
              <p className="text-sm font-bold text-[#A8C6E0] tabular-nums">{formatCurrency(client.avgPayment, locale)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Revenue Story ──────────────────────────────────────────────────── */}
      <div className="card">
        <p className="label mb-4">{t("detail.revenueStory.title")}</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[#1A3048] rounded-xl p-4 min-w-0">
            <p className="label mb-1 text-[11px]">{t("detail.revenueStory.allTime")}</p>
            <p className="text-lg font-bold text-[#4CC4A4] tabular-nums leading-tight break-all">{formatCurrency(client.totalRevenue, locale)}</p>
          </div>
          <div className="bg-[#1A3048] rounded-xl p-4 min-w-0">
            <p className="label mb-1 text-[11px]">{t("detail.revenueStory.ofIncome")}</p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${
              client.revenueContributionPct >= 50 ? "text-[#E5484D]" :
              client.revenueContributionPct >= 25 ? "text-[#D4A254]" :
              "text-[#4CC4A4]"
            }`}>{client.revenueContributionPct}%</p>
          </div>
        </div>

        {client.monthlyRevenue.some(m => m.amount > 0) ? (
          <>
            <p className="label mb-3 text-[11px]">{t("detail.revenueTrend.subtitle")}</p>
            <MiniBarChart data={client.monthlyRevenue} />
            <div className="mt-5 pt-4 border-t border-[#243F5E]">
              <p className="label mb-3 text-[11px]">{t("detail.revenueStory.periodComparison")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1A3048] rounded-xl p-3.5 min-w-0">
                  <p className="label mb-1 text-[11px]">{t("detail.revenueStory.recent3mo")}</p>
                  <p className={`text-sm font-bold tabular-nums break-all leading-tight ${hasRecentActivity ? "text-[#4CC4A4]" : "text-[#6A97B4]"}`}>
                    {hasRecentActivity ? formatCurrency(client.recentMonthlyAvg, locale) : "—"}
                  </p>
                  <p className="text-[10px] text-[#6A97B4] mt-0.5">{t("detail.momentum.recentAvg")}</p>
                </div>
                <div className="bg-[#1A3048] rounded-xl p-3.5 min-w-0">
                  <p className="label mb-1 text-[11px]">{t("detail.revenueStory.prior3mo")}</p>
                  <p className={`text-sm font-bold tabular-nums break-all leading-tight ${hasPriorActivity ? "text-[#A8C6E0]" : "text-[#6A97B4]"}`}>
                    {hasPriorActivity ? formatCurrency(client.priorMonthlyAvg, locale) : "—"}
                  </p>
                  <p className="text-[10px] text-[#6A97B4] mt-0.5">{t("detail.momentum.priorAvg")}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-[#6A97B4]">{t("detail.revenueStory.noActivity")}</p>
        )}
      </div>

      {/* ── 4. Client Momentum ────────────────────────────────────────────────── */}
      {!isUnidentified && (
        <CollapsibleSection
          title={t("detail.momentum.title")}
          subtitle={`${momentumIcon} ${t(`detail.momentum.${momentumDir}`)}${client.revenueTrendPct !== null ? ` ${client.revenueTrendPct}%` : ""}`}
          defaultOpen={false}
        >
        <div className="card">
          {hasPriorActivity && hasRecentActivity ? (
            <div className="space-y-3">
              <div className="flex items-stretch gap-3">
                <div className="flex-1 bg-[#1A3048] rounded-xl p-3.5">
                  <p className="text-[10px] text-[#6A97B4] mb-1">{t("detail.momentum.priorAvg")}</p>
                  <p className="text-lg font-bold text-[#A8C6E0] tabular-nums">{formatCurrency(client.priorMonthlyAvg, locale)}</p>
                  <div className="mt-2 h-1.5 bg-[#243F5E] rounded-full">
                    <div className="h-full bg-[#4A7A9B] rounded-full" style={{ width: `${Math.round((client.priorMonthlyAvg / Math.max(client.priorMonthlyAvg, client.recentMonthlyAvg, 1)) * 100)}%` }} />
                  </div>
                </div>
                <div className="flex items-center text-lg text-[#6A97B4] font-light flex-shrink-0">{momentumIcon}</div>
                <div className="flex-1 bg-[#1A3048] rounded-xl p-3.5">
                  <p className="text-[10px] text-[#6A97B4] mb-1">{t("detail.momentum.recentAvg")}</p>
                  <p className={`text-lg font-bold tabular-nums ${momentumColor}`}>{formatCurrency(client.recentMonthlyAvg, locale)}</p>
                  <div className="mt-2 h-1.5 bg-[#243F5E] rounded-full">
                    <div className={`h-full rounded-full ${momentumDir === "shrinking" ? "bg-[#E5484D]" : "bg-[#4CC4A4]"}`} style={{ width: `${Math.round((client.recentMonthlyAvg / Math.max(client.priorMonthlyAvg, client.recentMonthlyAvg, 1)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6A97B4]">{t("detail.momentum.noHistory")}</p>
          )}
        </div>
        </CollapsibleSection>
      )}

      {/* ── 5. Dependency Simulator ───────────────────────────────────────────── */}
      {!isUnidentified && client.lifecycle === "current" && (
        <CollapsibleSection
          title={t("detail.simulator.title", { name: client.name })}
          subtitle={`${t(`detail.simulator.${impact}`)} · ${client.revenueContributionPct}%`}
          defaultOpen={false}
        >
        <div className={`card border ${impactStyle.border}`}>
          <p className="text-[13px] text-[#6A97B4] mb-5">{t("detail.dependencyRisk.subtitle")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: t("detail.simulator.monthlyLoss"), value: formatCurrency(monthlyClientContrib, locale), color: "text-[#E5484D]" },
              { label: t("detail.simulator.annualLoss"),  value: formatCurrency(annualClientContrib,  locale), color: "text-[#E5484D]" },
              { label: t("detail.simulator.incomePct"),   value: `${client.revenueContributionPct}%`,          color: impactStyle.text },
              { label: t("detail.simulator.healthImpact"),value: t(`detail.simulator.${impact}`),              color: impactStyle.text },
            ].map(m => (
              <div key={m.label} className="bg-[#132537] rounded-xl p-3.5">
                <p className="label mb-1 text-[11px]">{m.label}</p>
                <p className={`text-base font-bold tabular-nums ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center justify-between text-xs text-[#6A97B4]">
              <span>{client.name}</span>
              <span>{client.revenueContributionPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#1E3550] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${client.revenueContributionPct >= 50 ? "bg-[#E5484D]" : client.revenueContributionPct >= 30 ? "bg-[#D4A254]" : "bg-[#4CC4A4]"} opacity-80`}
                style={{ width: `${client.revenueContributionPct}%` }}
              />
            </div>
            {annualBaselineIncome > 0 && (
              <div className="flex items-center justify-between text-xs text-[#4A7A9B]">
                <span>{t("detail.dependencyRisk.subtitle")}</span>
                <span>{formatCurrency(annualBaselineIncome, locale)}/yr baseline</span>
              </div>
            )}
          </div>
          <div className={`flex items-start gap-3 px-4 py-3 ${impactStyle.bg} border ${impactStyle.border} rounded-xl`}>
            <span className={`${impactStyle.text} font-semibold flex-shrink-0 mt-0.5`}>
              {impact === "manageable" ? "✓" : impact === "critical" ? "⚠" : "ℹ"}
            </span>
            <p className={`text-sm leading-relaxed ${impactStyle.text}`}>{t(`detail.simulator.${impact}Desc`)}</p>
          </div>
        </div>
        </CollapsibleSection>
      )}

      {/* ── 6. Payment Timeline ───────────────────────────────────────────────── */}
      <CollapsibleSection
        title={t("detail.timeline.title")}
        subtitle={t("detail.timeline.peek", {
          count: chronoPayments.length,
          first: fmtDate(chronoPayments[0]?.date ?? client.firstPayment),
          last: fmtDate(chronoPayments[chronoPayments.length - 1]?.date ?? client.lastPayment),
        })}
        defaultOpen={false}
      >
      <div className="card">
        <div className="flex items-center justify-between mb-1 gap-3">
          <span className="text-xs text-[#6A97B4]">
            {chronoPayments.length > TIMELINE_LIMIT
              ? t("detail.timeline.showingRecent", { count: TIMELINE_LIMIT })
              : t("detail.history.subtitle", { count: client.paymentCount })}
          </span>
        </div>
        <p className="text-[13px] text-[#6A97B4] mb-5">
          {fmtDate(chronoPayments[0]?.date ?? client.firstPayment)}
          {" → "}
          {fmtDate(chronoPayments[chronoPayments.length - 1]?.date ?? client.lastPayment)}
        </p>

        {isUnidentified && (
          <p className="text-xs text-[#4A7A9B] mb-4 leading-relaxed">{t("detail.identityTimelineNote")}</p>
        )}

        <div className="space-y-0">
          {timelineData.map((p, i) => (
            <div key={i}>
              {p.gapDays !== null && (
                <div className="flex items-center gap-2.5 py-2 pl-3">
                  <div className="w-px h-5 bg-[#243F5E] ml-1 flex-shrink-0" />
                  <span className={`text-[11px] ${p.isUnusualGap ? "text-[#D4A254] font-medium" : "text-[#4A7A9B]"}`}>
                    {t("detail.timeline.gapDays", { days: p.gapDays })}
                    {p.isUnusualGap && <span className="ml-1.5 text-[#D4A254]">· {t("detail.timeline.unusualGap")}</span>}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3 py-1.5">
                <div className="flex flex-col items-center flex-shrink-0 mt-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${p.isLargest ? "bg-[#4CC4A4]" : p.isUnusualGap ? "bg-[#D4A254]" : "bg-[#3AB5A0] opacity-50"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-xs text-[#6A97B4] flex-shrink-0">{fmtDate(p.date)}</span>
                      {p.isFirst  && <span className="text-[10px] text-[#6A97B4] bg-[#1A3048] px-1.5 py-0.5 rounded font-medium">{t("detail.timeline.firstPayment")}</span>}
                      {p.isLatest && <span className="text-[10px] text-[#4CC4A4] bg-[#4CC4A410] px-1.5 py-0.5 rounded font-medium">{t("detail.timeline.latestPayment")}</span>}
                      {p.isLargest && !p.isFirst && !p.isLatest && (
                        <span className="text-[10px] text-[#4CC4A4] bg-[#4CC4A410] px-1.5 py-0.5 rounded font-medium">{t("detail.timeline.largestPayment")}</span>
                      )}
                    </div>
                    <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${p.isLargest ? "text-[#4CC4A4]" : "text-[#A8C6E0]"}`}>
                      {formatCurrency(p.amount, locale)}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#1E3550] rounded-full mb-1">
                    <div className={`h-full rounded-full ${p.isLargest ? "bg-[#4CC4A4]" : "bg-[#3AB5A0] opacity-60"}`} style={{ width: `${p.barPct}%` }} />
                  </div>
                  <p className="text-[11px] text-[#4A7A9B] truncate">{p.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </CollapsibleSection>

      {/* ── 7. Insights ───────────────────────────────────────────────────────── */}
      {!isUnidentified && client.insights.length > 0 && (
        <div>
          <p className="label mb-3">{t("detail.insights.title")}</p>
          <div className="space-y-2">
            {client.insights.map((insight, i) => {
              const isWarning = insight.type === "delayWarning";
              const isRisk    = insight.type === "dependency" && client.revenueContributionPct >= 50;
              const isDecline = insight.type === "decline";
              const borderColor = (isWarning || isDecline) ? "border-[#E5484D25]" : isRisk ? "border-[#D4A25425]" : "border-[#4CC4A425]";
              const iconColor   = (isWarning || isDecline) ? "text-[#E5484D]"    : isRisk ? "text-[#D4A254]"   : "text-[#4CC4A4]";
              const icon        = (isWarning || isDecline) ? "⚠"                 : isRisk ? "ℹ"                : "✓";

              let text = "";
              if      (insight.type === "reliable")     text = t("detail.insights.reliable",     { count: insight.params.count, months: insight.params.months });
              else if (insight.type === "delayWarning") text = t("detail.insights.delayWarning", { avgDays: insight.params.avgDays, currentGap: insight.params.currentGap });
              else if (insight.type === "dependency")   text = t("detail.insights.dependency",   { pct: insight.params.pct });
              else if (insight.type === "decline")      text = t("detail.insights.decline",      { pct: insight.params.pct });
              else if (insight.type === "singlePayment") text = t("detail.insights.singlePayment");

              return (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 bg-[#1A3048] border ${borderColor} rounded-xl`}>
                  <span className={`${iconColor} flex-shrink-0 mt-0.5`}>{icon}</span>
                  <p className="text-sm text-[#A8C6E0]">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 8. Actions ────────────────────────────────────────────────────────── */}
      {!isUnidentified && (
        client.lifecycle === "inactive" ? (
          <div className="px-5 py-4 bg-[#132537] rounded-2xl border border-[#243F5E]">
            <p className="text-xs text-[#6A97B4] font-semibold uppercase tracking-wide mb-2">{t("detail.inactiveClient.label")}</p>
            <p className="text-sm text-[#7BA8C4] leading-relaxed">{t("detail.inactiveClient.note")}</p>
          </div>
        ) : (
          <div>
            <p className="label mb-3">{t("detail.actions.title")}</p>
            <div className="space-y-2">
              {client.actions.map((action, i) => {
                const s = ACTION_STYLES[action.type];
                return (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 ${s.bg} border ${s.border} rounded-xl`}>
                    <span className="text-base flex-shrink-0">{s.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${s.label}`}>{t(`detail.actions.${action.type}`)}</p>
                      <p className="text-xs text-[#7BA8C4] mt-0.5">{t(`detail.actions.${action.type}Reason`)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}
