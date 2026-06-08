"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  importId: string;
  fileName: string;
  importedRows: number;
}

type Step = "idle" | "confirming" | "deleting";

export default function DeleteImportButton({ importId, fileName, importedRows }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setStep((s) => (s === "confirming" ? "idle" : s));
    }
    if (step === "confirming") document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [step]);

  async function confirmDelete() {
    setStep("deleting");
    setError(null);
    const res = await fetch(`/api/uploads/${importId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete this import. Please try again.");
      setStep("idle");
      return;
    }
    setStep("idle");
    router.refresh();
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setStep(step === "idle" ? "confirming" : "idle")}
        disabled={step === "deleting"}
        title={`Delete "${fileName}" and its imported transactions`}
        className={`text-xs px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
          step === "deleting"
            ? "bg-[#1A3048] text-[#6A97B4] opacity-60 cursor-wait"
            : step === "confirming"
            ? "bg-[#D9707020] text-[#D97070]"
            : "bg-[#1A3048] text-[#7BA8C4] hover:bg-[#D9707020] hover:text-[#D97070]"
        }`}
      >
        {step === "deleting" ? "deleting…" : "Delete"}
      </button>

      {error && (
        <p className="absolute right-0 top-full mt-1 z-50 text-xs text-[#D97070] whitespace-nowrap">{error}</p>
      )}

      {step === "confirming" && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#132537] border border-[#243F5E] rounded-xl shadow-lg shadow-black/5 w-60 p-3 space-y-2">
          <p className="text-xs text-[#E8F0F8] leading-relaxed">
            Delete <span className="font-medium">{fileName}</span> and its{" "}
            <span className="text-[#D97070] font-medium">{importedRows.toLocaleString()}</span> imported transaction{importedRows !== 1 ? "s" : ""}? This can&apos;t be undone.
          </p>
          <div className="flex flex-col gap-1.5 pt-1">
            <button
              onClick={confirmDelete}
              className="text-xs text-left px-3 py-2 bg-[#D9707020] hover:bg-[#D9707030] text-[#D97070] rounded-lg transition-colors"
            >
              Delete permanently
            </button>
            <button
              onClick={() => setStep("idle")}
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
