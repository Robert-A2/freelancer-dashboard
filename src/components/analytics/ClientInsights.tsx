import type { ClientInsightsData } from "@/lib/analytics-engine";
import { formatCurrency } from "@/utils/finance";

interface Props { data: ClientInsightsData; }

function daysLabel(days: number): string {
  if (days <= 1)  return "today";
  if (days < 7)   return `${days}d ago`;
  if (days < 30)  return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function monthsLabel(months: number): string {
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y ${m}mo` : `${y} year${y !== 1 ? "s" : ""}`;
}

function YoyChip({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-[#9CA3AF]">First year</span>;
  const good = value >= 0;
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${good ? "bg-[#5B8A7215] text-[#5B8A72]" : "bg-[#C66A5A15] text-[#C66A5A]"}`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

function RevenueBar({ share }: { share: number }) {
  return (
    <div className="w-full h-1 bg-[#ECEEE9] rounded-full overflow-hidden mt-1">
      <div className="h-full bg-[#4F7A65] rounded-full opacity-70" style={{ width: `${Math.min(share, 100)}%` }} />
    </div>
  );
}

export default function ClientInsights({ data }: Props) {
  const {
    clients, topClientShare, hasConcentrationRisk,
    activeClients, avgClientsPerMonth, newClientsThisYear,
    inactiveClients, diversification,
  } = data;

  const diversificationConfig = {
    concentrated: { label: "Concentrated", color: "text-[#C66A5A]", bg: "bg-[#C66A5A15]", border: "border-[#C66A5A30]" },
    moderate:     { label: "Moderate",     color: "text-[#C79A63]", bg: "bg-[#C79A6315]", border: "border-[#C79A6330]" },
    diversified:  { label: "Diversified",  color: "text-[#5B8A72]", bg: "bg-[#5B8A7215]", border: "border-[#5B8A7230]" },
  }[diversification];

  const nonProc = clients.filter(c => !c.isPaymentProcessor);
  const topClient = clients[0] ?? null;

  return (
    <div className="space-y-5">

      {/* ── Overview metrics ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Top client share", value: `${topClientShare}%`,           color: hasConcentrationRisk ? "text-[#C66A5A]" : "text-[#5B8A72]" },
          { label: "Active clients",   value: String(activeClients),           color: "text-[#4F7A65]" },
          { label: "Avg per month",    value: String(avgClientsPerMonth),       color: "text-[#4B5563]" },
          { label: "Diversification",  value: diversificationConfig.label,     color: diversificationConfig.color },
        ].map(m => (
          <div key={m.label} className="bg-[#F7F8F5] rounded-xl p-3">
            <p className="label mb-1">{m.label}</p>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Concentration risk alert ──────────────────────────────────────────── */}
      {hasConcentrationRisk && topClient && (
        <div className="flex items-start gap-3 px-4 py-3 bg-[#C66A5A0A] border border-[#C66A5A25] rounded-xl">
          <span className="text-[#C66A5A] text-base flex-shrink-0">⚠</span>
          <p className="text-sm text-[#4B5563]">
            <span className="text-[#C66A5A] font-semibold">Revenue concentration risk: </span>
            {topClientShare}% of income came from{" "}
            <span className="text-[#1F2937] font-medium">{topClient.name}</span>
            {topClient.isPaymentProcessor ? " (payment processor, may represent multiple clients)" : ""}.
            Losing this source would significantly impact your business.
          </p>
        </div>
      )}

      {/* ── Top clients table ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-4">
          <p className="label mb-1">Top clients by revenue</p>
          <p className="text-xs text-[#9CA3AF]">Ranked by total revenue, all time</p>
        </div>

        <div className="space-y-3">
          {clients.map((c, i) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-bold text-[#B8BFC8] w-5 flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-[#1F2937] truncate">{c.name}</p>
                      {c.isPaymentProcessor && (
                        <span className="text-[10px] text-[#9CA3AF] bg-[#F3F4F0] px-1.5 py-0.5 rounded flex-shrink-0">processor</span>
                      )}
                      {c.isNew && (
                        <span className="text-[10px] text-[#5B8A72] bg-[#5B8A7215] px-1.5 py-0.5 rounded flex-shrink-0">new</span>
                      )}
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      {c.paymentCount} payment{c.paymentCount !== 1 ? "s" : ""}
                      {" · "}active {monthsLabel(c.monthsActive)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#5B8A72]">{formatCurrency(c.totalRevenue)}</p>
                  <p className="text-xs text-[#9CA3AF]">{c.revenueShare}% of income</p>
                </div>
              </div>
              <RevenueBar share={c.revenueShare} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Client growth + Inactive ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Client growth — YoY */}
        <div className="card">
          <p className="label mb-1">Client growth</p>
          <p className="text-xs text-[#9CA3AF] mb-4">Year-over-year revenue change by client</p>
          {nonProc.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No direct client data. Income from payment processors only.</p>
          ) : (
            <div className="space-y-3">
              {nonProc.slice(0, 6).map(c => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#374151] truncate">{c.name}</p>
                    {c.currentYearRevenue > 0 && (
                      <p className="text-xs text-[#9CA3AF]">{formatCurrency(c.currentYearRevenue)} this year</p>
                    )}
                  </div>
                  <YoyChip value={c.yoyGrowth} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive clients */}
        <div className="card">
          <p className="label mb-1">Client activity alerts</p>
          <p className="text-xs text-[#9CA3AF] mb-4">Clients who paid regularly but have gone quiet</p>
          {inactiveClients.length === 0 ? (
            <div className="flex items-start gap-2.5 py-2">
              <span className="text-[#5B8A72] text-lg flex-shrink-0">✓</span>
              <p className="text-sm text-[#4B5563]">No inactive clients detected. All established clients are still active.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inactiveClients.map(c => (
                <div key={c.name} className="flex items-start justify-between gap-3 py-2 border-b border-[#ECEEE9] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F2937] truncate">{c.name}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {c.paymentCount} payments · {formatCurrency(c.totalRevenue)} lifetime
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-[#C79A63]">
                      {daysLabel(c.daysSinceLastPayment)}
                    </p>
                    <p className="text-[10px] text-[#B8BFC8]">last payment</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-[#9CA3AF] pt-1">
                Consider reaching out. A brief check-in often revives dormant client relationships.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── New clients + Strongest relationship ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* New clients this year */}
        <div className="card">
          <p className="label mb-1">New client acquisition</p>
          <p className="text-xs text-[#9CA3AF] mb-4">First-time clients who paid this year</p>
          {newClientsThisYear.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No new direct clients detected this year.</p>
          ) : (
            <div className="space-y-3">
              {newClientsThisYear.slice(0, 5).map(c => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#374151] truncate">{c.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{c.paymentCount} payment{c.paymentCount !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#5B8A72] flex-shrink-0">{formatCurrency(c.totalRevenue)}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-[#ECEEE9]">
                <p className="text-xs text-[#9CA3AF]">
                  <span className="text-[#374151] font-medium">{newClientsThisYear.length} new client{newClientsThisYear.length !== 1 ? "s" : ""} · </span>
                  {formatCurrency(newClientsThisYear.reduce((s, c) => s + c.totalRevenue, 0))} in new revenue this year
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Strongest relationship */}
        {topClient && !topClient.isPaymentProcessor && (
          <div className="card bg-[#5B8A720A] border-[#5B8A7218]">
            <p className="label mb-3">Strongest client relationship</p>
            <div className="space-y-3">
              <div>
                <p className="text-lg font-bold text-[#1F2937]">{topClient.name}</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Client since {new Date(topClient.firstPayment).toLocaleDateString("en-IE", { month: "short", year: "numeric" })}
                  {" · "}{monthsLabel(topClient.monthsActive)} relationship
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Lifetime revenue", value: formatCurrency(topClient.totalRevenue),   color: "text-[#5B8A72]" },
                  { label: "Total payments",   value: String(topClient.paymentCount),            color: "text-[#4F7A65]" },
                  { label: "Avg per payment",  value: formatCurrency(topClient.avgPaymentSize),  color: "text-[#4B5563]" },
                  { label: "Revenue share",    value: `${topClient.revenueShare}%`,              color: topClient.revenueShare >= 50 ? "text-[#C79A63]" : "text-[#9CA3AF]" },
                ].map(m => (
                  <div key={m.label} className="bg-[#F7F8F5] rounded-xl p-2.5">
                    <p className="text-[10px] text-[#B8BFC8] uppercase tracking-wide mb-0.5">{m.label}</p>
                    <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              {topClient.yoyGrowth !== null && (
                <p className="text-xs text-[#9CA3AF]">
                  Revenue{" "}
                  <span className={topClient.yoyGrowth >= 0 ? "text-[#5B8A72]" : "text-[#C66A5A]"}>
                    {topClient.yoyGrowth >= 0 ? "↑" : "↓"} {Math.abs(topClient.yoyGrowth)}%
                  </span>
                  {" "}year over year.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
