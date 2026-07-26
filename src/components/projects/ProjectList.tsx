"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatCurrency, formatInvoiceNumber, computeVatBreakdown } from "@/utils/finance";
import { copyToClipboard } from "@/utils/clipboard";
import { isPastDueDate } from "@/utils/dueDate";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";

export interface MilestoneView {
  id: string;
  label: string;
  amount: number;
  status: "pending" | "sent" | "paid" | "overdue" | "cleared";
  dueDate: string | null;
  paymentUrlToken: string;
  paidAt: string | null;
  invoiceNumber: number;
  vatRatePct: number | null;
  isReverseCharge: boolean;
}

export interface ProjectView {
  id: string;
  clientName: string;
  projectName: string;
  totalValue: number;
  status: string;
  createdAt: string;
  milestones: MilestoneView[];
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-[#F1F4F7]", text: "text-[#5B7185]" },
  sent:    { bg: "bg-[#FDF3E3]", text: "text-[#A66A0A]" },
  paid:    { bg: "bg-[#E8F7F3]", text: "text-[#1F8A73]" },
  overdue: { bg: "bg-[#FCEAEA]", text: "text-[#C0392B]" },
  cleared: { bg: "bg-[#E5F4F2]", text: "text-[#2B9C8D]" },
};

function displayStatus(m: MilestoneView): keyof typeof STATUS_STYLE {
  if (m.status === "sent" && m.dueDate && isPastDueDate(m.dueDate)) return "overdue";
  return m.status;
}

function formatDueDate(dueDate: string, locale: Locale): string {
  return new Date(dueDate).toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function toDateInputValue(dueDate: string | null): string {
  return dueDate ? dueDate.slice(0, 10) : "";
}

function MilestoneEditForm({ milestone, onDone }: { milestone: MilestoneView; onDone: () => void }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [label, setLabel] = useState(milestone.label);
  const [amount, setAmount] = useState(String(milestone.amount));
  const [dueDate, setDueDate] = useState(toDateInputValue(milestone.dueDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${milestone.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, amount: parseFloat(amount), dueDate: dueDate || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("genericError"));
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError(t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-2.5 border-t border-[#E3E8EE] first:border-t-0 first:pt-0 space-y-2">
      {error && <p className="text-xs text-[#C0392B]">{error}</p>}
      <div className="flex gap-2">
        <input className="input-light py-1.5 text-sm flex-1" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input-light py-1.5 text-sm w-28" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <input className="input-light py-1.5 text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="text-xs font-semibold text-[#2B9C8D] hover:text-[#1F8A73] transition-colors disabled:opacity-50">
          {t("save")}
        </button>
        <button onClick={onDone} className="text-xs text-[#8A9BAC] hover:text-[#5B7185] transition-colors">
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

function DeleteMilestoneButton({ milestoneId }: { milestoneId: string }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setConfirming(false);
    }
    if (confirming) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [confirming]);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/milestones/${milestoneId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("genericError"));
      setDeleting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setConfirming(!confirming)}
        disabled={deleting}
        className="text-xs font-semibold text-[#8A9BAC] hover:text-[#C0392B] transition-colors disabled:opacity-50"
      >
        {t("delete")}
      </button>
      {confirming && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E3E8EE] rounded-xl shadow-[0_4px_16px_rgba(15,40,60,0.12)] w-56 p-3 space-y-2">
          <p className="text-xs text-[#16283B] leading-relaxed">{t("deleteMilestoneConfirm")}</p>
          {error && <p className="text-xs text-[#C0392B]">{error}</p>}
          <div className="flex flex-col gap-1.5">
            <button onClick={handleDelete} disabled={deleting} className="text-xs text-left px-3 py-2 bg-[#FCEAEA] hover:bg-[#F9D9D8] text-[#C0392B] rounded-lg transition-colors">
              {t("deletePermanently")}
            </button>
            <button onClick={() => setConfirming(false)} className="text-xs text-[#8A9BAC] hover:text-[#5B7185] text-center py-1 transition-colors">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneRow({ milestone, locale }: { milestone: MilestoneView; locale: Locale }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = displayStatus(milestone);
  const style = STATUS_STYLE[status];

  async function handleCopy() {
    const url = `${window.location.origin}/pay/${milestone.paymentUrlToken}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Last resort so the link is never simply unreachable — lets the user
      // select and copy it manually.
      window.prompt(t("copyLinkManually"), url);
    }

    if (milestone.status === "pending") {
      setMarking(true);
      try {
        await fetch(`/api/milestones/${milestone.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "sent" }),
        });
        router.refresh();
      } finally {
        setMarking(false);
      }
    }
  }

