"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency, computePlatformFee } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { DemoMilestone, DemoProject } from "./types";

type Split = "full" | "half" | "custom";

interface CustomRow {
  label: string;
  amount: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Props {
  locale: Locale;
  onCreate: (project: DemoProject) => void;
  onCancel: () => void;
  nextInvoiceNumber: number;
}

// Mirrors the real NewProjectForm (same fields, same split logic, same fee
// preview) so a demo visitor sees exactly what creating a project looks
// like — but onCreate hands the result to local component state instead of
// POSTing to /api/projects, since there's no real account to write to. VAT
// is omitted entirely: it only ever shows for VAT-registered users, and the
// demo persona has no VAT-registration concept to hang that toggle off of.
export default function DemoNewProjectForm({ locale, onCreate, onCancel, nextInvoiceNumber }: Props) {
  const t = useTranslations("projects.newProject");

  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [split, setSplit] = useState<Split>("half");
  const [customRows, setCustomRows] = useState<CustomRow[]>([{ label: "", amount: "" }, { label: "", amount: "" }]);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = parseFloat(totalValue) || 0;

  const customSum = round2(customRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
  const customMismatch = split === "custom" && total > 0 && Math.abs(customSum - total) > 0.01;

  function addRow() {
    setCustomRows((rows) => [...rows, { label: "", amount: "" }]);
  }
  function removeRow(i: number) {
    setCustomRows((rows) => rows.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: "label" | "amount", value: string) {
    setCustomRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientName.trim() || !projectName.trim() || total <= 0) {
      setError(t("genericError"));
      return;
    }

    let milestoneInputs: { label: string; amount: number; dueDate: string | null }[];
    if (split === "full") {
      milestoneInputs = [{ label: t("fullLabel"), amount: total, dueDate: dueDate || null }];
    } else if (split === "half") {
      const first = round2(total / 2);
      const second = round2(total - first);
      milestoneInputs = [
        { label: t("depositLabel"), amount: first, dueDate: null },
        { label: t("finalLabel"), amount: second, dueDate: dueDate || null },
      ];
    } else {
      if (customMismatch) {
        setError(t("splitMismatch", { total: formatCurrency(total, locale) }));
        return;
      }
      milestoneInputs = customRows
        .filter((r) => r.label.trim() && parseFloat(r.amount) > 0)
        .map((r) => ({ label: r.label.trim(), amount: parseFloat(r.amount), dueDate: null }));
    }

    const milestones: DemoMilestone[] = milestoneInputs.map((m, i) => ({
      id: `demo-milestone-${Date.now()}-${i}`,
      label: m.label,
      amount: m.amount,
      status: "pending",
      dueDate: m.dueDate,
      invoiceNumber: nextInvoiceNumber + i,
    }));

    const project: DemoProject = {
      id: `demo-project-${Date.now()}`,
      clientName: clientName.trim(),
      projectName: projectName.trim(),
      totalValue: total,
      createdAt: new Date().toISOString(),
      milestones,
    };

    onCreate(project);
  }

  return (
    <form onSubmit={handleSubmit} className="card-light space-y-5">
      <p className="label-light">{t("heading")}</p>

      {error && (
        <div className="px-4 py-3 bg-[#FCEAEA] border border-[#F3C6C4] rounded-xl text-sm text-[#C0392B]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#42586B] mb-1.5 block">{t("clientName")}</label>
          <input
            className="input-light"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder={t("clientNamePlaceholder")}
            maxLength={120}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#42586B] mb-1.5 block">{t("projectName")}</label>
          <input
            className="input-light"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={t("projectNamePlaceholder")}
            maxLength={120}
            required
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-[#42586B] mb-1.5 block">{t("totalValue")}</label>
        <input
          className="input-light max-w-xs"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={totalValue}
          onChange={(e) => setTotalValue(e.target.value)}
          placeholder="5000"
          required
        />
        {total > 0 && (
          <p className="text-xs text-[#8A9BAC] mt-1.5">
            {t("feePreview", { amount: formatCurrency(round2(total - computePlatformFee(total)), locale) })}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-[#42586B] mb-2 block">{t("paymentSplit")}</label>
        <div className="flex flex-wrap gap-2">
          {([
            ["full", t("splitFull")],
            ["half", t("splitHalf")],
            ["custom", t("splitCustom")],
          ] as [Split, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSplit(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                split === value ? "bg-[#E8F7F3] text-[#1F8A73] border border-[#BFE6DC]" : "bg-[#F1F4F7] text-[#5B7185] border border-transparent hover:text-[#16283B]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {split === "half" && total > 0 && (
        <p className="text-xs text-[#8A9BAC]">
          {t("depositLabel")}: {formatCurrency(round2(total / 2), locale)} · {t("finalLabel")}: {formatCurrency(round2(total - round2(total / 2)), locale)}
        </p>
      )}

      {split === "custom" && (
        <div className="space-y-3">
          {customRows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="input-light flex-1"
                value={row.label}
                onChange={(e) => updateRow(i, "label", e.target.value)}
                placeholder={t("milestoneLabelPlaceholder")}
              />
              <input
                className="input-light w-32"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={row.amount}
                onChange={(e) => updateRow(i, "amount", e.target.value)}
                placeholder="0"
              />
              {customRows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="btn-ghost-light px-2 text-[#C0392B]" aria-label={t("removeMilestone")}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addRow} className="text-sm font-medium text-[#2B9C8D] hover:text-[#1F8A73] transition-colors">
            + {t("addMilestone")}
          </button>
          {customMismatch && (
            <p className="text-xs text-[#A66A0A]">{t("splitMismatch", { total: formatCurrency(total, locale) })}</p>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-[#42586B] mb-1.5 block">{t("dueDate")}</label>
        <input className="input-light max-w-xs" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={split === "custom" && customMismatch} className="btn-primary">
          {t("submit")}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost-light">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
