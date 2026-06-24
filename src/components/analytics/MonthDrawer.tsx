"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";

const KNOWN_INTENTS = new Set([
  "personal_expense","business_expense","subscription","tax_payment",
  "savings_transfer","family_support","investment","loan_repayment",
  "owner_draw","freelance_income","salary","passive_income","refund",
]);

// ── Shared types ──────────────────────────────────────────────────────────────

export type SelectedMonth = { year: number; monthNum: number; label: string };

type SelectedCat = { category: string; type: "expense" | "income" };

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

// ── Intent helpers ────────────────────────────────────────────────────────────

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

function IntentBadge({ intent }: { intent: string | null }) {
  const tIntent = useTranslations("intent");
  if (!intent) return <span className="text-xs text-[#4A6B85] italic">—</span>;
  const label = KNOWN_INTENTS.has(intent) ? tIntent(`labels.${intent}` as never) : intent.replace(/_/g, " ");
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

// ── MonthDrawer ───────────────────────────────────────────────────────────────

export default function MonthDrawer({
  month,
  onClose,
  locale,
  apiBase = "/api",
}: {
  month: SelectedMonth | null;
  onClose: () => void;
  locale: Locale;
  apiBase?: string;
}) {
  const tCategories = useTranslations("categories");
  const tM          = useTranslations("analytics.monthDrawer");
  const tMetrics    = useTranslations("metrics");

  const [breakdown, setBreakdown] = useState<MonthBreakdown | null>(null);
  const [bLoading,  setBLoading]  = useState(false);
  const [view,      setView]      = useState<"month" | "category">("month");
  const [selCat,    setSelCat]    = useState<SelectedCat | null>(null);
  const [txData,    setTxData]    = useState<TxData | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"expense" | "income" | "cashflow">("cashflow");

  // Fetch month breakdown
  useEffect(() => {
    if (!month) { setBreakdown(null); setView("month"); setSelCat(null); return; }
    setBLoading(true);
    setBreakdown(null);
    setView("month");
    setSelCat(null);
    setTxData(null);
    setActiveTab("cashflow");
    fetch(`${apiBase}/analytics/month-breakdown?year=${month.year}&month=${month.monthNum}`)
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
    fetch(`${apiBase}/analytics/category-transactions?${p}`)
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

  const tabCategories = breakdown && activeTab !== "cashflow"
    ? (activeTab === "expense" ? breakdown.expenseCategories : breakdown.incomeCategories)
    : [];
  const tabTotal       = tabCategories.reduce((s, c) => s + c.total, 0);
  const cashflowScale  = breakdown
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
        {/* ── Level 1: Month overview ──────────────────────────────────────── */}
        {view === "month" && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-1">
                  {tM("title")}
                </p>
                <h2 className="text-xl font-bold text-[#E8F0F8]">{month?.label}</h2>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                  text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Summary pills */}
            {breakdown && (
              <div className="flex gap-4 px-6 py-4 bg-[#0A1C2E] border-b border-[#1E3A55]">
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#4A7A9B] mb-0.5">{tMetrics("income")}</p>
                  <p className="text-lg font-bold text-[#4CC4A4]">{formatCurrency(breakdown.totalIncome, locale)}</p>
                </div>
                <div className="w-px bg-[#1E3A55]" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#4A7A9B] mb-0.5">{tMetrics("expenses")}</p>
                  <p className="text-lg font-bold text-[#D4A254]">{formatCurrency(breakdown.totalExpenses, locale)}</p>
                </div>
                <div className="w-px bg-[#1E3A55]" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-[#4A7A9B] mb-0.5">{tMetrics("cashflow")}</p>
                  <p className={`text-lg font-bold ${
                    breakdown.totalIncome - breakdown.totalExpenses >= 0 ? "text-[#4CC4A4]" : "text-[#D97070]"
                  }`}>{formatCurrency(breakdown.totalIncome - breakdown.totalExpenses, locale)}</p>
                </div>
              </div>
            )}

            {/* Tabs */}
            {breakdown && (
              <div className="flex border-b border-[#1E3A55]">
                {(["income", "expense", "cashflow"] as const).map((tab) => {
                  const labels = { cashflow: tMetrics("cashflow"), expense: tMetrics("expenses"), income: tMetrics("income") };
                  const colors = {
                    cashflow: "border-[#3AB5A0] text-[#3AB5A0]",
                    expense:  "border-[#D4A254] text-[#D4A254]",
                    income:   "border-[#4CC4A4] text-[#4CC4A4]",
                  };
                  return (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === tab ? colors[tab] : "border-transparent text-[#4A7A9B] hover:text-[#A8C6E0]"
                      }`}>
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {bLoading && (
                <div className="flex items-center justify-center h-40 text-[#4A7A9B] text-sm">{tM("loading")}</div>
              )}

              {/* Expenses / Income tabs */}
              {breakdown && activeTab !== "cashflow" && tabCategories.length === 0 && (
                <div className="px-6 py-8 text-center text-[#4A7A9B] text-sm">
                  {activeTab === "expense" ? tM("noExpenseData") : tM("noIncomeData")}
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
                      <button key={cat.category} onClick={() => openCategory(cat.category, activeTab as "expense" | "income")}
                        className="w-full text-left group">
                        <div className="flex justify-between items-center text-sm mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize truncate">{name}</span>
                            <span className="text-xs text-[#4A7A9B] flex-shrink-0">{cat.count} tx</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <span className={`font-medium ${txtCl}`}>{formatCurrency(cat.total, locale)}</span>
                            <span className="text-[#2A4F6A] group-hover:text-[#4A7A9B]">›</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                          <div className={`h-full ${barCl} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cashflow tab */}
              {breakdown && activeTab === "cashflow" && (
                <div className="px-6 py-4 space-y-5">
                  {/* Net callout */}
                  <div className={`rounded-xl px-4 py-3 border ${
                    breakdown.totalIncome - breakdown.totalExpenses >= 0
                      ? "bg-[#0F2A1E] border-[#1A4030]"
                      : "bg-[#2A1010] border-[#40201A]"
                  }`}>
                    <p className="text-xs text-[#4A7A9B] mb-0.5">{tM("netCashflow")}</p>
                    <p className={`text-2xl font-bold ${
                      breakdown.totalIncome - breakdown.totalExpenses >= 0 ? "text-[#4CC4A4]" : "text-[#D97070]"
                    }`}>
                      {breakdown.totalIncome - breakdown.totalExpenses >= 0 ? "+" : ""}
                      {formatCurrency(breakdown.totalIncome - breakdown.totalExpenses, locale)}
                    </p>
                  </div>

                  {/* Money In */}
                  {breakdown.incomeCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#4CC4A4] mb-3">{tM("moneyIn")}</p>
                      <div className="space-y-3">
                        {breakdown.incomeCategories.map((cat) => {
                          const pct  = cashflowScale > 0 ? Math.round((cat.total / cashflowScale) * 100) : 0;
                          const name = tCategories.has(cat.category) ? tCategories(cat.category) : cat.category;
                          return (
                            <button key={cat.category} onClick={() => openCategory(cat.category, "income")}
                              className="w-full text-left group">
                              <div className="flex justify-between items-center text-sm mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-[#4CC4A4] font-bold flex-shrink-0">+</span>
                                  <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize truncate">{name}</span>
                                  <span className="text-xs text-[#4A7A9B] flex-shrink-0">{cat.count} tx</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                  <span className="font-medium text-[#4CC4A4]">{formatCurrency(cat.total, locale)}</span>
                                  <span className="text-[#2A4F6A] group-hover:text-[#4A7A9B]">›</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                                <div className="h-full bg-[#4CC4A4] rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Money Out */}
                  {breakdown.expenseCategories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#D4A254] mb-3">{tM("moneyOut")}</p>
                      <div className="space-y-3">
                        {breakdown.expenseCategories.map((cat) => {
                          const pct  = cashflowScale > 0 ? Math.round((cat.total / cashflowScale) * 100) : 0;
                          const name = tCategories.has(cat.category) ? tCategories(cat.category) : cat.category;
                          return (
                            <button key={cat.category} onClick={() => openCategory(cat.category, "expense")}
                              className="w-full text-left group">
                              <div className="flex justify-between items-center text-sm mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-[#D4A254] font-bold flex-shrink-0">−</span>
                                  <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize truncate">{name}</span>
                                  <span className="text-xs text-[#4A7A9B] flex-shrink-0">{cat.count} tx</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                  <span className="font-medium text-[#D4A254]">{formatCurrency(cat.total, locale)}</span>
                                  <span className="text-[#2A4F6A] group-hover:text-[#4A7A9B]">›</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                                <div className="h-full bg-[#D4A254] rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                                  style={{ width: `${pct}%` }} />
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

        {/* ── Level 2: Category transactions ──────────────────────────────── */}
        {view === "category" && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
              <div className="flex items-start gap-3">
                <button onClick={backToMonth} aria-label="Back"
                  className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                    text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-1">
                    {month?.label} · {selCat?.type === "income" ? tMetrics("income") : tMetrics("expenses")}
                  </p>
                  <h2 className="text-xl font-bold text-[#E8F0F8] capitalize">{displayCat}</h2>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                  text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Summary bar */}
            {txData && (
              <div className="flex gap-6 px-6 py-4 bg-[#0A1C2E] border-b border-[#1E3A55]">
                <div>
                  <p className="text-xs text-[#4A7A9B] mb-0.5">{tM("total")}</p>
                  <p className={`text-lg font-bold ${accent.text}`}>{formatCurrency(txData.total, locale)}</p>
                </div>
                <div className="w-px bg-[#1E3A55]" />
                <div>
                  <p className="text-xs text-[#4A7A9B] mb-0.5">{tM("transactionsCount")}</p>
                  <p className="text-lg font-bold text-[#E8F0F8]">{txData.count}</p>
                </div>
              </div>
            )}

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto">
              {txLoading && (
                <div className="flex items-center justify-center h-40 text-[#4A7A9B] text-sm">
                  {tM("loadingTransactions")}
                </div>
              )}
              {txData && txData.transactions.length === 0 && (
                <div className="px-6 py-8 text-center text-[#4A7A9B] text-sm">{tM("noTransactions")}</div>
              )}
              {txData && txData.transactions.length > 0 && (
                <ul className="divide-y divide-[#152D45]">
                  {txData.transactions.map((tx) => (
                    <li key={tx.id} className="px-6 py-4 hover:bg-[#0F2840] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#4A7A9B] mb-0.5">{fmtDate(tx.transactionDate)}</p>
                          <p className="text-sm font-medium text-[#C8DCF0] truncate">{tx.description}</p>
                          <div className="mt-1.5"><IntentBadge intent={tx.intent} /></div>
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
              <a href={`/history?category=${encodeURIComponent(selCat?.category ?? "")}&type=${selCat?.type ?? "expense"}`}
                className="block w-full text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4]
                  bg-[#0F2A3D] hover:bg-[#132F45] border border-[#1E3A55] rounded-xl py-2.5 transition-colors">
                {tM("viewAllHistory")}
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
