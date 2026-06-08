"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "idle" | "confirming" | "running" | "done" | "error";

interface Summary {
  totalScanned: number;
  changedCount: number;
  newUncategorizedCount: number;
  newUncategorizedPct: number;
}

export default function RecategorizeAllButton() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [summary, setSummary] = useState<Summary | null>(null);

  async function run() {
    setStep("running");
    try {
      const res = await fetch("/api/transactions/recategorize-all", { method: "POST" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setSummary(data);
      setStep("done");
      router.refresh();
    } catch {
      setStep("error");
    }
  }

  if (step === "confirming") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-[#7BA8C4]">Re-check every transaction against the latest rules?</span>
        <button onClick={run} className="btn-secondary px-3 py-1.5 text-sm">Yes, re-run</button>
        <button onClick={() => setStep("idle")} className="text-sm text-[#6A97B4] hover:text-[#7BA8C4] transition-colors px-2">Cancel</button>
      </div>
    );
  }

  if (step === "running") {
    return <span className="text-sm text-[#7BA8C4]">Re-running categorization…</span>;
  }

  if (step === "done" && summary) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-[#3AB5A0]">
          ✓ Updated {summary.changedCount.toLocaleString()} of {summary.totalScanned.toLocaleString()} transactions —{" "}
          {summary.newUncategorizedPct}% still uncategorized
        </span>
        <button onClick={() => setStep("idle")} className="text-[#6A97B4] hover:text-[#7BA8C4] transition-colors px-2">Dismiss</button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-[#E08585]">Something went wrong — please try again.</span>
        <button onClick={() => setStep("idle")} className="text-[#6A97B4] hover:text-[#7BA8C4] transition-colors px-2">Dismiss</button>
      </div>
    );
  }

  return (
    <button onClick={() => setStep("confirming")} className="btn-secondary px-3 py-1.5 text-sm">
      Re-run categorization
    </button>
  );
}
