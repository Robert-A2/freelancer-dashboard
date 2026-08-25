"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { todayInputValue, dateInputValue } from "@/lib/date-input";

interface Props {
  country: string | null;
  businessLegalStatus: string | null;
  activityType: string | null;
  versementLiberatoireStatus: string | null;
  acreStatus: string | null;
  activityStartDate: Date | null;
  urssafFrequency: string | null;
  isComplete: boolean;
}

const ACTIVITY_OPTIONS = ["bnc_liberal", "bic_service_commercial", "bic_service_artisan", "bic_sales", "cipav_liberal", "mixed", "unsure"] as const;

// The one place onboarding's Tax & Contributions answers are edited after
// first setup (spec sections 17-19) — onboarding writes these exact same
// fields via /api/onboarding, this form edits them via /api/financial-profile;
// there is exactly one tax profile per user, never a second copy. vatStatus
// is deliberately NOT edited here — VatSettingsSection below is its one
// owner, so the two forms can never disagree about it.
export default function TaxContributionsSection({
  country, businessLegalStatus, activityType, versementLiberatoireStatus, acreStatus, activityStartDate, urssafFrequency, isComplete,
}: Props) {
  const t = useTranslations("settings.financialProfile");
  const router = useRouter();

  const [form, setForm] = useState({
    country: country ?? "",
    businessLegalStatus: businessLegalStatus ?? "",
    activityType: activityType ?? "",
    versementLiberatoireStatus: versementLiberatoireStatus ?? "",
    acreStatus: acreStatus ?? "",
    activityStartDate: activityStartDate ? dateInputValue(activityStartDate) : todayInputValue(),
    urssafFrequency: urssafFrequency ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMicro = form.businessLegalStatus === "micro_entrepreneur";
  const isFrance = form.country === "FR";
  const needsAcreStartDate = form.acreStatus === "yes";

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
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
          country: form.country || null,
          businessLegalStatus: form.businessLegalStatus || null,
          activityType: isMicro ? (form.activityType || null) : null,
          versementLiberatoireStatus: isMicro ? (form.versementLiberatoireStatus || null) : null,
          acreStatus: isMicro ? (form.acreStatus || null) : null,
          activityStartDate: isMicro && needsAcreStartDate ? form.activityStartDate : null,
          urssafFrequency: isMicro ? (form.urssafFrequency || null) : null,
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

  const selectBase = "bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full";

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4 mb-1">
        <p className="label">{t("label")}</p>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isComplete ? "bg-[#4CC4A41A] text-[#4CC4A4]" : "bg-[#D4A2541A] text-[#D4A254]"
          }`}
        >
          {isComplete ? t("complete") : t("incomplete")}
        </span>
      </div>

      <p className="text-sm text-[#7BA8C4] mb-4">{t("body")}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-[#6A97B4] mb-1 block">{t("country")}</label>
          <select value={form.country} onChange={(e) => update("country", e.target.value)} className={selectBase}>
            <option value="">{t("countryUnselected")}</option>
            <option value="FR">{t("countryFrance")}</option>
            <option value="other">{t("countryOther")}</option>
          </select>
        </div>

        {isFrance && (
          <>
            <div>
              <label className="text-xs text-[#6A97B4] mb-1 block">{t("legalStatus")}</label>
              <select value={form.businessLegalStatus} onChange={(e) => update("businessLegalStatus", e.target.value)} className={selectBase}>
                <option value="">{t("legalStatusUnselected")}</option>
                <option value="micro_entrepreneur">{t("legalStatusMicroEntrepreneur")}</option>
                <option value="other">{t("legalStatusOther")}</option>
                <option value="unsure">{t("legalStatusUnsure")}</option>
              </select>
            </div>

            {isMicro && (
              <>
                <div>
                  <label className="text-xs text-[#6A97B4] mb-1 block">{t("activityType")}</label>
                  <select value={form.activityType} onChange={(e) => update("activityType", e.target.value)} className={selectBase}>
                    <option value="">{t("activityTypeUnselected")}</option>
                    {ACTIVITY_OPTIONS.map((a) => (
                      <option key={a} value={a}>{t(`activityTypeOptions.${a}`)}</option>
                    ))}
                  </select>
                  {form.activityType === "cipav_liberal" && (
                    <p className="text-xs text-[#4A7A9B] mt-1.5 leading-relaxed">{t("cipavHint")}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-[#6A97B4] mb-1 block">{t("versementLiberatoire")}</label>
                  <p className="text-xs text-[#4A7A9B] mb-1.5 leading-relaxed">{t("versementLiberatoireHint")}</p>
                  <select value={form.versementLiberatoireStatus} onChange={(e) => update("versementLiberatoireStatus", e.target.value)} className={selectBase}>
                    <option value="">{t("threeWayUnselected")}</option>
                    <option value="yes">{t("threeWayYes")}</option>
                    <option value="no">{t("threeWayNo")}</option>
                    <option value="unknown">{t("threeWayUnsure")}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#6A97B4] mb-1 block">{t("acre")}</label>
                  <p className="text-xs text-[#4A7A9B] mb-1.5 leading-relaxed">{t("acreHint")}</p>
                  <select value={form.acreStatus} onChange={(e) => update("acreStatus", e.target.value)} className={selectBase}>
                    <option value="">{t("threeWayUnselected")}</option>
                    <option value="yes">{t("threeWayYes")}</option>
                    <option value="no">{t("threeWayNo")}</option>
                    <option value="unknown">{t("threeWayUnsure")}</option>
                  </select>
                </div>

                {needsAcreStartDate && (
                  <div>
                    <label className="text-xs text-[#6A97B4] mb-1 block">{t("activityStartDate")}</label>
                    <input type="date" className={selectBase} value={form.activityStartDate} onChange={(e) => update("activityStartDate", e.target.value)} />
                  </div>
                )}

                <div>
                  <label className="text-xs text-[#6A97B4] mb-1 block">{t("urssafFrequency")}</label>
                  <select value={form.urssafFrequency} onChange={(e) => update("urssafFrequency", e.target.value)} className={selectBase}>
                    <option value="">{t("threeWayUnselected")}</option>
                    <option value="monthly">{t("urssafMonthly")}</option>
                    <option value="quarterly">{t("urssafQuarterly")}</option>
                    <option value="unknown">{t("threeWayUnsure")}</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? t("save") : saved ? t("saved") : t("save")}
      </button>
      {error && <p className="text-xs text-[#E5484D] mt-2">{error}</p>}
    </div>
  );
}
