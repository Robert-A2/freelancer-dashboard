"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  vatStatus: string | null; // "exempt" | "registered" | "unknown"
  vatNumber: string | null;
  defaultVatRate: number | null;
}

const STANDARD_RATES = [20, 10, 5.5, 2.1] as const;

// The single owner of vatStatus (Tax & Contributions spec question 5) — a
// second copy of this question used to live in FinancialProfileSection with
// a different option set (exempt/registered/unknown there vs a plain on/off
// toggle here), so the two forms could silently overwrite each other's
// value. Removed there; this is now the only place vatStatus is edited.
export default function VatSettingsSection({ vatStatus, vatNumber, defaultVatRate }: Props) {
  const t = useTranslations("settings.vat");
  const router = useRouter();

  const [status, setStatus] = useState<"exempt" | "registered" | "unknown">(
    vatStatus === "registered" || vatStatus === "unknown" ? vatStatus : "exempt"
  );
  const [number, setNumber] = useState(vatNumber ?? "");
  const isStandardRate = defaultVatRate != null && (STANDARD_RATES as readonly number[]).includes(defaultVatRate);
  const [ratePreset, setRatePreset] = useState<number | "custom">(
    defaultVatRate == null ? 20 : isStandardRate ? defaultVatRate : "custom"
  );
  const [customRate, setCustomRate] = useState(!isStandardRate && defaultVatRate != null ? String(defaultVatRate) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickStatus(next: "exempt" | "registered" | "unknown") {
    setStatus(next);
    setSaved(false);
  }

  async function handleSave() {
    const rate = status === "registered" ? (ratePreset === "custom" ? Number(customRate) : ratePreset) : null;
    if (status === "registered" && ratePreset === "custom" && (!Number.isFinite(rate) || (rate as number) <= 0)) {
      setError(t("rateInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vatStatus: status,
          vatNumber: status === "registered" ? number.trim() || null : null,
          defaultVatRate: rate,
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
  const chipBase = "text-sm font-medium px-3 py-2.5 rounded-xl border transition-colors";
  const chipActive = "bg-[#3AB5A012] border-[#3AB5A0] text-[#3AB5A0]";
  const chipInactive = "bg-[#112232] border-[#25405A] text-[#7BA8C4] hover:text-[#A8C6E0]";

  return (
    <div className="card">
      <p className="label mb-1">{t("label")}</p>
      <p className="text-sm text-[#7BA8C4] mb-5">{t("body")}</p>

      <p className="text-sm font-medium text-[#C8DCF0] mb-2">{t("statusQuestion")}</p>
      <div className="flex gap-2 flex-wrap mb-1">
        <button type="button" onClick={() => pickStatus("exempt")} className={`${chipBase} ${status === "exempt" ? chipActive : chipInactive}`}>{t("statusNo")}</button>
        <button type="button" onClick={() => pickStatus("registered")} className={`${chipBase} ${status === "registered" ? chipActive : chipInactive}`}>{t("statusYes")}</button>
        <button type="button" onClick={() => pickStatus("unknown")} className={`${chipBase} ${status === "unknown" ? chipActive : chipInactive}`}>{t("statusUnsure")}</button>
      </div>

      {status === "registered" && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs text-[#6A97B4] mb-2 block">{t("vatNumber.label")}</label>
            <input
              className={`${inputBase} max-w-xs`}
              value={number}
              onChange={(e) => { setNumber(e.target.value); setSaved(false); }}
              placeholder={t("vatNumber.placeholder")}
              maxLength={40}
            />
          </div>

          <div>
            <label className="text-xs text-[#6A97B4] mb-2 block">{t("rateQuestion")}</label>
            <div className="flex gap-2 flex-wrap">
              {STANDARD_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRatePreset(r); setSaved(false); }}
                  className={`${chipBase} ${ratePreset === r ? chipActive : chipInactive}`}
                >
                  {r}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setRatePreset("custom"); setSaved(false); }}
                className={`${chipBase} ${ratePreset === "custom" ? chipActive : chipInactive}`}
              >
                {t("rateCustom")}
              </button>
            </div>
            {ratePreset === "custom" && (
              <input
                inputMode="decimal"
                className={`${inputBase} max-w-[140px] mt-2`}
                value={customRate}
                onChange={(e) => { setCustomRate(e.target.value); setSaved(false); }}
                placeholder="e.g. 8.5"
              />
            )}
            <p className="text-xs text-[#6A97B4] mt-2">{t("rateHint")}</p>
          </div>
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
