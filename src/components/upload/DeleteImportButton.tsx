"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  importId: string;
  fileName: string;
  importedRows: number;
}

type Step = "idle" | "confirming" | "deleting";

export default function DeleteImportButton({ importId, fileName, importedRows }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

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

  if (step === "confirming") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#D97070]">
          Delete {importedRows.toLocaleString()} transaction{importedRows !== 1 ? "s" : ""}?
        </span>
        <button
          onClick={confirmDelete}
          className="text-xs px-2 py-1 rounded-lg bg-[#D9707020] text-[#D97070] hover:bg-[#D9707030] transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setStep("idle")}
          className="text-xs px-2 py-1 rounded-lg bg-[#1A3048] text-[#7BA8C4] hover:bg-[#243F5E] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-[#D97070]">{error}</span>}
      <button
        onClick={() => setStep("confirming")}
        disabled={step === "deleting"}
        title={`Delete "${fileName}" and its imported transactions`}
        className={`text-xs px-2 py-1 rounded-lg transition-colors ${
          step === "deleting"
            ? "bg-[#1A3048] text-[#6A97B4] opacity-60 cursor-wait"
            : "bg-[#1A3048] text-[#7BA8C4] hover:bg-[#D9707020] hover:text-[#D97070]"
        }`}
      >
        {step === "deleting" ? "deleting…" : "Delete"}
      </button>
    </div>
  );
}
