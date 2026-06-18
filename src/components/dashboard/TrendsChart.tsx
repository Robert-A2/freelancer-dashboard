"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataPoint {
  month: string;
  year: number;
  monthNum: number;
  income: number;
  expenses: number;
  savings: number;
  cashflow: number;
}

interface Props {
  data: DataPoint[];
  trajectoryInsight?: Insight | null;
  trajectoryDetails?: Insight[];
}

type MonthBreakdown = {
  year: number;
  month: number;
  totalExpenses: number;
  totalIncome: number;
  expenseCategories: { category: string; total: number; count: number }[];
  incomeCategories:  { category: string; total: number; count: number }[];
};

type TxData = {
  category: string;
  total: number;
  count: number;
  transactions: {
    id: string;
    description: string;
    transactionDate: string;
    amount: number;
    intent: string | null;
  }[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_RANGES = [
  { key: "3m",  months: 3   },
  { key: "6m",  months: 6   },
  { key: "12m", months: 12  },
  { key: "all", months: 999 },
] as const;

const TOOLTIP_STYLE = {
  backgroundColor: "#132537",
  border: "1px solid #243F5E",
  borderRadius: "0.75rem",
  color: "#E8F0F8",
  fontSize: "13px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

const INTENT_LABEL: Record<string, string> = {
  personal_expense: "Personal",   business_expense: "Business",
  subscription:     "Subscription", tax_payment:    "Tax",
  savings_transfer: "Savings",    family_support:   "Family",
  investment:       "Investment", loan_repayment:   "Loan",
  owner_draw:       "Owner Draw", freelance_income: "Freelance",
  salary:           "Salary",     passive_income:   "Passive income",
  refund:           "Refund",
};

const INTENT_COLOR: Record<string, string> = {
  personal_expense: "bg-[#1E3A5F] text-[#7BB8E8]",
  business_expense: "bg-[#1A3D30] text-[#4CC4A4]",
  subscription:     "bg-[#2D1F4A] text-[#A78BFA]",
  tax_payment:      "bg-[#3D2800] text-[#D4A254]",
  savings_transfer: "bg-[#0F3338] text-[#3EC9BD]",
  family_support:   "bg-[#3D1A2A] text-[#F09EC0]",
  investment:       "bg-[#1A3030] text-[#34D399]",
  loan_repayment:   "bg-[#3D1A1A] text-[#F87171]",
  freelance_income: "bg-[#0F3028] text-[#4CC4A4]",
  salary:           "bg-[#1A2D4A] text-[#60A5FA]",
  passive_income:   "bg-[#2A2810] text-[#FBBF24]",
  refund:           "bg-[#1A2040] text-[#A5B4FC]",
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-xs text-[#4A6B85] italic">—</span>;
  const label = INTENT_LABEL[intent] ?? intent.replace(/_/g, " ");
  const color = INTENT_COLOR[intent] ?? "bg-[#1A3048] text-[#7BA8C4]";
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// ── Month Drawer ──────────────────────────────────────────────────────────────

type SelectedMonth = { year: number; monthNum: number; label: string };
type SelectedCat   = { category: string; type: "expense" | "income" };

function MonthDrawer({
  month,
  onClose,
  locale,
}: {
  month: SelectedMonth | null;
  onClose: () => void;
  locale: Locale;
}) {
  const tCategories = useTranslations("categories");

  const [breakdown,  setBreakdown]  = useState<MonthBreakdown | null>(null);
  const [bLoading,   setBLoading]   = useState(false);
  const [view,       setView]       = useState<"month" | "category">("month");
  const [selCat,     setSelCat]     = useState<SelectedCat | null>(null);
  const [txData,     setTxData]     = useState<TxData | null>(null);
  const [txLoading,  setTxLoading]  = useState(false);
  const [activeTab,  setActiveTab]  = useState<"expense" | "income" | "cashflow">("expense");

  // Fetch month breakdown when month changes
  useEffect(() => {
    if (!month) { setBreakdown(null); setView("month"); setSelCat(null); return; }
    setBLoading(true);
    setBreakdown(null);
    setView("month");
    setSelCat(null);
    setTxData(null);
    setActiveTab("expense");
    fetch(`/api/analytics/month-breakdown?year=${month.year}&month=${month.monthNum}`)
      .then(r => r.json())
      .then(d => { setBreakdown(d); setBLoading(false); })
      .catch(() => setBLoading(false));
  }, [month]);

  // Fetch transactions when category selected
  useEffect(() => {
    if (!selCat || !month) return;
    setTxLoading(true);
    setTxData(null);
    const p = new URLSearchParams({
      category: selCat.category,
      type:     selCat.type,
      year:     String(month.year),
      month:    String(month.monthNum),
    });
    fetch(`/api/analytics/category-transactions?${p}`)
      .then(r => r.json())
      .then(d => { setTxData(d); setTxLoading(false); })
      .catch(() => setTxLoading(false));
  }, [selCat, month]);

  // Scroll lock
  useEffect(() => {
    if (month) document.body.style.overflow = "hidden";
    else       document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [month]);

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "category") { setView("month"); setSelCat(null); setTxData(null); }
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, view]);

  const openCategory = (category: string, type: "expense" | "income") => {
    setSelCat({ category, type });
    setView("category");
  };

  const backToMonth = () => { setView("month"); setSelCat(null); setTxData(null); };

  const isOpen     = !!month;
  const displayCat = selCat
    ? (tCategories.has(selCat.category) ? tCategories(selCat.category) : selCat.category)
    : "";
  const accent = selCat?.type === "income"
    ? { text: "text-[#4CC4A4]", bar: "bg-[#4CC4A4]" }
    : { text: "text-[#D4A254]", bar: "bg-[#D4A254]" };

  // Compute the total for the active tab's bar widths
  const tabCategories = breakdown && activeTab !== "cashflow"
    ? (activeTab === "expense" ? breakdown.expenseCategories : breakdown.incomeCategories)
    : [];
  const tabTotal = tabCategories.reduce((s, c) => s + c.total, 0);
  // For cashflow tab: scale bars against the larger of the two sides
  const cashflowScale = breakdown
    ? Math.max(breakdown.totalIncome, breakdown.totalExpenses)
    : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-[#0D2137] border-l border-[#1E3A55]
          shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* ── Level 1: Month overview ────────────────────────────────────── */}
        {view === "month" && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-1">
                  Monthly Breakdown
                </p>
                <h2 className="text-xl font-bold text-[#E8F0F8]">{month?.label}</h2>
              </div>
              <button
                onClick={onClose}
                className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                  text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Income / Expenses summary pills */}
            {breakdown && (
              <div className="flex gap-4 px-6 py-4 bg-[#0A1C2E] border-b border-[#1E3A55]">
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#4A7A9B] mb-0.5">Income</p>
                  <p className="text-lg font-bold text-[#4CC4A4]">
                    {formatCurrency(breakdown.totalIncome, locale)}
                  </p>
                </div>
                <div className="w-px bg-[#1E3A55]" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#4A7A9B] mb-0.5">Expenses</p>
                  <p className="text-lg font-bold text-[#D4A254]">
                    {formatCurrency(breakdown.totalExpenses, locale)}
                  </p>
                </div>
                <div className="w-px bg-[#1E3A55]" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#4A7A9B] mb-0.5">Cashflow</p>
                  <p className={`text-lg font-bold ${
                    breakdown.totalIncome - breakdown.totalExpenses >= 0
                      ? "text-[#4CC4A4]" : "text-[#D97070]"
                  }`}>
                    {formatCurrency(breakdown.totalIncome - breakdown.totalExpenses, locale)}
                  </p>
                </div>
              </div>
            )}

            {/* Tabs */}
            {breakdown && (
              <div className="flex gap-0 border-b border-[#1E3A55]">
                <button
                  onClick={() => setActiveTab("expense")}
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === "expense"
                      ? "border-[#D4A254] text-[#D4A254]"
                      : "border-transparent text-[#4A7A9B] hover:text-[#A8C6E0]"
                  }`}
                >
                  Expenses
                </button>
                <button
                  onClick={() => setActiveTab("income")}
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === "income"
                      ? "border-[#4CC4A4] text-[#4CC4A4]"
                      : "border-transparent text-[#4A7A9B] hover:text-[#A8C6E0]"
                  }`}
                >
                  Income
                </button>
                <button
                  onClick={() => setActiveTab("cashflow")}
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === "cashflow"
                      ? "border-[#3AB5A0] text-[#3AB5A0]"
                      : "border-transparent text-[#4A7A9B] hover:text-[#A8C6E0]"
                  }`}
                >
                  Cashflow
                </button>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {bLoading && (
                <div className="flex items-center justify-center h-40 text-[#4A7A9B] text-sm">
                  Loading…
                </div>
              )}

              {/* Expenses / Income tabs */}
              {breakdown && activeTab !== "cashflow" && tabCategories.length === 0 && (
                <div className="px-6 py-8 text-center text-[#4A7A9B] text-sm">
                  No {activeTab} data for this month.
                </div>
              )}
              {breakdown && activeTab !== "cashflow" && tabCategories.length > 0 && (
                <div className="px-6 py-4 space-y-3">
                  {tabCategories.map((cat) => {
                    const pct   = tabTotal > 0 ? Math.round((cat.total / tabTotal) * 100) : 0;
                    const name  = tCategories.has(cat.category) ? tCategories(cat.category) : cat.category;
                    const barCl = activeTab === "income" ? "bg-[#4CC4A4]" : "bg-[#D4A254]";
                    const txtCl = activeTab === "income" ? "text-[#4CC4A4]" : "text-[#D4A254]";
                    return (
                      <button
                        key={cat.category}
                        onClick={() => openCategory(cat.category, activeTab as "expense" | "income")}
                        className="w-full text-left group"
                      >
                        <div className="flex justify-between items-center text-sm mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize truncate">
                              {name}
                            </span>
                            <span className="text-xs text-[#4A7A9B] flex-shrink-0">{cat.count} tx</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <span className={`font-medium ${txtCl}`}>{formatCurrency(cat.total, locale)}</span>
                            <span className="text-[#2A4F6A] group-hover:text-[#4A7A9B]">›</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barCl} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cashflow tab — income in, expenses out, side by side */}
              {breakdown && activeTab === "cashflow" && (
                <div className="px-6 py-4 space-y-5">
                  {/* Net cashflow callout */}
                  <div className={`rounded-xl px-4 py-3 border ${
                    breakdown.totalIncome - breakdown.totalExpenses >= 0
                      ? "bg-[#0F2A1E] border-[#1A4030]"
                      : "bg-[#2A1010] border-[#40201A]"
                  }`}>
                    <p className="text-xs text-[#4A7A9B] mb-0.5">Net Cashflow</p>
                    <p className={`text-2xl font-bold ${
                      breakdown.totalIncome - breakdown.totalExpenses >= 0
                        ? "text-[#4CC4A4]" : "text-[#D97070]"
                    }`}>
                      {breakdown.totalIncome - breakdown.totalExpenses >= 0 ? "+" : ""}
                      {formatCurrency(breakdown.totalIncome - breakdown.totalExpenses, locale)}
                    </p>
                  </div>

                  {/* Income side */}
                  {breakdown.incomeCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#4CC4A4] mb-3">
                        Money In
                      </p>
                      <div className="space-y-3">
                        {breakdown.incomeCategories.map((cat) => {
                          const pct  = cashflowScale > 0 ? Math.round((cat.total / cashflowScale) * 100) : 0;
                          const name = tCategories.has(cat.category) ? tCategories(cat.category) : cat.category;
                          return (
                            <button
                              key={cat.category}
                              onClick={() => openCategory(cat.category, "income")}
                              className="w-full text-left group"
                            >
                              <div className="flex justify-between items-center text-sm mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-[#4CC4A4] font-bold flex-shrink-0">+</span>
                                  <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize truncate">
                                    {name}
                                  </span>
                                  <span className="text-xs text-[#4A7A9B] flex-shrink-0">{cat.count} tx</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                  <span className="font-medium text-[#4CC4A4]">{formatCurrency(cat.total, locale)}</span>
                                  <span className="text-[#2A4F6A] group-hover:text-[#4A7A9B]">›</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#4CC4A4] rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expenses side */}
                  {breakdown.expenseCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A254] mb-3">
                        Money Out
                      </p>
                      <div className="space-y-3">
                        {breakdown.expenseCategories.map((cat) => {
                          const pct  = cashflowScale > 0 ? Math.round((cat.total / cashflowScale) * 100) : 0;
                          const name = tCategories.has(cat.category) ? tCategories(cat.category) : cat.category;
                          return (
                            <button
                              key={cat.category}
                              onClick={() => openCategory(cat.category, "expense")}
                              className="w-full text-left group"
                            >
                              <div className="flex justify-between items-center text-sm mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-[#D4A254] font-bold flex-shrink-0">−</span>
                                  <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize truncate">
                                    {name}
                                  </span>
                                  <span className="text-xs text-[#4A7A9B] flex-shrink-0">{cat.count} tx</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                  <span className="font-medium text-[#D4A254]">{formatCurrency(cat.total, locale)}</span>
                                  <span className="text-[#2A4F6A] group-hover:text-[#4A7A9B]">›</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#D4A254] rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Level 2: Category transactions ────────────────────────────── */}
        {view === "category" && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
              <div className="flex items-start gap-3">
                <button
                  onClick={backToMonth}
                  className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                    text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors"
                  aria-label="Back"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-1">
                    {month?.label} · {selCat?.type === "income" ? "Income" : "Expenses"}
                  </p>
                  <h2 className="text-xl font-bold text-[#E8F0F8] capitalize">{displayCat}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                  text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Summary bar */}
            {txData && (
              <div className="flex gap-6 px-6 py-4 bg-[#0A1C2E] border-b border-[#1E3A55]">
                <div>
                  <p className="text-xs text-[#4A7A9B] mb-0.5">Total</p>
                  <p className={`text-lg font-bold ${accent.text}`}>
                    {formatCurrency(txData.total, locale)}
                  </p>
                </div>
                <div className="w-px bg-[#1E3A55]" />
                <div>
                  <p className="text-xs text-[#4A7A9B] mb-0.5">Transactions</p>
                  <p className="text-lg font-bold text-[#E8F0F8]">{txData.count}</p>
                </div>
              </div>
            )}

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto">
              {txLoading && (
                <div className="flex items-center justify-center h-40 text-[#4A7A9B] text-sm">
                  Loading transactions…
                </div>
              )}
              {txData && txData.transactions.length === 0 && (
                <div className="px-6 py-8 text-center text-[#4A7A9B] text-sm">
                  No transactions found.
                </div>
              )}
              {txData && txData.transactions.length > 0 && (
                <ul className="divide-y divide-[#152D45]">
                  {txData.transactions.map((tx) => (
                    <li key={tx.id} className="px-6 py-4 hover:bg-[#0F2840] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#4A7A9B] mb-0.5">{fmtDate(tx.transactionDate)}</p>
                          <p className="text-sm font-medium text-[#C8DCF0] truncate">{tx.description}</p>
                          <div className="mt-1.5">
                            <IntentBadge intent={tx.intent} />
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${accent.text} tabular-nums flex-shrink-0 mt-4`}>
                          {formatCurrency(tx.amount, locale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#1E3A55]">
              <a
                href={`/history?category=${encodeURIComponent(selCat?.category ?? "")}&type=${selCat?.type ?? "expense"}`}
                className="block w-full text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4]
                  bg-[#0F2A3D] hover:bg-[#132F45] border border-[#1E3A55] rounded-xl py-2.5 transition-colors"
              >
                View all in History →
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Main TrendsChart component ────────────────────────────────────────────────

export default function TrendsChart({ data, trajectoryInsight, trajectoryDetails }: Props) {
  const t      = useTranslations("dashboard.trendsChart");
  const tm     = useTranslations("metrics");
  const locale = useLocale() as Locale;

  const [range,  setRange]  = useState(999);
  const [selMonth, setSelMonth] = useState<SelectedMonth | null>(null);
  const closeDrawer = useCallback(() => setSelMonth(null), []);

  const sliced = range === 999 ? data : data.slice(-range);

  if (data.length === 0) {
    return (
      <div className="card flex items-center justify-center h-56">
        <p className="text-[#7BA8C4]">{t("uploadPrompt")}</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (chartData: any) => {
    const payload = chartData?.activePayload?.[0]?.payload as DataPoint | undefined;
    if (payload?.year && payload?.monthNum) {
      setSelMonth({ year: payload.year, monthNum: payload.monthNum, label: payload.month });
    }
  };

  return (
    <>
      <div className="card">
        <div className="mb-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="label mb-1">{t("label")}</p>
              <h3 className="text-lg font-semibold text-[#E8F0F8]">{t("title")}</h3>
            </div>
          </div>
          <div className="flex gap-1.5">
            {TIME_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.months)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  range === r.months
                    ? "bg-[#3AB5A0] text-[#0D1B2B]"
                    : "bg-[#1A3048] text-[#7BA8C4] hover:text-[#E8F0F8]"
                }`}
              >
                {t(`ranges.${r.key}`)}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={sliced}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            onClick={handleChartClick}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#243F5E" />
            <XAxis dataKey="month" stroke="#6A97B4" tick={{ fontSize: 12, fill: "#6A97B4" }} />
            <YAxis
              stroke="#6A97B4"
              tick={{ fontSize: 12, fill: "#6A97B4" }}
              tickFormatter={(v) => locale === "fr" ? `${(v/1000).toFixed(0)}k €` : `€${(v/1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => formatCurrency(value, locale)}
              labelStyle={{ color: "#E8F0F8", fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ paddingTop: "1rem", fontSize: 12, color: "#7BA8C4" }} />
            <Line type="monotone" dataKey="income"   stroke="#4CC4A4" strokeWidth={2}   dot={false} activeDot={{ r: 5, fill: "#4CC4A4" }} name={tm("income")}   />
            <Line type="monotone" dataKey="expenses" stroke="#D4A254" strokeWidth={2}   dot={false} activeDot={{ r: 5, fill: "#D4A254" }} name={tm("expenses")} />
            <Line type="monotone" dataKey="cashflow" stroke="#3AB5A0" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: "#3AB5A0" }} name={tm("cashflow")} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>

        <p className="text-xs text-[#4A7A9B] text-center mt-2">
          Tap any month to see the breakdown
        </p>

        {trajectoryInsight && (
          <div className="mt-4 bg-[#4CC4A40A] border border-[#4CC4A418] rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-[#E8F0F8]">
              <InsightText insight={trajectoryInsight} />
            </p>
            {trajectoryDetails && trajectoryDetails.length > 0 && (
              <ul className="space-y-1">
                {trajectoryDetails.map((line, i) => (
                  <li key={i} className="text-sm text-[#A8C6E0] flex items-start gap-2">
                    <span className="text-[#4CC4A4] opacity-70 flex-shrink-0 mt-0.5">·</span>
                    <span><InsightText insight={line} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <MonthDrawer month={selMonth} onClose={closeDrawer} locale={locale} />
    </>
  );
}
