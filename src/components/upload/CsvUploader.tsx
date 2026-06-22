"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

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
  const t = useTranslations("upload");
  const locale = useLocale() as Locale;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>({ status: "idle" });

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setStage({ status: "error", message: "only-csv" });
        return;
      }

      setStage({ status: "uploading", progress: 0, fileName: file.name });

      const presignRes = await fetch(
        `/api/uploads/presign?filename=${encodeURIComponent(file.name)}`
      );

      const presignData = await presignRes.json();

      if (!presignRes.ok) {
        setStage({
          status: "error",
          message: presignData.error ?? "prepare-failed",
        });
        return;
      }

      const { signedUrl, storagePath } = presignData;

      try {
        await uploadWithProgress(signedUrl, file, (pct) => {
          setStage({ status: "uploading", progress: pct, fileName: file.name });
        });
      } catch {
        setStage({ status: "error", message: "storage-upload-failed" });
        return;
      }

      setStage({ status: "processing", fileName: file.name });

      const processRes = await fetch("/api/uploads/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath, fileName: file.name }),
      });

      const data = await processRes.json();

      if (!processRes.ok) {
        setStage({ status: "error", message: data.error || "processing-failed" });
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

  // ── Idle drop zone ─────────────────────────────────────────────────────────
  if (stage.status === "idle") {
    return (
      <>
        <div
          className={`border-2 border-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            dragging
              ? "border-[#3AB5A0] bg-[#3AB5A008]"
              : "border-[#1E3550] hover:border-[#3AB5A0] hover:bg-[#3AB5A006]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-[#E8F0F8] font-semibold mb-1">{t("dropzone.title")}</p>
          <p className="text-sm text-[#7BA8C4]">{t("dropzone.subtitle")}</p>
          <p className="text-xs text-[#6A97B4] mt-3">
            {t("dropzone.hint")}
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

  // ── Uploading ──────────────────────────────────────────────────────────────
  if (stage.status === "uploading") {
    return (
      <div className="card py-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="font-semibold text-[#E8F0F8]">{t("uploading.title", { fileName: stage.fileName })}</p>
          <p className="text-sm text-[#7BA8C4] mt-1">
            {t("uploading.subtitle")}
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-[#6A97B4] mb-1.5">
            <span>{t("uploading.label")}</span>
            <span>{stage.progress}%</span>
          </div>
          <div className="h-2 bg-[#1E3550] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3AB5A0] rounded-full transition-all duration-200"
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Processing ─────────────────────────────────────────────────────────────
  if (stage.status === "processing") {
    return (
      <div className="card py-10 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#3AB5A0] border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="font-semibold text-[#E8F0F8]">{t("processing.title", { fileName: stage.fileName })}</p>
          <p className="text-sm text-[#7BA8C4] mt-1">
            {t("processing.subtitle")}
          </p>
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (stage.status === "done") {
    const { result, fileName } = stage;

    // Always use timeZone: "UTC" so dates stored as UTC midnight never
    // display as the previous day/month in the user's local timezone.
    const fmt = (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleDateString(INTL_LOCALES[locale], { month: "long", year: "numeric", timeZone: "UTC" })
        : null;

    const dateFrom = fmt(result.dateRangeFrom);
    const dateTo = fmt(result.dateRangeTo);
    const dateRangeLabel =
      dateFrom && dateTo && dateFrom !== dateTo
        ? `${dateFrom} – ${dateTo}`
        : dateFrom ?? null;

    const stats = [
      { label: t("done.stats.imported"), value: result.importedRows.toLocaleString(locale), color: "text-[#4CC4A4]" },
      { label: t("done.stats.duplicates"), value: result.duplicateRows.toLocaleString(locale), color: "text-[#6A97B4]" },
      { label: t("done.stats.total"), value: result.totalRows.toLocaleString(locale), color: "text-[#E8F0F8]" },
      { label: t("done.stats.invalid"), value: result.skippedRows.toLocaleString(locale), color: "text-[#D4A254]" },
    ];

    return (
      <div className="card space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4CC4A420] rounded-full flex items-center justify-center text-[#4CC4A4] font-bold text-lg">
            ✓
          </div>
          <div>
            <p className="font-semibold text-[#4CC4A4]">{t("done.title")}</p>
            <p className="text-sm text-[#7BA8C4]">{fileName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#1A3048] rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#6A97B4] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {(dateRangeLabel || result.categoriesDetected > 0) && (
          <div className="bg-[#1A3048] rounded-xl px-4 py-3 space-y-1.5">
            {dateRangeLabel && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#7BA8C4]">{t("done.analysisRange")}</span>
                <span className="font-medium text-[#E8F0F8]">{dateRangeLabel}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#7BA8C4]">{t("done.transactionsImported")}</span>
              <span className="font-medium text-[#4CC4A4]">{result.importedRows.toLocaleString(locale)}</span>
            </div>
            {result.categoriesDetected > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#7BA8C4]">{t("done.categoriesDetected")}</span>
                <span className="font-medium text-[#3AB5A0]">{result.categoriesDetected}</span>
              </div>
            )}
          </div>
        )}

        {result.typeBreakdown && (
          <div className="bg-[#1A3048] rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-[#6A97B4] uppercase tracking-wide">{t("done.whatWeFound")}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {result.typeBreakdown.income > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7BA8C4]">{t("done.incomePayments")}</span>
                  <span className="font-medium text-[#4CC4A4]">{result.typeBreakdown.income.toLocaleString(locale)}</span>
                </div>
              )}
              {result.typeBreakdown.expense > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7BA8C4]">{t("done.expenses")}</span>
                  <span className="font-medium text-[#D4A254]">{result.typeBreakdown.expense.toLocaleString(locale)}</span>
                </div>
              )}
              {result.typeBreakdown.savings > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7BA8C4]">{t("done.savingsTransfers")}</span>
                  <span className="font-medium text-[#3AB5A0]">{result.typeBreakdown.savings.toLocaleString(locale)}</span>
                </div>
              )}
              {result.typeBreakdown.transfer > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#7BA8C4]">{t("done.internalTransfers")}</span>
                  <span className="font-medium text-[#6A97B4]">{result.typeBreakdown.transfer.toLocaleString(locale)}</span>
                </div>
              )}
            </div>
            {result.typeBreakdown.transfer > 0 && (
              <p className="text-xs text-[#6A97B4] pt-1">
                {t("done.transferNote")}
              </p>
            )}
            <div className="pt-1">
              <a href="/history" className="text-xs text-[#3AB5A0] hover:underline">
                {t("done.reviewCategorisation")}
              </a>
            </div>
          </div>
        )}

        {result.hasMixedCurrencies && (
          <div className="flex items-start gap-2.5 px-3 py-3 bg-[#D4A2540A] border border-[#D4A25425] rounded-xl">
            <span className="text-[#D4A254] text-base flex-shrink-0">⚠</span>
            <p className="text-xs text-[#D4A254] leading-relaxed">
              {t("done.mixedCurrencies", { currencies: result.currencies.join(", ") })}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset} className="btn-secondary flex-1">
            {t("done.uploadAnother")}
          </button>
          <button
            onClick={() => router.push("/dashboard?firstUpload=true")}
            className="btn-primary flex-1"
          >
            {t("done.viewDashboard")}
          </button>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  const err = parseUploadError(stage.message, t);
  return (
    <div className="card space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#D9707010] rounded-full flex items-center justify-center text-[#D97070] flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-[#D97070]">{err.heading}</p>
          <p className="text-sm text-[#7BA8C4] mt-0.5 leading-relaxed">{err.reason}</p>
        </div>
      </div>

      <div className="bg-[#1A3048] rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-[#6A97B4] uppercase tracking-wide mb-2">{t("errors.whatToTry")}</p>
        <ul className="space-y-1.5">
          {err.steps.map((step, i) => (
            <li key={i} className="text-sm text-[#E8F0F8] flex items-start gap-2">
              <span className="text-[#3AB5A0] flex-shrink-0 mt-0.5">→</span>
              {step}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <button onClick={reset} className="btn-primary w-full">
          {t("errors.tryDifferentFile")}
        </button>
        <a
          href="mailto:support@freelanceros.app?subject=CSV Upload Issue"
          className="text-xs text-center text-[#6A97B4] hover:text-[#E8F0F8] transition-colors py-1"
        >
          {t("errors.stillStuck")}
        </a>
      </div>
    </div>
  );
}

// ── Error parser ───────────────────────────────────────────────────────────────
function parseUploadError(
  message: string,
  t: ReturnType<typeof useTranslations<"upload">>
): {
  heading: string;
  reason: string;
  steps: string[];
} {
  const lower = message.toLowerCase();

  if (lower === "only-csv" || lower.includes("only .csv") || lower.includes("not a csv") || lower.includes(".csv files are supported")) {
    return {
      heading: t("errors.unsupportedFile.heading"),
      reason: t("errors.unsupportedFile.reason"),
      steps: t.raw("errors.unsupportedFile.steps") as string[],
    };
  }

  if (lower.includes("no valid transactions") || lower.includes("check your csv")) {
    return {
      heading: t("errors.noTransactions.heading"),
      reason: t("errors.noTransactions.reason"),
      steps: t.raw("errors.noTransactions.steps") as string[],
    };
  }

  if (lower.includes("empty")) {
    return {
      heading: t("errors.emptyFile.heading"),
      reason: t("errors.emptyFile.reason"),
      steps: t.raw("errors.emptyFile.steps") as string[],
    };
  }

  if (lower === "prepare-failed" || lower === "storage-upload-failed" || lower.includes("failed to prepare") || lower.includes("storage") || lower.includes("network") || lower.includes("connection")) {
    return {
      heading: t("errors.connectionProblem.heading"),
      reason: t("errors.connectionProblem.reason"),
      steps: t.raw("errors.connectionProblem.steps") as string[],
    };
  }

  return {
    heading: t("errors.generic.heading"),
    reason: t("errors.generic.reason"),
    steps: t.raw("errors.generic.steps") as string[],
  };
}

// ── XHR upload with progress ───────────────────────────────────────────────────
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

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "text/csv");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.send(file);
  });
}
