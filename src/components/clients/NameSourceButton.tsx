"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  description: string;
  fingerprint: string;
}

export default function NameSourceButton({ description, fingerprint }: Props) {
  const router = useRouter();
  const t = useTranslations("clients.unresolved");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, newName: trimmed }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      router.refresh();
    } catch {
      setError(t("error"));
      setSaving(false);
    }
  }

  if (done) {
    return <p className="text-xs text-[#4CC4A4] mt-1">{t("saved")}</p>;
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="mt-1 text-xs text-[#4A7A9B] hover:text-[#3AB5A0] transition-colors"
      >
        {t("nameCta")}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 mt-2"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={60}
        className="flex-1 bg-[#1A3048] border border-[#243F5E] rounded-lg px-3 py-1.5 text-xs text-[#E8F0F8] placeholder:text-[#4A7A9B] focus:outline-none focus:border-[#3AB5A0]"
        placeholder={t("inputPlaceholder")}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving || !value.trim()}
        className="px-3 py-1.5 bg-[#3AB5A0] text-[#0C1E2E] text-xs font-semibold rounded-lg disabled:opacity-50 transition-opacity"
      >
        {saving ? "…" : t("save")}
      </button>
      <button
        onClick={() => { setOpen(false); setValue(""); }}
        className="text-xs text-[#6A97B4] hover:text-[#A8C6E0] transition-colors"
      >
        {t("cancel")}
      </button>
      {error && <p className="text-xs text-[#E5484D]">{error}</p>}
    </div>
  );
}
