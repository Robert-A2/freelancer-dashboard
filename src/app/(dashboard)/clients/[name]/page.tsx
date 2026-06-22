import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getClientRiskProfiles } from "@/lib/client-risk-engine";
import type { ClientStatus, DependencyRisk, RevenueTrend, ClientRiskProfile } from "@/lib/client-risk-engine";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ClientStatus, { dot: string; text: string; bg: string; border: string }> = {
  green:  { dot: "bg-[#4CC4A4]", text: "text-[#4CC4A4]", bg: "bg-[#4CC4A415]",  border: "border-[#4CC4A425]"  },
  yellow: { dot: "bg-[#D4A254]", text: "text-[#D4A254]", bg: "bg-[#D4A25415]",  border: "border-[#D4A25425]"  },
  red:    { dot: "bg-[#D97070]", text: "text-[#D97070]", bg: "bg-[#D9707015]",  border: "border-[#D9707025]"  },
};

const DEP_STYLES: Record<DependencyRisk, { text: string; bar: string }> = {
  low:    { text: "text-[#4CC4A4]", bar: "bg-[#4CC4A4]"  },
  medium: { text: "text-[#D4A254]", bar: "bg-[#D4A254]"  },
  high:   { text: "text-[#D97070]", bar: "bg-[#D97070]"  },
};

