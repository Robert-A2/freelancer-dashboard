"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  safetyBufferMonths: number | null;
}

const PRESETS = [1, 2, 3] as const;

// "How much runway do you want to protect?" (Money Intelligence spec
// section 11) — this is the one place safetyBufferMonths gets set. Until a
// user sets it here, getMoneyBreakdown() deliberately never computes a
// "Safe to use" figure, only the more honest "Available after protections."
export default function SafetyBufferSection({ safetyBufferMonths }: Props) {
  const t = useTranslations("settings.safetyBuffer");
  const router = useRouter();

  const isPreset = safetyBufferMonths !== null && (PRESETS as readonly number[]).includes(safetyBufferMonths);
  const [mode, setMode] = useState<"none" | "preset" | "custom">(
    safetyBufferMonths === null ? "none" : isPreset ? "preset" : "custom"
  );
  const [selectedPreset, setSelectedPreset] = useState<number>(isPreset ? safetyBufferMonths! : 1);
  const [customValue, setCustomValue] = useState(!isPreset && safetyBufferMonths !== null ? String(safetyBufferMonths) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(next: "none" | "preset" | "custom", preset?: number) {
    setMode(next);
    if (preset !== undefined) setSelectedPreset(preset);
    setSaved(false);
  }

  async function handleSave() {
    const value = mode === "none" ? null : mode === "preset" ? selectedPreset : Number(customValue);
    if (mode === "custom" && (!Number.isFinite(value) || (value as number) <= 0)) {
      setError(t("customInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safetyBufferMonths: value }),
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

  const chipBase = "flex-1 text-sm font-medium px-3 py-2.5 rounded-xl border transition-colors";
  const chipActive = "bg-[#3AB5A012] border-[#3AB5A0] text-[#3AB5A0]";
  const chipInactive = "bg-[#112232] border-[#25405A] text-[#7BA8C4] hover:text-[#A8C6E0]";

  return (
    <div className="card">
      <p className="label mb-1">{t("label")}</p>
      <p className="text-sm text-[#7BA8C4] mb-5">{t("body")}</p>

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => pick("none")} className={`${chipBase} ${mode === "none" ? chipActive : chipInactive}`}>
          {t("none")}
        </button>
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => pick("preset", m)}
            className={`${chipBase} ${mode === "preset" && selectedPreset === m ? chipActive : chipInactive}`}
          >
            {t("months", { count: m })}
          </button>
        ))}
        <button type="button" onClick={() => pick("custom")} className={`${chipBase} ${mode === "custom" ? chipActive : chipInactive}`}>
          {t("custom")}
        </button>
      </div>

      {mode === "custom" && (
        <div className="mt-4 max-w-[160px]">
          <label className="text-xs text-[#6A97B4] mb-2 block">{t("customLabel")}</label>
          <input
            inputMode="decimal"
            className="bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full"
            value={customValue}
            onChange={(e) => { setCustomValue(e.target.value); setSaved(false); }}
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
