"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { BRAND_FONT_OPTIONS, DEFAULT_BRAND_FONT_KEY } from "@/lib/brand-font-options";

interface Props {
  brandLogoUrl: string | null;
  brandAccentColor: string | null;
  brandFont: string | null;
  businessName: string | null;
}

const DEFAULT_ACCENT = "#2FA393";

export default function BrandingSection({ brandLogoUrl, brandAccentColor, brandFont, businessName }: Props) {
  const t = useTranslations("settings.branding");
  const router = useRouter();

  const [logoUrl, setLogoUrl] = useState(brandLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [form, setForm] = useState({
    accentColor: brandAccentColor ?? DEFAULT_ACCENT,
    font: brandFont ?? DEFAULT_BRAND_FONT_KEY,
    businessName: businessName ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setLogoError(null);
    try {
      const presignRes = await fetch(`/api/branding/logo/presign?filename=${encodeURIComponent(file.name)}`);
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setLogoError(presignData.error ?? t("logo.uploadError"));
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("brand-logos")
        .uploadToSignedUrl(presignData.storagePath, presignData.token, file);
      if (uploadError) {
        setLogoError(t("logo.uploadError"));
        return;
      }

      const saveRes = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandLogoUrl: presignData.publicUrl }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setLogoError(saveData.error ?? t("logo.uploadError"));
        return;
      }
      setLogoUrl(presignData.publicUrl);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandAccentColor: form.accentColor, brandFont: form.font, businessName: form.businessName.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error ?? t("saveError"));
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <p className="label mb-1">{t("label")}</p>
      <p className="text-sm text-[#7BA8C4] mb-5">{t("body")}</p>

      <div className="mb-5">
        <label className="text-xs text-[#6A97B4] mb-2 block">{t("businessName.label")}</label>
        <input
          className="bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full max-w-sm"
          value={form.businessName}
          onChange={(e) => update("businessName", e.target.value)}
          placeholder={t("businessName.placeholder")}
          maxLength={120}
        />
      </div>

      <div className="mb-5">
        <label className="text-xs text-[#6A97B4] mb-2 block">{t("logo.label")}</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-12 max-w-[160px] object-contain bg-white rounded-lg p-1.5" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-[#1A3048] border border-[#243F5E] flex-shrink-0" />
          )}
          <label className="btn-secondary text-sm cursor-pointer">
            {uploading ? t("logo.uploading") : logoUrl ? t("logo.replace") : t("logo.upload")}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              className="hidden"
              onChange={handleLogoChange}
              disabled={uploading}
            />
          </label>
        </div>
        {logoError && <p className="text-xs text-[#E5484D] mt-2">{logoError}</p>}
      </div>

      <div className="mb-5">
        <label className="text-xs text-[#6A97B4] mb-2 block">{t("color.label")}</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.accentColor}
            onChange={(e) => update("accentColor", e.target.value)}
            className="h-10 w-14 rounded-lg border border-[#243F5E] bg-transparent cursor-pointer"
          />
          <span className="text-sm text-[#A8C6E0] font-mono">{form.accentColor.toUpperCase()}</span>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-xs text-[#6A97B4] mb-2 block">{t("font.label")}</label>
        <select
          value={form.font}
          onChange={(e) => update("font", e.target.value)}
          className="bg-[#132537] border border-[#243F5E] rounded-xl px-3 py-2.5 text-sm text-[#E8F0F8] focus:outline-none focus:border-[#3AB5A0] min-h-[44px] w-full max-w-xs"
        >
          {BRAND_FONT_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? t("save") : saved ? t("saved") : t("save")}
      </button>
      {saveError && <p className="text-xs text-[#E5484D] mt-2">{saveError}</p>}

      <p className="text-xs text-[#4A7A9B] mt-4">{t("footer")}</p>
    </div>
  );
}