const TREND_STYLES: Record<RevenueTrend, { icon: string; color: string }> = {
  increasing: { icon: "↑", color: "text-[#4CC4A4]"  },
  stable:     { icon: "→", color: "text-[#A8C6E0]"  },
  declining:  { icon: "↓", color: "text-[#D97070]"  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function durationLabel(months: number, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (months < 12) return t("detail.duration.months", { count: months });
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? t("detail.duration.yearsAndMonths", { years: y, months: m }) : t("detail.duration.years", { count: y });
}

// ── Action badge colours ─────────────────────────────────────────────────────

const ACTION_STYLES = {
  followUp: { icon: "📬", bg: "bg-[#D9707010]", border: "border-[#D9707030]", label: "text-[#D97070]" },
  monitor:  { icon: "👁",  bg: "bg-[#D4A25410]", border: "border-[#D4A25430]", label: "text-[#D4A254]" },
  noAction: { icon: "✓",  bg: "bg-[#4CC4A410]", border: "border-[#4CC4A430]", label: "text-[#4CC4A4]"  },
};

// ── Status description ────────────────────────────────────────────────────────

function patternStatusDesc(
  client: ClientRiskProfile,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  if (client.avgIntervalDays === null) {
    return t("detail.pattern.insufficientData");
  }
  if (client.status === "green")  return t("detail.pattern.onSchedule");
  if (client.status === "yellow") return t("detail.pattern.slightlyLate");
  return t("detail.pattern.significantlyLate");
}

// ── Mini bar chart (server-rendered CSS) ─────────────────────────────────────

function MiniBarChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => {
        const pctH = Math.round((d.amount / max) * 100);
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { name: encodedName } = await params;
  const clientName = decodeURIComponent(encodedName);

  const t      = await getTranslations("clients");
  const locale = (await getLocale()) as Locale;
  const data   = await getClientRiskProfiles(user.id);

  const client = data.clients.find(
    c => c.name.toUpperCase() === clientName.toUpperCase()
  );

  if (!client) notFound();

  const statusStyle = STATUS_STYLES[client.status];
  const depStyle    = DEP_STYLES[client.dependencyRisk];
  const trendStyle  = client.revenueTrend ? TREND_STYLES[client.revenueTrend] : null;

  const dateOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(INTL_LOCALES[locale], dateOpts);

  return (
    <div className="space-y-8">

      {/* Back link */}
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-[#6A97B4] hover:text-[#3AB5A0] transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("detail.back")}
      </Link>

      {/* Client header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="label mb-1">{t("label")}</p>
          <h1 className="text-2xl font-bold text-[#E8F0F8] break-words">{client.name}</h1>
          <p className="text-xs text-[#6A97B4] mt-1">
            {t("detail.clientSince", {
              date: fmtDate(client.firstPayment),
            })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border} flex-shrink-0`}>
          <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
          {t(`status.${client.status}`)}
        </span>
      </div>

      {/* ── 1. Overview ──────────────────────────────────────────────────── */}
      <div>
        <p className="label mb-3">{t("detail.overview.title")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: "totalRevenue",    label: t("detail.overview.totalRevenue"),    value: formatCurrency(client.totalRevenue,   locale),  color: "text-[#4CC4A4]"  },
            { key: "contribution",    label: t("detail.overview.contribution"),     value: `${client.revenueContributionPct}%`,           color: client.revenueContributionPct >= 50 ? "text-[#D97070]" : client.revenueContributionPct >= 25 ? "text-[#D4A254]" : "text-[#4CC4A4]" },
            { key: "paymentCount",    label: t("detail.overview.paymentCount"),     value: String(client.paymentCount),                   color: "text-[#E8F0F8]"  },
            { key: "avgPayment",      label: t("detail.overview.avgPayment"),       value: formatCurrency(client.avgPayment,     locale),  color: "text-[#A8C6E0]"  },
            { key: "largestPayment",  label: t("detail.overview.largestPayment"),   value: formatCurrency(client.largestPayment, locale),  color: "text-[#A8C6E0]"  },
            { key: "duration",        label: t("detail.overview.duration"),         value: durationLabel(client.monthsActive, t),         color: "text-[#6A97B4]"  },
          ].map(m => (
            <div key={m.key} className="bg-[#1A3048] rounded-xl p-3.5">
              <p className="label mb-1 text-[11px]">{m.label}</p>
              <p className={`text-base font-bold tabular-nums ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-[#1A3048] rounded-xl p-3.5">
            <p className="label mb-1 text-[11px]">{t("detail.overview.firstPayment")}</p>
            <p className="text-sm font-semibold text-[#A8C6E0]">{fmtDate(client.firstPayment)}</p>
          </div>
          <div className="bg-[#1A3048] rounded-xl p-3.5">
            <p className="label mb-1 text-[11px]">{t("detail.overview.lastPayment")}</p>
            <p className="text-sm font-semibold text-[#A8C6E0]">{fmtDate(client.lastPayment)}</p>
          </div>
        </div>
      </div>

      {/* ── 2. Payment pattern ───────────────────────────────────────────── */}
      <div className={`card border ${statusStyle.border}`}>
        <p className="label mb-1">{t("detail.pattern.title")}</p>
        <p className="text-[13px] text-[#6A97B4] mb-4">{patternStatusDesc(client, t)}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-[#132537] rounded-xl p-3.5">
            <p className="label mb-1 text-[11px]">{t("detail.pattern.avgInterval")}</p>
            {client.avgIntervalDays !== null ? (
              <p className="text-base font-bold text-[#A8C6E0] tabular-nums">
                {t("detail.pattern.days", { count: client.avgIntervalDays })}
              </p>
            ) : (
              <p className="text-sm text-[#6A97B4]">{t("detail.pattern.noInterval")}</p>
            )}
          </div>
          <div className="bg-[#132537] rounded-xl p-3.5">
            <p className="label mb-1 text-[11px]">{t("detail.pattern.currentGap")}</p>
            <p className={`text-base font-bold tabular-nums ${statusStyle.text}`}>
              {t("detail.pattern.days", { count: client.currentGapDays })}
            </p>
          </div>
          <div className="bg-[#132537] rounded-xl p-3.5 col-span-2 sm:col-span-1">
            <p className="label mb-1 text-[11px]">{t("detail.pattern.expectedInterval")}</p>
            {client.avgIntervalDays !== null ? (
              <p className="text-base font-bold text-[#A8C6E0] tabular-nums">
                {t("detail.pattern.days", { count: client.avgIntervalDays })}
              </p>
            ) : (
              <p className="text-sm text-[#6A97B4]">—</p>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Revenue trend ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-1 gap-3">
          <p className="label">{t("detail.revenueTrend.title")}</p>
          {trendStyle && client.revenueTrend && (
            <span className={`text-sm font-semibold ${trendStyle.color}`}>
              {trendStyle.icon} {t(`trend.${client.revenueTrend}`)}
              {client.revenueTrendPct !== null && ` ${client.revenueTrendPct}%`}
            </span>
          )}
        </div>
        <p className="text-[13px] text-[#6A97B4] mb-4">{t("detail.revenueTrend.subtitle")}</p>

        {client.monthlyRevenue.every(m => m.amount === 0) ? (
          <p className="text-sm text-[#6A97B4]">{t("detail.revenueTrend.noData")}</p>
        ) : (
          <>
            <MiniBarChart data={client.monthlyRevenue} />
            <div className="flex justify-between mt-1">
              {client.monthlyRevenue.map((m, i) => (
                <div key={i} className="flex-1 text-right first:text-left">
                  {i === 0 && (
                    <span className="text-[10px] text-[#6A97B4]">
                      {formatCurrency(client.monthlyRevenue[0].amount, locale)}
                    </span>
                  )}
                  {i === client.monthlyRevenue.length - 1 && (
                    <span className="text-[10px] text-[#4CC4A4] font-semibold">
                      {formatCurrency(m.amount, locale)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 4. Dependency risk ──────────────────────────────────────────── */}
      <div className="card">
        <p className="label mb-1">{t("detail.dependencyRisk.title")}</p>
        <p className="text-[13px] text-[#6A97B4] mb-4">{t("detail.dependencyRisk.subtitle")}</p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-sm font-bold ${depStyle.text}`}>
                {t(`dependency.${client.dependencyRisk}`)}
              </span>
              <span className={`text-sm font-bold tabular-nums ${depStyle.text}`}>
                {client.revenueContributionPct}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#1E3550] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full opacity-80 ${depStyle.bar}`}
                style={{ width: `${client.revenueContributionPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#4CC4A4]">0%</span>
              <span className="text-[10px] text-[#D4A254]">25%</span>
              <span className="text-[10px] text-[#D97070]">50%</span>
              <span className="text-[10px] text-[#6A97B4]">100%</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-[#A8C6E0] mt-3">
          {t("detail.dependencyRisk.pctLabel", { pct: client.revenueContributionPct })}
        </p>
      </div>

      {/* ── 5. Insights ────────────────────────────────────────────────── */}
      {client.insights.length > 0 && (
        <div>
          <p className="label mb-3">{t("detail.insights.title")}</p>
          <div className="space-y-2">
            {client.insights.map((insight, i) => {
              const isWarning = insight.type === "delayWarning";
              const isRisk    = insight.type === "dependency" && client.revenueContributionPct >= 50;
              const isDecline = insight.type === "decline";
              const borderColor = (isWarning || isDecline) ? "border-[#D9707025]" : isRisk ? "border-[#D4A25425]" : "border-[#4CC4A425]";
              const iconColor   = (isWarning || isDecline) ? "text-[#D97070]" : isRisk ? "text-[#D4A254]" : "text-[#4CC4A4]";
              const icon        = (isWarning || isDecline) ? "⚠" : isRisk ? "ℹ" : "✓";

              let text = "";
              if (insight.type === "reliable") {
                text = t("detail.insights.reliable", { count: insight.params.count, months: insight.params.months });
              } else if (insight.type === "delayWarning") {
                text = t("detail.insights.delayWarning", { avgDays: insight.params.avgDays, currentGap: insight.params.currentGap });
              } else if (insight.type === "dependency") {
                text = t("detail.insights.dependency", { pct: insight.params.pct });
              } else if (insight.type === "decline") {
                text = t("detail.insights.decline", { pct: insight.params.pct });
              } else if (insight.type === "singlePayment") {
                text = t("detail.insights.singlePayment");
              }

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

      {/* ── 6. Recommended actions ──────────────────────────────────────── */}
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

      {/* ── 7. Payment history ──────────────────────────────────────────── */}
      <div className="card">
        <p className="label mb-1">{t("detail.history.title")}</p>
        <p className="text-[13px] text-[#6A97B4] mb-5">
          {t("detail.history.subtitle", { count: client.paymentCount })}
        </p>
        <div>
          {client.payments.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3 border-b border-[#1E3550] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#A8C6E0] truncate">{p.description}</p>
                <p className="text-xs text-[#6A97B4]">{fmtDate(p.date)}</p>
              </div>
              <p className="text-sm font-semibold text-[#4CC4A4] tabular-nums flex-shrink-0">
                {formatCurrency(p.amount, locale)}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
