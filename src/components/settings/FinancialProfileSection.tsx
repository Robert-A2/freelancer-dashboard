"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  country: string | null;
  businessLegalStatus: string | null;
  activityType: string | null;
  vatStatus: string | null;
  isComplete: boolean;
}

export default function FinancialProfileSection({ country, businessLegalStatus, activityType, vatStatus, isComplete }: Props) {
  const t = useTranslations("settings.financialProfile");
  const router = useRouter();
  const [form, setForm] = useState({
    country: country ?? "",
    businessLegalStatus: businessLegalStatus ?? "",
    activityType: activityType ?? "",
    vatStatus: vatStatus ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const selectBase = "bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full";

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/financial-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country || null,
          businessLegalStatus: form.businessLegalStatus || null,
          activityType: form.activityType || null,
          vatStatus: form.vatStatus || null,
        }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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

        <div>
          <label className="text-xs text-[#6A97B4] mb-1 block">{t("legalStatus")}</label>
          <select value={form.businessLegalStatus} onChange={(e) => update("businessLegalStatus", e.target.value)} className={selectBase}>
            <option value="">{t("legalStatusUnselected")}</option>
            <option value="micro_entrepreneur">{t("legalStatusMicroEntrepreneur")}</option>
            <option value="other">{t("legalStatusOther")}</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-[#6A97B4] mb-1 block">{t("activityType")}</label>
          <select value={form.activityType} onChange={(e) => update("activityType", e.target.value)} className={selectBase}>
            <option value="">{t("activityTypeUnselected")}</option>
            <option value="bnc_liberal">{t("activityTypeBnc")}</option>
            <option value="bic_services">{t("activityTypeBicServices")}</option>
            <option value="bic_vente">{t("activityTypeBicVente")}</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-[#6A97B4] mb-1 block">{t("vatStatus")}</label>
          <select value={form.vatStatus} onChange={(e) => update("vatStatus", e.target.value)} className={selectBase}>
            <option value="">{t("vatStatusUnselected")}</option>
            <option value="exempt">{t("vatStatusExempt")}</option>
            <option value="registered">{t("vatStatusRegistered")}</option>
            <option value="unknown">{t("vatStatusUnknown")}</option>
          </select>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? t("save") : saved ? t("saved") : t("save")}
      </button>
    </div>
  );
}
