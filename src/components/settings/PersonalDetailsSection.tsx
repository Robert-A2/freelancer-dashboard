"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  fullName: string;
  email: string;
}

export default function PersonalDetailsSection({ fullName, email }: Props) {
  const t = useTranslations("profile.personalDetails");
  const router = useRouter();

  const [name, setName] = useState(fullName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name }),
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

  return (
    <div className="card">
      <p className="label mb-1">{t("label")}</p>
      <p className="text-sm text-[#7BA8C4] mb-5">{t("body")}</p>

      <div className="mb-5">
        <label className="text-xs text-[#6A97B4] mb-2 block">{t("name.label")}</label>
        <input
          className="bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full max-w-sm"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          maxLength={120}
        />
      </div>

      <div className="mb-5">
        <label className="text-xs text-[#6A97B4] mb-2 block">{t("email.label")}</label>
        <p className="text-sm font-medium text-[#E8F0F8]">{email}</p>
        <p className="text-xs text-[#6A97B4] mt-1">{t("email.note")}</p>
      </div>

      <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? t("save") : saved ? t("saved") : t("save")}
      </button>
      {error && <p className="text-xs text-[#E5484D] mt-2">{error}</p>}
    </div>
  );
}
