"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  intent: string | null;
  intentConfidence: string | null;
  needsReview: boolean;
}

interface Props {
  transactions: Transaction[];
  notable?: Insight[];
}

// ── Intent key set (for translation lookup) ───────────────────────────────────

const KNOWN_INTENTS = new Set([
  "personal_expense","business_expense","subscription","tax_payment",
  "savings_transfer","family_support","investment","loan_repayment",
  "owner_draw","freelance_income","salary","passive_income","refund",
]);

// ── Display helpers ───────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  income:   "text-[#4CC4A4]",
  expense:  "text-[#D4A254]",
  savings:  "text-[#7BA8C4]",
  transfer: "text-[#6A97B4]",
};

const TYPE_PREFIX: Record<string, string> = {
  income: "+", expense: "−", savings: "→", transfer: "⇄",
};

const TYPE_BADGE: Record<string, string> = {
  income:   "bg-[#0F3028] text-[#4CC4A4]",
  expense:  "bg-[#3D2800] text-[#D4A254]",
  savings:  "bg-[#1A3048] text-[#7BA8C4]",
  transfer: "bg-[#1A2D40] text-[#6A97B4]",
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

// ── Transaction Drawer ────────────────────────────────────────────────────────

function TransactionDrawer({
  tx,
  onClose,
  locale,
}: {
  tx: Transaction | null;
  onClose: () => void;
  locale: Locale;
}) {
  const tCategories = useTranslations("categories");
  const tD          = useTranslations("dashboard.recentTransactions");
  const tIntent     = useTranslations("intent");

  // Scroll lock
  useEffect(() => {
    if (tx) document.body.style.overflow = "hidden";
    else     document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [tx]);

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOpen = !!tx;
  const amtColor = TYPE_STYLES[tx?.type ?? ""] ?? "text-[#E8F0F8]";
  const intentKey   = tx?.intent ?? null;
  const intentLabel = intentKey
    ? (KNOWN_INTENTS.has(intentKey) ? tIntent(`labels.${intentKey}` as never) : intentKey.replace(/_/g, " "))
    : null;
  const intentColor = intentKey ? (INTENT_COLOR[intentKey] ?? "bg-[#1A3048] text-[#7BA8C4]") : "";
  const intentWhy   = intentKey && KNOWN_INTENTS.has(intentKey)
    ? tIntent(`why.${intentKey}` as never)
    : null;
  const categoryName = tx
    ? (tCategories.has(tx.category) ? tCategories(tx.category) : tx.category)
    : "";

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
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-[#0D2137] border-l border-[#1E3A55]
          shadow-2xl flex flex-col transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-[#1E3A55]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-1">
              {tD("drawer.title")}
            </p>
            <p className="text-sm text-[#A8C6E0] leading-snug">
              {tx ? new Date(tx.date).toLocaleDateString(INTL_LOCALES[locale], {
                weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
              }) : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
              text-[#4A7A9B] hover:text-[#E8F0F8] hover:bg-[#1A3048] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Amount hero */}
        {tx && (
          <div className="px-6 py-6 bg-[#0A1C2E] border-b border-[#1E3A55]">
            <p className={`text-4xl font-bold tracking-tight ${amtColor}`}>
              {TYPE_PREFIX[tx.type]}{formatCurrency(tx.amount, locale)}
            </p>
            <p className="text-[#C8DCF0] text-base font-medium mt-2 leading-snug">
              {tx.description}
            </p>
          </div>
        )}

        {/* Body */}
        {tx && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Badges row */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${TYPE_BADGE[tx.type] ?? "bg-[#1A3048] text-[#7BA8C4]"}`}>
                {tx.type}
              </span>
              <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-[#1A3048] text-[#A8C6E0] capitalize">
                {categoryName}
              </span>
              {intentLabel && (
                <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${intentColor}`}>
                  {intentLabel}
                </span>
              )}
              {tx.needsReview && (
                <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-[#3D2800] text-[#D4A254]">
                  {tD("drawer.needsReview")}
                </span>
              )}
            </div>

            {/* Why section */}
            {intentLabel && (
              <div className="bg-[#0F2840] border border-[#1E3A55] rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-2">{tD("drawer.why")}</p>
                <p className="text-sm font-semibold text-[#E8F0F8] mb-1">{intentLabel}</p>
                {intentWhy && <p className="text-sm text-[#A8C6E0] leading-relaxed">{intentWhy}</p>}
                {tx.intentConfidence && (
                  <p className="text-xs text-[#4A7A9B] mt-2">
                    {tD("drawer.confidence")}: <span className="capitalize">{tx.intentConfidence}</span>
                  </p>
                )}
              </div>
            )}

            {/* Category */}
            <div className="bg-[#0F2840] border border-[#1E3A55] rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4A7A9B] mb-2">{tD("drawer.category")}</p>
              <p className="text-sm font-semibold text-[#E8F0F8] capitalize">{categoryName}</p>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1E3A55]">
          <Link
            href="/history"
            className="block w-full text-center text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4]
              bg-[#0F2A3D] hover:bg-[#132F45] border border-[#1E3A55] rounded-xl py-2.5 transition-colors"
          >
            {tD("drawer.viewAllHistory")}
          </Link>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecentTransactions({ transactions, notable }: Props) {
  const t = useTranslations("dashboard.recentTransactions");
  const tCategories = useTranslations("categories");
  const locale = useLocale() as Locale;

  const [selected, setSelected] = useState<Transaction | null>(null);
  const close = useCallback(() => setSelected(null), []);

  if (transactions.length === 0) {
    return (
      <div className="card">
        <p className="label mb-2">{t("label")}</p>
        <p className="text-[#7BA8C4] text-sm">{t("empty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <p className="label mb-3">{t("label")}</p>

        {notable && notable.length > 0 && (
          <div className="mb-3 space-y-1">
            {notable.map((note, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2.5 bg-[#1A3048] rounded-lg">
                <span className="text-[#3AB5A0] text-xs mt-0.5 flex-shrink-0">★</span>
                <p className="text-sm text-[#A8C6E0]">
                  <InsightText insight={note} />
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-0">
          {transactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => setSelected(tx)}
              className="w-full flex items-center justify-between py-3 border-b border-[#243F5E] last:border-0 gap-3 group text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#E8F0F8] truncate group-hover:text-white transition-colors">
                  {tx.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-[#6A97B4]">
                    {new Date(tx.date).toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", timeZone: "UTC" })}
                  </p>
                  <span className="text-xs px-1.5 py-0.5 bg-[#1A3048] rounded text-[#7BA8C4]">
                    {tCategories.has(tx.category) ? tCategories(tx.category) : tx.category}
                  </span>
                  {tx.needsReview && (
                    <span className="text-xs px-1.5 py-0.5 bg-[#3D2800] rounded text-[#D4A254]">!</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-sm font-semibold whitespace-nowrap ${TYPE_STYLES[tx.type] ?? "text-[#E8F0F8]"}`}>
                  {TYPE_PREFIX[tx.type]}{formatCurrency(tx.amount, locale)}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  className="text-[#2A4F6A] group-hover:text-[#4A7A9B] transition-colors flex-shrink-0">
                  <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-3 mt-1 border-t border-[#243F5E]">
          <Link
            href="/history"
            className="flex items-center justify-center gap-1.5 text-sm text-[#3AB5A0] hover:text-[#2E9D8A] font-medium transition-colors py-1"
          >
            {t("viewAll")}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>

      <TransactionDrawer tx={selected} onClose={close} locale={locale} />
    </>
  );
}
