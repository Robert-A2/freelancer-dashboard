"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency, formatInvoiceNumber } from "@/utils/finance";
import { copyToClipboard } from "@/utils/clipboard";
import { INTL_LOCALES, type Locale } from "@/i18n/locales";
import type { DemoProject, DemoMilestone } from "./types";

const STATUS_STYLE: Record<DemoMilestone["status"], { bg: string; text: string }> = {
  pending: { bg: "bg-[#F1F4F7]", text: "text-[#5B7185]" },
  sent:    { bg: "bg-[#FDF3E3]", text: "text-[#A66A0A]" },
};

function formatDueDate(dueDate: string, locale: Locale): string {
  return new Date(dueDate).toLocaleDateString(INTL_LOCALES[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Copying the link genuinely copies a real URL (the demo's own payment-page
// preview) and flips the milestone to "sent" — the same UI feedback loop as
// the real ProjectList — but it's honestly a preview, not a live per-token
// checkout link, since nothing here is persisted server-side. Visiting it
// shows a clearly-labeled preview of what a client would actually see.
function MilestoneRow({ milestone, locale, onMarkSent }: { milestone: DemoMilestone; locale: Locale; onMarkSent: (id: string) => void }) {
  const t = useTranslations("projects");
  const [copied, setCopied] = useState(false);
  const style = STATUS_STYLE[milestone.status];

  async function handleCopy() {
    const url = `${window.location.origin}/demo/pay/preview`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt(t("copyLinkManually"), url);
    }
    if (milestone.status === "pending") onMarkSent(milestone.id);
  }

  const buttonLabel = copied ? t("linkCopied") : milestone.status === "pending" ? t("copyLink") : t("resendLink");

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-[#E3E8EE] first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${style.bg} ${style.text}`}>
            {t(`milestoneStatus.${milestone.status}`)}
          </span>
          <span className="text-sm text-[#16283B] truncate">{milestone.label}</span>
          <span className="text-xs text-[#8A9BAC] flex-shrink-0">{formatInvoiceNumber(milestone.invoiceNumber)}</span>
        </div>
        {milestone.dueDate && (
          <p className="text-xs mt-1 text-[#8A9BAC]">
            {t("dueDate", { date: formatDueDate(milestone.dueDate, locale) })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-sm font-semibold text-[#16283B] tabular-nums">{formatCurrency(milestone.amount, locale)}</span>
        <button
          onClick={handleCopy}
          className="text-xs font-semibold text-[#2B9C8D] hover:text-[#1F8A73] transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default function DemoProjectList({ projects, locale, onMarkSent }: { projects: DemoProject[]; locale: Locale; onMarkSent: (projectId: string, milestoneId: string) => void }) {
  const t = useTranslations("projects");

  return (
    <div className="space-y-4">
      {projects.map((p) => (
        <div key={p.id} className="card-light-sm">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#16283B] truncate">{p.projectName}</p>
              <p className="text-xs text-[#8A9BAC] mt-0.5">{p.clientName}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-[#16283B] tabular-nums">{formatCurrency(p.totalValue, locale)}</p>
              <p className="text-xs text-[#8A9BAC] mt-0.5">{t("milestones", { count: p.milestones.length })}</p>
            </div>
          </div>
          <div>
            {p.milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} locale={locale} onMarkSent={(mid) => onMarkSent(p.id, mid)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
