"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";
import type { RecentPayment } from "@/lib/milestone-engine";

const DISMISSED_KEY = "nonodia_dismissed_payments";

function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function PaymentReceivedBanner({ payments, locale }: { payments: RecentPayment[]; locale: Locale }) {
  const t = useTranslations("dashboard.paymentReceived");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  }

  // Avoid a hydration flash where the server-rendered (all-visible) markup
  // briefly shows before localStorage is read on the client.
  if (!hydrated) return null;

  const visible = payments.filter((p) => !dismissed.has(p.milestoneId));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((p) => (
        <div key={p.milestoneId} className="flex items-start gap-3 px-4 py-3 bg-[#4CC4A40A] border border-[#4CC4A430] rounded-xl">
          <span className="text-[#4CC4A4] text-lg flex-shrink-0 mt-0.5">✓</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#4CC4A4]">{t("heading")}</p>
              <span className="text-xs text-[#6A97B4]">
                {p.source === "stripe" ? t("sourceStripe") : t("sourceBank")}
              </span>
            </div>
            <p className="text-sm text-[#A8C6E0] mt-0.5">
              {t("detail", { clientName: p.clientName, amount: formatCurrency(p.amount, locale), label: p.label, projectName: p.projectName })}
            </p>
          </div>
          <button
            onClick={() => dismiss(p.milestoneId)}
            className="text-[#6A97B4] hover:text-[#7BA8C4] transition-colors p-1 flex-shrink-0"
            aria-label={t("dismiss")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
