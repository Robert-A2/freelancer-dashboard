"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/utils/finance";
import type { Locale } from "@/i18n/locales";

function LockIcon() {
  return (
    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default function PayButton({ token, amount, locale, accentColor }: { token: string; amount: number; locale: Locale; accentColor?: string }) {
  const t = useTranslations("pay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/${token}/checkout`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-[#D97070] mb-3">{error}</p>
      )}
      <button
        onClick={handlePay}
        disabled={loading}
        className="btn-primary w-full hover:opacity-90 transition-opacity"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      >
        {loading ? t("processing") : t("payButton", { amount: formatCurrency(amount, locale) })}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-[#6A97B4] mt-3 text-center leading-relaxed">
        <LockIcon />
        <span>{t("secureNotice")}</span>
      </p>
    </div>
  );
}
