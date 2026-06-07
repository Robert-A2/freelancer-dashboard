"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const ALL_CATEGORIES = [
  "income", "stripe", "paypal", "client payment", "invoice payment",
  "freelance platform", "bank transfer", "salary", "refund",
  "ai tools", "software", "marketing", "advertising", "education",
  "equipment", "office", "banking fees", "transport", "travel",
  "food", "health", "housing", "utilities", "subscriptions", "taxes",
  "uncategorized", "savings", "transfer",
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
      <button
        onClick={() => step === "idle" ? setStep("picking") : reset()}
        disabled={saving}
        className={`${chipBase} ${
          saved    ? "bg-[#4CC4A415] text-[#4CC4A4]" :
          saving   ? "bg-[#1A3048] text-[#6A97B4] opacity-60 cursor-wait" :
          step !== "idle" ? "bg-[#3AB5A015] text-[#3AB5A0]" :
          "bg-[#1A3048] text-[#7BA8C4] hover:bg-[#243F5E] hover:text-[#E8F0F8]"
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

      {step === "picking" && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[#132537] border border-[#243F5E] rounded-xl shadow-lg shadow-black/5 w-52 overflow-hidden">
          <p className="px-3 py-2 text-xs text-[#6A97B4] border-b border-[#243F5E] truncate">
            Change: &quot;{description.slice(0, 28)}{description.length > 28 ? "…" : ""}&quot;
          </p>
          <div className="max-h-56 overflow-y-auto">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => pickCategory(cat)}
                className={`w-full text-left px-3 py-2 text-xs capitalize transition-colors ${
                  cat === currentCategory
                    ? "bg-[#3AB5A015] text-[#3AB5A0]"
                    : "text-[#E8F0F8] hover:bg-[#1A3048] hover:text-[#E8F0F8]"
                }`}
              >
                {cat === currentCategory ? `${cat} ✓` : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "confirming" && pending && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[#132537] border border-[#243F5E] rounded-xl shadow-lg shadow-black/5 w-64 p-3 space-y-2">
          <p className="text-xs text-[#E8F0F8] font-medium">
            Move to <span className="text-[#3AB5A0] capitalize">{pending}</span>
          </p>
          <p className="text-xs text-[#7BA8C4] leading-relaxed">
            Apply to just this transaction, or to every transaction with the same description?
          </p>
          <div className="flex flex-col gap-1.5 pt-1">
            <button
              onClick={() => save(false)}
              className="text-xs text-left px-3 py-2 bg-[#1A3048] hover:bg-[#243F5E] text-[#E8F0F8] rounded-lg transition-colors"
            >
              This transaction only
            </button>
            <button
              onClick={() => save(true)}
              className="text-xs text-left px-3 py-2 bg-[#3AB5A015] hover:bg-[#3AB5A025] text-[#3AB5A0] rounded-lg transition-colors"
            >
              All &quot;{description.slice(0, 22)}{description.length > 22 ? "…" : ""}&quot; transactions
            </button>
            <button
              onClick={reset}
              className="text-xs text-[#6A97B4] hover:text-[#7BA8C4] text-center py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
