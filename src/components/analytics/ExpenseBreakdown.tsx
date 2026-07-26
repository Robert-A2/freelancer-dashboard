"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

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

const INTENT_COLOR: Record<string, string> = {
  personal_expense:  "bg-[#1E3A5F] text-[#7BB8E8]",
  business_expense:  "bg-[#1A3D30] text-[#4CC4A4]",
  subscription:      "bg-[#2D1F4A] text-[#A78BFA]",
  tax_payment:       "bg-[#3D2800] text-[#D4A254]",
  savings_transfer:  "bg-[#0F3338] text-[#3EC9BD]",
  family_support:    "bg-[#3D1A2A] text-[#F09EC0]",
  investment:        "bg-[#1A3030] text-[#34D399]",
  loan_repayment:    "bg-[#3D1A1A] text-[#F87171]",
  freelance_income:  "bg-[#0F3028] text-[#4CC4A4]",
  salary:            "bg-[#1A2D4A] text-[#60A5FA]",
  passive_income:    "bg-[#2A2810] text-[#FBBF24]",
  refund:            "bg-[#1A2040] text-[#A5B4FC]",
};

function IntentBadge({ intent, tIntent, noIntentLabel }: { intent: string | null; tIntent: ReturnType<typeof useTranslations>; noIntentLabel: string }) {
  if (!intent) return <span className="text-xs text-[#4A6B85] italic">{noIntentLabel}</span>;
  const label = tIntent.has(intent) ? tIntent(intent) : intent.replace(/_/g, " ");
  const color = INTENT_COLOR[intent] ?? "bg-[#1A3048] text-[#7BA8C4]";
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  );
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALES[locale], {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function CategoryDrawer({
  category,
  type,
  since,
  onClose,
  locale,
  accent,
  apiBase = "/api",
}: {
  category: string | null;
  type: "expense" | "income";
  since?: string;
  onClose: () => void;
  locale: Locale;
  accent: { text: string; bar: string };
  apiBase?: string;
}) {
  const tCategories = useTranslations("categories");
  const tDrawer = useTranslations("analytics.categoryDrawer");
  const tIntent = useTranslations("intent.labels");
  const tIntentRoot = useTranslations("intent");
  const tCommon = useTranslations("common");
  const noIntentLabel = tIntentRoot("noIntent");
  const closeBtnLabel = tCommon("buttons.close");
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [data, setData]       = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portal to document.body so a transformed ancestor (e.g. a hover-tilt
  // effect) can't hijack this drawer's fixed positioning off the real viewport.
  useEffect(() => { setMounted(true); }, []);

  // Focus close button when drawer opens for keyboard/screen-reader users
  useEffect(() => {
    if (category) closeBtnRef.current?.focus();
  }, [category]);

  useEffect(() => {
    if (!category) { setData(null); return; }
    setLoading(true);
    setError(null);
    setData(null);
    const failedMsg = tDrawer("failed");
    const params = new URLSearchParams({ category, type });
    if (since) params.set("since", since);
    fetch(`${apiBase}/analytics/category-transactions?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(failedMsg); setLoading(false); });
  }, [category, type, since]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (category) document.body.style.overflow = "hidden";
    else          document.body.style.overflow  = "";
    return () => { document.body.style.overflow = ""; };
  }, [category]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOpen = !!category;
  const displayName = category
    ? (tCategories.has(category) ? tCategories(category) : category)
    : "";
  const drawerLabel = type === "income" ? tDrawer("incomeSource") : tDrawer("expenseBreakdown");

  if (!mounted) return null;

  return createPortal(
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
        role="dialog"
        aria-modal="true"
        aria-label={drawerLabel}
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-[#0D2137] border-l border-[#1E3A55] shadow-2xl
          flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
          <div>
            <p className="label mb-1">{drawerLabel}</p>
            <h2 className="text-xl font-bold text-[#E8F0F8]">{displayName}</h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
              text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors"
            aria-label={closeBtnLabel}
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
              <p className="text-xs text-[#4A7A9B] mb-0.5">{tDrawer("total")}</p>
              <p className={`text-lg font-bold ${accent.text}`}>{formatCurrency(data.total, locale)}</p>
            </div>
            <div className="w-px bg-[#1E3A55]" />
            <div>
              <p className="text-xs text-[#4A7A9B] mb-0.5">{tDrawer("transactions")}</p>
              <p className="text-lg font-bold text-[#E8F0F8]">{data.count}</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto" role="status" aria-live="polite">
          {loading && (
            <div className="flex items-center justify-center h-40 text-[#4A7A9B] text-sm">
              {tDrawer("loading")}
            </div>
          )}
          {error && (
            <div className="px-6 py-8 text-center text-[#D97070] text-sm">{error}</div>
          )}
          {data && data.transactions.length === 0 && (
            <div className="px-6 py-8 text-center text-[#4A7A9B] text-sm">
              {tDrawer("empty")}
            </div>
          )}
          {data && data.transactions.length > 0 && (
            <ul className="divide-y divide-[#152D45]">
              {data.transactions.map((tx) => (
                <li key={tx.id} className="px-6 py-4 hover:bg-[#0F2840] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#4A7A9B] mb-0.5">{fmtDate(tx.transactionDate, locale)}</p>
                      <p className="text-sm font-medium text-[#C8DCF0] truncate">{tx.description}</p>
                      <div className="mt-1.5">
                        <IntentBadge intent={tx.intent} tIntent={tIntent} noIntentLabel={noIntentLabel} />
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
            href={`/history?category=${encodeURIComponent(category ?? "")}&type=${type}`}
            className="block w-full text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4]
              bg-[#0F2A3D] hover:bg-[#132F45] border border-[#1E3A55] rounded-xl py-2.5 transition-colors"
          >
            {tDrawer("viewAll")}
          </a>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Main exported component ───────────────────────────────────────────────────

const EXPENSE_ACCENT = { text: "text-[#D4A254]", bar: "bg-[#D4A254]" };
const INCOME_ACCENT  = { text: "text-[#4CC4A4]", bar: "bg-[#4CC4A4]" };

export default function ExpenseBreakdown({
  breakdown,
  labels,
  type = "expense",
  since,
  apiBase = "/api",
}: {
  breakdown: BreakdownItem[];
  labels: { title: string; subtitle: string; empty: string };
  type?: "expense" | "income";
  since?: string;
  apiBase?: string;
}) {
  const locale = useLocale() as Locale;
  const tCategories = useTranslations("categories");
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const accent = type === "income" ? INCOME_ACCENT : EXPENSE_ACCENT;

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
                      <span className="text-[#A8C6E0] group-hover:text-[#E8F0F8] transition-colors">
                        {displayName}
                      </span>
                      {arrow && (
                        <span className={`text-xs font-bold ${arrowColor}`}>{arrow}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#6A97B4]">{item.pct}%</span>
                      <span className={`font-medium ${accent.text}`}>
                        {formatCurrency(item.total, locale)}
                      </span>
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
                      className={`h-full ${accent.bar} rounded-full opacity-70 group-hover:opacity-100 transition-[width,opacity] duration-700 ease-out`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CategoryDrawer
        category={selected}
        type={type}
        since={since}
        onClose={close}
        locale={locale}
        accent={accent}
        apiBase={apiBase}
      />
    </>
  );
}
