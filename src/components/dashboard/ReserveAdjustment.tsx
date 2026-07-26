"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ReserveAdjustment({ currentPct }: { currentPct: number }) {
  const router = useRouter();
  const t = useTranslations("dashboard.financialReserveCard");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentPct));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const pct = parseFloat(value);
    if (!Number.isFinite(pct)) return;
    setSaving(true);
    try {
      await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualReservePctOverride: pct }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors">
        {t("adjustEstimate")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#A8C6E0]">{t("adjustPanel.label")}</span>
      <input
        className="input py-1 px-2 text-xs w-16"
        type="number"
        min={0}
        max={100}
        step="0.1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("adjustPanel.placeholder")}
      />
      <button onClick={handleSave} disabled={saving} className="text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors disabled:opacity-50">
        {t("adjustPanel.save")}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-[#6A97B4] hover:text-[#7BA8C4] transition-colors">
        {t("adjustPanel.cancel")}
      </button>
    </div>
  );
}
