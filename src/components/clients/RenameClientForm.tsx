"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
  payerId: string;
  currentName: string;
  canonicalName: string;
}

export default function RenameClientForm({ payerId, currentName, canonicalName }: Props) {
  const router = useRouter();
  const tc = useTranslations("clients.rename");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/payers/${payerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push(`/clients/${encodeURIComponent(trimmed)}`);
      router.refresh();
    } catch {
      setError(tc("error"));
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      await fetch(`/api/payers/${payerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: "" }),
      });
      router.push(`/clients/${encodeURIComponent(canonicalName)}`);
      router.refresh();
    } catch {
      setError(tc("error"));
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[#4A7A9B] hover:text-[#3AB5A0] transition-colors"
      >
        {tc("editName")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={60}
          className="flex-1 bg-[#1A3048] border border-[#243F5E] rounded-lg px-3 py-1.5 text-sm text-[#E8F0F8] placeholder:text-[#4A7A9B] focus:outline-none focus:border-[#3AB5A0]"
          placeholder={tc("placeholder")}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="px-3 py-1.5 bg-[#3AB5A0] text-[#0C1E2E] text-xs font-semibold rounded-lg disabled:opacity-50 transition-opacity"
        >
          {saving ? "…" : tc("save")}
        </button>
        <button
          onClick={() => { setOpen(false); setValue(currentName); }}
          className="px-3 py-1.5 text-xs text-[#6A97B4] hover:text-[#A8C6E0] transition-colors"
        >
          {tc("cancel")}
        </button>
      </div>
      {currentName !== canonicalName && (
        <button onClick={handleReset} className="text-[11px] text-[#4A7A9B] hover:text-[#6A97B4] transition-colors self-start">
          {tc("resetToAuto", { name: canonicalName })}
        </button>
      )}
      {error && <p className="text-xs text-[#E5484D]">{error}</p>}
    </div>
  );
}
