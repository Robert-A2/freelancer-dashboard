"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ImportResult {
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  skippedRows: number;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  categoriesDetected: number;
  currencies: string[];
  hasMixedCurrencies: boolean;
  typeBreakdown: { income: number; expense: number; savings: number; transfer: number } | null;
}

type Stage =
  | { status: "idle" }
  | { status: "uploading"; progress: number; fileName: string }
  | { status: "processing"; fileName: string }
  | { status: "done"; result: ImportResult; fileName: string }
  | { status: "error"; message: string };

export default function CsvUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>({ status: "idle" });

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setStage({ status: "error", message: "Only .csv files are supported." });
        return;
      }

      setStage({ status: "uploading", progress: 0, fileName: file.name });

      // ── Step 1: get a signed upload URL from our server ──────────────────
      const presignRes = await fetch(
        `/api/uploads/presign?filename=${encodeURIComponent(file.name)}`
      );

      const presignData = await presignRes.json();

      if (!presignRes.ok) {
        setStage({
          status: "error",
          message: presignData.error ?? "Failed to prepare upload. Please try again.",
        });
        return;
      }

      const { signedUrl, storagePath } = presignData;

      // ── Step 2: upload the file DIRECTLY to Supabase Storage ─────────────
      // This bypasses Vercel entirely — no 4.5 MB body limit.
      // Uses XHR so we can track real upload progress.
      try {
        await uploadWithProgress(signedUrl, file, (pct) => {
          setStage({ status: "uploading", progress: pct, fileName: file.name });
        });
      } catch {
        setStage({ status: "error", message: "Upload to storage failed. Please try again." });
        return;
      }

      // ── Step 3: tell the server to process the stored file ───────────────
      setStage({ status: "processing", fileName: file.name });

      const processRes = await fetch("/api/uploads/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath, fileName: file.name }),
      });

      const data = await processRes.json();

      if (!processRes.ok) {
        setStage({ status: "error", message: data.error || "Processing failed." });
        return;
      }

      setStage({
        status: "done",
        fileName: file.name,
        result: {
          totalRows: data.totalRows,
          importedRows: data.importedRows,
          duplicateRows: data.duplicateRows,
          skippedRows: data.skippedRows,
          dateRangeFrom: data.dateRangeFrom ?? null,
          dateRangeTo: data.dateRangeTo ?? null,
          categoriesDetected: data.categoriesDetected ?? 0,
          currencies: data.currencies ?? [],
          hasMixedCurrencies: data.hasMixedCurrencies ?? false,
          typeBreakdown: data.typeBreakdown ?? null,
        },
      });

      router.refresh();
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const reset = () => setStage({ status: "idle" });

  // ── Idle drop zone ────────────────────────────────────────────────────────
  if (stage.status === "idle") {
    return (
      <>
        <div
          className={`border-2 border-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            dragging
              ? "border-[#14B8A6] bg-[#14B8A610]"
              : "border-[#1E293B] hover:border-[#14B8A6] hover:bg-[#14B8A608]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-[#F8FAFC] font-semibold mb-1">Drop your CSV here</p>
          <p className="text-sm text-[#94a3b8]">or click to browse</p>
          <p className="text-xs text-[#94a3b8] mt-3">
            Any size · Any date range · Duplicates skipped automatically
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </>
    );
  }

  // ── Uploading ─────────────────────────────────────────────────────────────
  if (stage.status === "uploading") {
    return (
      <div className="card py-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="font-semibold text-[#F8FAFC]">Uploading {stage.fileName}</p>
          <p className="text-sm text-[#94a3b8] mt-1">
            Going directly to Supabase Storage. No file size limit
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-[#94a3b8] mb-1.5">
            <span>Uploading…</span>
            <span>{stage.progress}%</span>
          </div>
          <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#14B8A6] rounded-full transition-all duration-200"
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Processing ────────────────────────────────────────────────────────────
  if (stage.status === "processing") {
    return (
      <div className="card py-10 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#14B8A6] border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="font-semibold text-[#F8FAFC]">Processing {stage.fileName}</p>
          <p className="text-sm text-[#94a3b8] mt-1">
            Parsing · Deduplicating · Categorising · Updating analytics…
          </p>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (stage.status === "done") {
    const { result, fileName } = stage;

    const fmt = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString("en-IE", { month: "short", year: "numeric" })
        : null;

    const dateFrom = fmt(result.dateRangeFrom);
    const dateTo = fmt(result.dateRangeTo);
    const dateRangeLabel =
      dateFrom && dateTo && dateFrom !== dateTo
        ? `${dateFrom} – ${dateTo}`
        : dateFrom ?? null;

    return (
      <div className="card space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#14B8A620] rounded-full flex items-center justify-center text-[#14B8A6] font-bold text-lg">
            ✓
          </div>
          <div>
            <p className="font-semibold text-[#14B8A6]">Import complete</p>
            <p className="text-sm text-[#94a3b8]">{fileName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Transactions imported", value: result.importedRows.toLocaleString(), color: "text-[#22C55E]" },
            { label: "Duplicates skipped", value: result.duplicateRows.toLocaleString(), color: "text-[#94a3b8]" },
            { label: "Total rows", value: result.totalRows.toLocaleString(), color: "text-[#F8FAFC]" },
            { label: "Invalid rows", value: result.skippedRows.toLocaleString(), color: "text-[#f59e0b]" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0f172a] rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#94a3b8] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Date range and categories */}
        {(dateRangeLabel || result.categoriesDetected > 0) && (
          <div className="bg-[#0f172a] rounded-xl px-4 py-3 space-y-1.5">
            {dateRangeLabel && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94a3b8]">Date range</span>
                <span className="font-medium text-[#F8FAFC]">{dateRangeLabel}</span>
              </div>
            )}
            {result.categoriesDetected > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94a3b8]">Categories detected</span>
                <span className="font-medium text-[#14B8A6]">{result.categoriesDetected}</span>
              </div>
            )}
          </div>
        )}

        {/* Categorisation breakdown — lets users verify the engine found the right things */}
        {result.typeBreakdown && (
          <div className="bg-[#0f172a] rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">What we found</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {result.typeBreakdown.income > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94a3b8]">Income payments</span>
                  <span className="font-medium text-[#22C55E]">{result.typeBreakdown.income.toLocaleString()}</span>
                </div>
              )}
              {result.typeBreakdown.expense > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94a3b8]">Expenses</span>
                  <span className="font-medium text-[#F59E0B]">{result.typeBreakdown.expense.toLocaleString()}</span>
                </div>
              )}
              {result.typeBreakdown.savings > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94a3b8]">Savings transfers</span>
                  <span className="font-medium text-[#3B82F6]">{result.typeBreakdown.savings.toLocaleString()}</span>
                </div>
              )}
              {result.typeBreakdown.transfer > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#94a3b8]">Internal transfers</span>
                  <span className="font-medium text-[#94a3b8]">{result.typeBreakdown.transfer.toLocaleString()}</span>
                </div>
              )}
            </div>
            {result.typeBreakdown.transfer > 0 && (
              <p className="text-[10px] text-[#94a3b8] pt-1">
                Internal transfers (between your own accounts) are excluded from income and expense totals.
              </p>
            )}
            <div className="pt-1 border-t border-[#1E293B]">
              <a href="/history" className="text-xs text-[#14B8A6] hover:underline">
                Review categorisation in History →
              </a>
            </div>
          </div>
        )}

        {/* Mixed-currency warning */}
        {result.hasMixedCurrencies && (
          <div className="flex items-start gap-2.5 px-3 py-3 bg-[#F59E0B0d] border border-[#F59E0B25] rounded-xl">
            <span className="text-[#F59E0B] text-base flex-shrink-0">⚠</span>
            <p className="text-xs text-[#F59E0B] leading-relaxed">
              Multiple currencies detected ({result.currencies.join(", ")}). Totals and insights
              are calculated across all amounts. Results may be inaccurate if currencies were
              not converted before export. Consider exporting a single-currency statement for
              best accuracy.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset} className="btn-secondary flex-1">
            Upload another file
          </button>
          <button
            onClick={() => router.push("/dashboard?firstUpload=true")}
            className="btn-primary flex-1"
          >
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  const err = parseUploadError(stage.message);
  return (
    <div className="card space-y-4">
      {/* Heading */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#EF444415] rounded-full flex items-center justify-center text-[#EF4444] flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-[#EF4444]">{err.heading}</p>
          <p className="text-sm text-[#94A3B8] mt-0.5 leading-relaxed">{err.reason}</p>
        </div>
      </div>

      {/* What to do */}
      <div className="bg-[#0A1020] rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">What to try</p>
        <ul className="space-y-1.5">
          {err.steps.map((step, i) => (
            <li key={i} className="text-sm text-[#CBD5E1] flex items-start gap-2">
              <span className="text-[#14B8A6] flex-shrink-0 mt-0.5">→</span>
              {step}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button onClick={reset} className="btn-primary w-full">
          Try a different file
        </button>
        <a
          href="mailto:support@freelanceros.app?subject=CSV Upload Issue"
          className="text-xs text-center text-[#94A3B8] hover:text-[#F8FAFC] transition-colors py-1"
        >
          Still stuck? Email us and we&apos;ll help →
        </a>
      </div>
    </div>
  );
}

// ── Error parser — maps raw error messages to user-friendly guidance ──────────
function parseUploadError(message: string): {
  heading: string;
  reason: string;
  steps: string[];
} {
  const lower = message.toLowerCase();

  if (lower.includes("no valid transactions") || lower.includes("check your csv")) {
    return {
      heading: "We couldn't find your transactions",
      reason: "Your file uploaded successfully but we couldn't read the transaction data inside it.",
      steps: [
        "Make sure you exported as CSV, not Excel (.xlsx) or PDF",
        "Re-export directly from your bank's website or app",
        "The file should have Date, Description, and Amount columns",
      ],
    };
  }

  if (lower.includes("empty")) {
    return {
      heading: "The file appears to be empty",
      reason: "We received your file but it had no content inside.",
      steps: [
        "Check that you selected the right file",
        "Try re-exporting from your bank — the download may not have completed",
      ],
    };
  }

  if (lower.includes("only .csv") || lower.includes("not a csv") || lower.includes(".csv files are supported")) {
    return {
      heading: "This file type is not supported",
      reason: "We accept CSV files only. Excel, PDF, and other formats cannot be processed.",
      steps: [
        "Go to your bank's website and look for 'Export as CSV'",
        "Avoid downloading as Excel (.xlsx) or PDF",
        "Most banks label this option 'Download statement' or 'Export transactions'",
      ],
    };
  }

  if (lower.includes("failed to prepare") || lower.includes("storage") || lower.includes("network") || lower.includes("connection")) {
    return {
      heading: "Connection problem",
      reason: "We couldn't reach our servers. This is usually temporary.",
      steps: [
        "Check your internet connection",
        "Wait a moment and try again",
      ],
    };
  }

  return {
    heading: "Something went wrong",
    reason: "We had trouble processing your file. This can happen with unusual bank export formats.",
    steps: [
      "Try re-exporting from your bank's website",
      "Make sure the file is saved as CSV (not Excel or PDF)",
      "Check your internet connection and try again",
    ],
  };
}

// ── XHR upload so we get real progress events ─────────────────────────────
function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Storage upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error during upload"))
    );

    xhr.addEventListener("abort", () =>
      reject(new Error("Upload aborted"))
    );

    // Supabase signed upload URL endpoint
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "text/csv");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.send(file);
  });
}
