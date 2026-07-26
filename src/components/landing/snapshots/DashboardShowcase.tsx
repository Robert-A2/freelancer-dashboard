import { getTranslations, getLocale } from "next-intl/server";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

// A frozen, real snapshot from an actual Nonodia test account — not the
// "Sophie" marketing demo, not computed, not invented. Every number here is
// exactly what the real dashboard showed on the day this was captured.
// Trimmed to the three highest-signal pieces (the 5 summary cards, Cash
// Runway, Expected This Month) — the coverage bar, period badge, and verdict
// paragraph are real too but were cut here to keep the hero light.
const DATA = {
  period: new Date(Date.UTC(2026, 6, 1)),
  income: 800,
  incomeChangePct: -89,
  expenses: 1538.97,
  expensesChangePct: -44,
  cashflow: -738.97,
  cashflowChangePct: -116,
  margin: -92,
  marginChangePct: -156,
  riskPositiveMonths: 11,
  riskTotalMonths: 14,
  runwayMonths: 2,
  runwayNet: 5250,
  runwayMilestoneCount: 4,
  runwayBurn: 2314.79,
  runwayGross: 7000,
  runwayTaxPct: 25,
  expectedNet: 5250,
  expectedGross: 7000,
  expectedTaxPct: 25,
  upcoming: [
    { clientName: "BB LTD", label: "Final payment (50%)", amount: 2000 },
    { clientName: "Halden Co.", label: "Final payment (50%)", amount: 1500 },
    { clientName: "Halden Co.", label: "Deposit (50%)", amount: 1500 },
    { clientName: "Ferro & Oak", label: "Deposit (50%)", amount: 2000 },
  ],
};

function Chip({ value }: { value: number }) {
  const isGood = value >= 0;
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${isGood ? "bg-[#4CC4A410] text-[#4CC4A4]" : "bg-[#D9707010] text-[#D97070]"}`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  );
}

const MARGIN_COLOR = DATA.margin >= 30 ? "text-[#4CC4A4]" : DATA.margin >= 10 ? "text-[#D4A254]" : "text-[#D97070]";
const RISK_COLOR = "text-[#D4A254]"; // Medium

export default async function DashboardShowcase() {
  const locale = (await getLocale()) as Locale;
  const intl = INTL_LOCALES[locale];

  const t  = await getTranslations("dashboard.summaryCards");
  const tm = await getTranslations("metrics");
  const tr = await getTranslations("dashboard.runwayCard");
  const te = await getTranslations("dashboard.expectedIncome");

  const monthLabel = DATA.period.toLocaleDateString(intl, { month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="pointer-events-none select-none space-y-2.5 text-[#E8F0F8]">

      {/* ── 5 summary cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-1.5">
        <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 flex flex-col gap-0.5">
          <p className="text-[8px] font-medium text-[#6A97B4] uppercase tracking-wide">{tm("income")}</p>
          <p className="text-[12px] font-bold text-[#4CC4A4] leading-none tabular-nums">{formatCurrency(DATA.income, locale)}</p>
          <p className="text-[8.5px] text-[#6A97B4]">{monthLabel}</p>
          <Chip value={DATA.incomeChangePct} />
        </div>

        <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 flex flex-col gap-0.5">
          <p className="text-[8px] font-medium text-[#6A97B4] uppercase tracking-wide">{tm("expenses")}</p>
          <p className="text-[12px] font-bold text-[#D4A254] leading-none tabular-nums">{formatCurrency(DATA.expenses, locale)}</p>
          <p className="text-[8.5px] text-[#6A97B4]">{monthLabel}</p>
          <Chip value={DATA.expensesChangePct} />
        </div>

        <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 flex flex-col gap-0.5">
          <p className="text-[8px] font-medium text-[#6A97B4] uppercase tracking-wide">{tm("cashflow")}</p>
          <p className="text-[12px] font-bold text-[#D97070] leading-none tabular-nums">{formatCurrency(DATA.cashflow, locale)}</p>
          <p className="text-[8.5px] text-[#6A97B4]">{t("expensesExceedIncome")}</p>
          <Chip value={DATA.cashflowChangePct} />
        </div>

        <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 flex flex-col gap-0.5">
          <p className="text-[8px] font-medium text-[#6A97B4] uppercase tracking-wide">{tm("margin")}</p>
          <p className={`text-[12px] font-bold leading-none tabular-nums ${MARGIN_COLOR}`}>{DATA.margin}%</p>
          <p className="text-[8.5px] text-[#6A97B4]">{monthLabel}</p>
          <Chip value={DATA.marginChangePct} />
        </div>

        <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-1.5 flex flex-col gap-0.5">
          <p className="text-[8px] font-medium text-[#6A97B4] uppercase tracking-wide">{t("risk")}</p>
          <p className={`text-[12px] font-bold leading-none ${RISK_COLOR}`}>{t("riskLevels.medium")}</p>
          <p className="text-[8.5px] text-[#6A97B4] leading-tight">{t("monthsPositive", { positive: DATA.riskPositiveMonths, total: DATA.riskTotalMonths })}</p>
        </div>
      </div>

      {/* ── Cash runway ───────────────────────────────────────────────── */}
      <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-3">
        <p className="text-[9px] font-medium text-[#6A97B4] uppercase tracking-wide mb-1.5">{tr("label")}</p>
        <p className="text-[22px] font-bold text-[#D4A254] tabular-nums leading-none mb-1">{tr("months", { count: DATA.runwayMonths })}</p>
        <p className="text-[9.5px] text-[#7BA8C4] leading-relaxed">
          {tr("body", { net: formatCurrency(DATA.runwayNet, locale), count: DATA.runwayMilestoneCount, burn: formatCurrency(DATA.runwayBurn, locale) })}
        </p>
        <p className="text-[8.5px] text-[#6A97B4] mt-1">{tr("taxNote", { gross: formatCurrency(DATA.runwayGross, locale), pct: DATA.runwayTaxPct })}</p>
      </div>

      {/* ── Expected this month ───────────────────────────────────────── */}
      <div className="bg-[#132537] border border-[#1E3550] rounded-lg p-3">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-[9px] font-medium text-[#6A97B4] uppercase tracking-wide">{te("thisMonth")}</p>
          <p className="text-[8.5px] font-semibold text-[#3AB5A0] flex-shrink-0">{te("viewAll")} →</p>
        </div>
        <p className="text-[17px] font-bold text-[#D4A254] tabular-nums mb-1">{formatCurrency(DATA.expectedNet, locale)}</p>
        <p className="text-[9px] text-[#A8C6E0] font-medium mb-0.5">{te("taxNote", { gross: formatCurrency(DATA.expectedGross, locale), pct: DATA.expectedTaxPct })}</p>
        <p className="text-[8.5px] text-[#6A97B4] mb-2">{te("fromMilestones", { count: DATA.runwayMilestoneCount })}</p>

        <p className="text-[8px] font-semibold text-[#6A97B4] uppercase tracking-wide mb-1.5">{te("beforeTax")}</p>

        <div className="space-y-1.5">
          {DATA.upcoming.map((m, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-[#1A3048] rounded-lg px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-[10px] text-[#C8DCF0] truncate font-medium leading-tight">{m.clientName}</p>
                <p className="text-[9px] text-[#6A97B4] truncate">{m.label}</p>
              </div>
              <span className="text-[10.5px] font-semibold text-[#E8F0F8] tabular-nums flex-shrink-0">{formatCurrency(m.amount, locale)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
