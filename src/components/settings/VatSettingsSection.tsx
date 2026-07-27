"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  vatStatus: string | null;
  vatNumber: string | null;
}

export default function VatSettingsSection({ vatStatus, vatNumber }: Props) {
  const t = useTranslations("settings.vat");
  const router = useRouter();

  const [registered, setRegistered] = useState(vatStatus === "registered");
  const [number, setNumber] = useState(vatNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateNumber(value: string) {
    setNumber(value);
    setSaved(false);
  }

  function toggleRegistered() {
    setRegistered((r) => !r);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vatStatus: registered ? "registered" : "exempt",
          vatNumber: registered ? number.trim() || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("saveError"));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const inputBase = "bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full";

  return (
    <div className="card">
      <p className="label mb-1">{t("label")}</p>
      <p className="text-sm text-[#7BA8C4] mb-5">{t("body")}</p>

      <div className="flex items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#C8DCF0]">{t("toggle.label")}</p>
          <p className="text-xs text-[#6A97B4] mt-0.5 leading-relaxed">{t("toggle.body")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={registered}
          onClick={toggleRegistered}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${registered ? "bg-[#3AB5A0]" : "bg-[#243F5E]"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${registered ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {registered && (
        <div className="mt-4">
          <label className="text-xs text-[#6A97B4] mb-2 block">{t("vatNumber.label")}</label>
          <input
            className={`${inputBase} max-w-xs`}
            value={number}
            onChange={(e) => updateNumber(e.target.value)}
            placeholder={t("vatNumber.placeholder")}
            maxLength={40}
          />
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary mt-5 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? t("save") : saved ? t("saved") : t("save")}
      </button>
      {error && <p className="text-xs text-[#E5484D] mt-2">{error}</p>}

      <p className="text-xs text-[#4A7A9B] mt-4">{t("footer")}</p>
    </div>
  );
}
