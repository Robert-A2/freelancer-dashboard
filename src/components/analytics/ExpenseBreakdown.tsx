"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";

// ── Types ────────────────────────────────────────────────────────────────────

export type BreakdownItem = {
  category: string;
  total: number;
  pct: number;
  trend: "growing" | "declining" | "stable" | null;
};

type ApiTransaction = {
  id: string;
  description: string;
  transactionDate: string;
  amount: number;
  intent: string | null;
  intentConfidence: string | null;
};

type ApiResponse = {
  category: string;
  total: number;
  count: number;
  transactions: ApiTransaction[];
};

// ── Intent display helpers ────────────────────────────────────────────────────

const INTENT_LABEL: Record<string, string> = {
  personal_expense:  "Personal",
  business_expense:  "Business",
  subscription:      "Subscription",
  tax_payment:       "Tax",
  savings_transfer:  "Savings",
  family_support:    "Family",
  investment:        "Investment",
  loan_repayment:    "Loan",
  owner_draw:        "Owner Draw",
  freelance_income:  "Freelance",
  salary:            "Salary",
  passive_income:    "Passive income",
  refund:            "Refund",
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
};

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-xs text-[#4A6B85] italic">No intent</span>;
  const label = INTENT_LABEL[intent] ?? intent.replace(/_/g, " ");
  const color = INTENT_COLOR[intent] ?? "bg-[#1A3048] text-[#7BA8C4]";
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function CategoryDrawer({
  category,
  onClose,
  locale,
}: {
  category: string | null;
  onClose: () => void;
  locale: Locale;
}) {
  const tCategories = useTranslations("categories");
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Fetch when category changes
  useEffect(() => {
    if (!category) { setData(null); return; }
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/analytics/category-transactions?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load transactions."); setLoading(false); });
  }, [category]);

  // Lock body scroll while open
  useEffect(() => {
    if (category) document.body.style.overflow = "hidden";
    else          document.body.style.overflow  = "";
    return () => { document.body.style.overflow = ""; };
  }, [category]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOpen = !!category;
  const displayName = category
    ? (tCategories.has(category) ? tCategories(category) : category)
    : "";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-[#0D2137] border-l border-[#1E3A55] shadow-2xl
          flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-1">
              Expense Breakdown
            </p>
            <h2 className="text-xl font-bold text-[#E8F0F8] capitalize">{displayName}</h2>
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
        {data && (
          <div className="flex gap-6 px-6 py-4 bg-[#0A1C2E] border-b border-[#1E3A55]">
            <div>
              <p className="text-xs text-[#4A7A9B] mb-0.5">Total</p>
              <p className="text-lg font-bold text-[#D4A254]">{formatCurrency(data.total, locale)}</p>
            </div>
            <div className="w-px bg-[#1E3A55]" />
            <div>
              <p className="text-xs text-[#4A7A9B] mb-0.5">Transactions</p>
              <p className="text-lg font-bold text-[#E8F0F8]">{data.count}</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40 text-[#4A7A9B] text-sm">
              Loading transactions…
            </div>
          )}

          {error && (
            <div className="px-6 py-8 text-center text-[#D97070] text-sm">{error}</div>
          )}

          {data && data.transactions.length === 0 && (
            <div className="px-6 py-8 text-center text-[#4A7A9B] text-sm">
              No transactions found for this category.
            </div>
          )}

          {data && data.transactions.length > 0 && (
            <ul className="divide-y divide-[#152D45]">
              {data.transactions.map((tx) => (
                <li key={tx.id} className="px-6 py-4 hover:bg-[#0F2840] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#4A7A9B] mb-0.5">{fmtDate(tx.transactionDate)}</p>
                      <p className="text-sm font-medium text-[#C8DCF0] truncate">{tx.description}</p>
                      <div className="mt-1.5">
                        <IntentBadge intent={tx.intent} />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-[#D4A254] tabular-nums flex-shrink-0 mt-4">
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
            href={`/history?category=${encodeURIComponent(category ?? "")}&type=expense`}
            className="block w-full text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4]
              bg-[#0F2A3D] hover:bg-[#132F45] border border-[#1E3A55] rounded-xl py-2.5 transition-colors"
          >
            View all in History →
          </a>
        </div>
      </div>
    </>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function ExpenseBreakdown({
  breakdown,
  labels,
}: {
  breakdown: BreakdownItem[];
  labels: { title: string; subtitle: string; empty: string };
}) {
  const locale = useLocale() as Locale;
  const tCategories = useTranslations("categories");
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      <div className="card">
        <p className="label mb-1">{labels.title}</p>
        <p className="text-xs text-[#6A97B4] mb-4">{labels.subtitle}</p>

        {breakdown.length === 0 ? (
          <p className="text-[#7BA8C4] text-sm">{labels.empty}</p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((item) => {
              const arrow =
                item.trend === "growing"   ? "↑" :
                item.trend === "declining" ? "↓" : "";
              const arrowColor =
                item.trend === "growing"   ? "text-[#D97070]" : "text-[#4CC4A4]";
              const displayName = tCategories.has(item.category)
                ? tCategories(item.category)
                : item.category;

              return (
                <button
                  key={item.category}
                  onClick={() => setSelected(item.category)}
                  className="w-full text-left group"
                >
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors capitalize">
                        {displayName}
                      </span>
                      {arrow && (
                        <span className={`text-xs font-bold ${arrowColor}`}>{arrow}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#6A97B4]">{item.pct}%</span>
                      <span className="font-medium text-[#D4A254]">
                        {formatCurrency(item.total, locale)}
                      </span>
                      {/* Chevron hint */}
                      <svg
                        width="12" height="12" viewBox="0 0 12 12" fill="none"
                        className="text-[#2A4F6A] group-hover:text-[#4A7A9B] transition-colors flex-shrink-0"
                      >
                        <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#243F5E] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#D4A254] rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CategoryDrawer category={selected} onClose={close} locale={locale} />
    </>
  );
}
