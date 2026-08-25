"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import RecategorizeButton from "./RecategorizeButton";

const INITIAL = 15;

const TYPE_COLORS: Record<string, string> = {
  income: "text-[#4CC4A4]", expense: "text-[#D4A254]",
  savings: "text-[#7BA8C4]", transfer: "text-[#6A97B4]",
};
const TYPE_PREFIX: Record<string, string> = {
  income: "+", expense: "−", savings: "→", transfer: "⇄",
};

const EDIT_CATEGORIES = ["food", "transport", "software", "business services", "housing", "insurance", "equipment", "client payment", "uncategorized"];

interface TxRow {
  id: string;
  description: string;
  transactionDate: string;
  category: string;
  categoryConfidence?: string;
  /** Set only when the Decision Engine produced this category — see computeDecisionScore()'s reason. */
  categoryReason?: string | null;
  transactionType: string;
  amount: number;
  /** Manual-entry rows only (csvImportId === null) get Edit/Delete — CSV rows keep RecategorizeButton only. */
  isManual?: boolean;
}

function EditRow({ tx, onDone, onCancel }: { tx: TxRow; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("history.transactionList");
  const tCat = useTranslations("categories");
  const [description, setDescription] = useState(tx.description);
  const [amount, setAmount] = useState(String(tx.amount));
  const [category, setCategory] = useState(tx.category);
  const [date, setDate] = useState(tx.transactionDate.slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || !description.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/manual/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, description: description.trim(), category, date }),
      });
      if (res.ok) onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-3 space-y-2 bg-[#0F2840] -mx-4 px-4 rounded-lg">
      <div className="flex gap-2">
        <input className="input text-sm py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input inputMode="decimal" className="input text-sm py-2 w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <select className="input text-sm py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{tCat.has(c) ? tCat(c) : c}</option>)}
        </select>
        <input type="date" className="input text-sm py-2" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost text-xs px-3 py-1.5">{t("cancel")}</button>
        <button disabled={saving} onClick={save} className="btn-primary text-xs px-3 py-1.5 min-h-0">{t("save")}</button>
      </div>
    </div>
  );
}

export default function TransactionList({ transactions }: { transactions: TxRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations("history.transactionList");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const visible   = expanded ? transactions : transactions.slice(0, INITIAL);
  const remaining = transactions.length - INITIAL;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/manual/${id}`, { method: "DELETE" });
      if (res.ok) { setConfirmDeleteId(null); router.refresh(); }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card">
      <div className="divide-y divide-[#243F5E]">
        {visible.map((tx) => (
          editingId === tx.id ? (
            <EditRow key={tx.id} tx={tx} onCancel={() => setEditingId(null)} onDone={() => { setEditingId(null); router.refresh(); }} />
          ) : (
          <div key={tx.id} className="flex items-center justify-between py-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#E8F0F8] truncate">{tx.description}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-[#6A97B4]">
                  {new Date(tx.transactionDate).toLocaleDateString(INTL_LOCALES[locale], {
                    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
                  })}
                </p>
                {!tx.isManual && (
                  <RecategorizeButton
                    transactionId={tx.id}
                    currentCategory={tx.category}
                    description={tx.description}
                  />
                )}
                {tx.categoryReason ? (
                  // Decision Engine explanation — set whenever categorySource
                  // is "intelligence" (medium or high tier), per the
                  // "automatic categorization with explanation" behavior.
                  <span
                    className="w-4 h-4 rounded-full bg-[#4CC4A415] text-[#4CC4A4] text-[10px] font-semibold flex items-center justify-center flex-shrink-0"
                    title={tx.categoryReason}
                  >
                    i
                  </span>
                ) : tx.categoryConfidence === "low" && (
                  <span
                    className="w-4 h-4 rounded-full bg-[#D4A25415] text-[#D4A254] text-[10px] font-semibold flex items-center justify-center flex-shrink-0"
                    title={t("lowConfidence")}
                  >
                    ?
                  </span>
                )}
                {tx.isManual && (
                  <span className="text-[10px] uppercase tracking-wide text-[#4A7A9B]" title={t("manualTagHint")}>{t("manualTag")}</span>
                )}
              </div>
            </div>

            {confirmDeleteId === tx.id ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[#D4A254]">{t("confirmDelete")}</span>
                <button disabled={deletingId === tx.id} onClick={() => handleDelete(tx.id)} className="text-xs font-semibold text-[#E5484D] hover:text-[#F87171]">
                  {t("confirmDeleteYes")}
                </button>
                <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-[#7BA8C4] hover:text-[#A8C6E0]">
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-shrink-0">
                {tx.isManual && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setEditingId(tx.id)} aria-label={t("edit")}
                      className="w-6 h-6 flex items-center justify-center rounded text-[#6A97B4] hover:text-[#E8F0F8] hover:bg-[#1E3446] transition-colors">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                    </button>
                    <button onClick={() => setConfirmDeleteId(tx.id)} aria-label={t("delete")}
                      className="w-6 h-6 flex items-center justify-center rounded text-[#6A97B4] hover:text-[#E5484D] hover:bg-[#1E3446] transition-colors">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5m-6 0L4 13a1 1 0 001 1h6a1 1 0 001-1l.5-8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                )}
                <span className={`text-sm font-semibold whitespace-nowrap ${TYPE_COLORS[tx.transactionType] ?? "text-[#7BA8C4]"}`}>
                  {TYPE_PREFIX[tx.transactionType]}{formatCurrency(tx.amount, locale)}
                </span>
              </div>
            )}
          </div>
          )
        ))}
      </div>

      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A3048] hover:bg-[#1E3550] text-sm text-[#A8C6E0] font-medium transition-colors"
        >
          {t("showMore", { count: remaining })}
          <svg className="w-4 h-4 text-[#6A97B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {expanded && transactions.length > INITIAL && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A3048] hover:bg-[#1E3550] text-sm text-[#A8C6E0] font-medium transition-colors"
        >
          {t("showLess")}
          <svg className="w-4 h-4 text-[#6A97B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
