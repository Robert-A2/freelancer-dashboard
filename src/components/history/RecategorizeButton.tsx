"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const ALL_CATEGORIES = [
  // Income
  "income", "stripe", "paypal", "client payment", "invoice payment",
  "freelance platform", "bank transfer", "salary", "refund",
  // Expense
  "ai tools", "software", "marketing", "advertising", "education",
  "equipment", "office", "banking fees", "transport", "travel",
  "food", "health", "housing", "utilities", "subscriptions", "taxes",
  "uncategorized",
  // Special
  "savings", "transfer",
].sort();

interface Props {
  transactionId: string;
  currentCategory: string;
  description: string;
}

type Step = "idle" | "picking" | "confirming";

export default function RecategorizeButton({ transactionId, currentCategory, description }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const [step, setStep]       = useState<Step>("idle");
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) reset();
    }
    if (step !== "idle") document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [step]);

  function reset() { setStep("idle"); setPending(null); }

  function pickCategory(cat: string) {
    if (cat === currentCategory) { reset(); return; }
    setPending(cat);
    setStep("confirming");
  }

  async function save(applyToSimilar: boolean) {
    if (!pending) return;
    setSaving(true);
    reset();

    await fetch("/api/transactions/recategorize", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, newCategory: pending, applyToSimilar }),
    });

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  const chipBase = "text-xs px-1.5 py-0.5 rounded capitalize flex items-center gap-1 transition-colors";

  return (
    <div className="relative" ref={ref}>
      {/* Category chip */}
      <button
        onClick={() => step === "idle" ? setStep("picking") : reset()}
        disabled={saving}
        className={`${chipBase} ${
          saved    ? "bg-[#22C55E20] text-[#22C55E]" :
          saving   ? "bg-[#1E293B] text-[#94A3B8] opacity-60 cursor-wait" :
          step !== "idle" ? "bg-[#14B8A620] text-[#14B8A6]" :
          "bg-[#1E293B] text-[#94A3B8] hover:bg-[#334155] hover:text-[#F8FAFC]"
        }`}
        title="Click to fix category"
      >
        {saving ? "saving…" : saved ? "✓ saved" : step === "confirming" ? (pending ?? currentCategory) : currentCategory}
        {!saving && !saved && (
          <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={step !== "idle" ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
          </svg>
        )}
      </button>

      {/* Step 1 — pick a category */}
      {step === "picking" && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl shadow-black/60 w-52 overflow-hidden">
          <p className="px-3 py-2 text-[10px] text-[#94A3B8] border-b border-[#334155] truncate">
            Change: "{description.slice(0, 28)}{description.length > 28 ? "…" : ""}"
          </p>
          <div className="max-h-56 overflow-y-auto">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => pickCategory(cat)}
                className={`w-full text-left px-3 py-2 text-xs capitalize transition-colors ${
                  cat === currentCategory
                    ? "bg-[#14B8A620] text-[#14B8A6]"
                    : "text-[#CBD5E1] hover:bg-[#334155] hover:text-[#F8FAFC]"
                }`}
              >
                {cat === currentCategory ? `${cat} ✓` : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — confirm scope */}
      {step === "confirming" && pending && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl shadow-black/60 w-64 p-3 space-y-2">
          <p className="text-xs text-[#F8FAFC] font-medium">
            Move to <span className="text-[#14B8A6] capitalize">{pending}</span>
          </p>
          <p className="text-[10px] text-[#94A3B8] leading-relaxed">
            Apply to just this transaction, or to every transaction with the same description?
          </p>
          <div className="flex flex-col gap-1.5 pt-1">
            <button
              onClick={() => save(false)}
              className="text-xs text-left px-3 py-2 bg-[#334155] hover:bg-[#475569] text-[#CBD5E1] rounded-lg transition-colors"
            >
              This transaction only
            </button>
            <button
              onClick={() => save(true)}
              className="text-xs text-left px-3 py-2 bg-[#14B8A620] hover:bg-[#14B8A630] text-[#14B8A6] rounded-lg transition-colors"
            >
              All "{description.slice(0, 22)}{description.length > 22 ? "…" : ""}" transactions
            </button>
            <button
              onClick={reset}
              className="text-[10px] text-[#94A3B8] hover:text-[#F8FAFC] text-center py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