  if (editing) {
    return <MilestoneEditForm milestone={milestone} onDone={() => setEditing(false)} />;
  }

  const canAct = milestone.status !== "paid" && milestone.status !== "cleared";
  const buttonLabel = copied ? t("linkCopied") : milestone.status === "pending" ? t("copyLink") : t("resendLink");

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-[#E3E8EE] first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.text}`}>
            {t(`milestoneStatus.${status}`)}
          </span>
          <span className="text-sm text-[#16283B] truncate">{milestone.label}</span>
          <span className="text-xs text-[#8A9BAC] flex-shrink-0">{formatInvoiceNumber(milestone.invoiceNumber)}</span>
        </div>
        {milestone.dueDate && (
          <p className={`text-xs mt-1 ${status === "overdue" ? "text-[#C0392B]" : "text-[#8A9BAC]"}`}>
            {t("dueDate", { date: formatDueDate(milestone.dueDate, locale) })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <span className="text-sm font-semibold text-[#16283B] tabular-nums">{formatCurrency(milestone.amount, locale)}</span>
          {milestone.isReverseCharge ? (
            <p className="text-xs text-[#8A9BAC] mt-0.5">{t("reverseChargeBadge")}</p>
          ) : milestone.vatRatePct != null && milestone.vatRatePct > 0 ? (
            <p className="text-xs text-[#8A9BAC] mt-0.5">
              {t("vatCaption", {
                pct: milestone.vatRatePct,
                gross: formatCurrency(computeVatBreakdown(milestone.amount, milestone.vatRatePct).gross, locale),
              })}
            </p>
          ) : null}
        </div>
        {milestone.status === "pending" && (
          <>
            <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#8A9BAC] hover:text-[#42586B] transition-colors">
              {t("edit")}
            </button>
            <DeleteMilestoneButton milestoneId={milestone.id} />
          </>
        )}
        {canAct && (
          <button
            onClick={handleCopy}
            disabled={marking}
            className="text-xs font-semibold text-[#2B9C8D] hover:text-[#1F8A73] transition-colors disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectActions({ project }: { project: ProjectView }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: project.status === "archived" ? "active" : "archived" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("genericError"));
      setBusy(false);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("genericError"));
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (project.status === "completed") return null;

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className="text-xs text-[#8A9BAC] hover:text-[#42586B] transition-colors px-1"
        aria-label={t("edit")}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E3E8EE] rounded-xl shadow-[0_4px_16px_rgba(15,40,60,0.12)] w-52 p-1.5 space-y-0.5">
          {error && <p className="text-xs text-[#C0392B] px-2 py-1">{error}</p>}
          <button onClick={toggleArchive} disabled={busy} className="w-full text-left text-xs px-2.5 py-2 rounded-lg text-[#42586B] hover:bg-[#F1F4F7] transition-colors">
            {project.status === "archived" ? t("unarchive") : t("archive")}
          </button>
          <button onClick={handleDelete} disabled={busy} className="w-full text-left text-xs px-2.5 py-2 rounded-lg text-[#C0392B] hover:bg-[#FCEAEA] transition-colors">
            {t("deleteProject")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectList({ projects, locale }: { projects: ProjectView[]; locale: Locale }) {
  const t = useTranslations("projects");

  return (
    <div className="space-y-4">
      {projects.map((p) => (
        <div key={p.id} className={`card-light-sm ${p.status === "archived" ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#16283B] truncate">{p.projectName}</p>
                {p.status === "completed" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F7F3] text-[#1F8A73] flex-shrink-0">
                    {t("completedBadge")}
                  </span>
                )}
                {p.status === "archived" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F1F4F7] text-[#5B7185] flex-shrink-0">
                    {t("archivedBadge")}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8A9BAC] mt-0.5">{p.clientName}</p>
            </div>
            <div className="flex items-start gap-2 flex-shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-[#16283B] tabular-nums">{formatCurrency(p.totalValue, locale)}</p>
                <p className="text-xs text-[#8A9BAC] mt-0.5">{t("milestones", { count: p.milestones.length })}</p>
              </div>
              <ProjectActions project={p} />
            </div>
          </div>
          <div>
            {p.milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} locale={locale} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
