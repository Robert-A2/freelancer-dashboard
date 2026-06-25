"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ExportDataButton() {
  const t = useTranslations("settings.export");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `freelancer-os-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="text-sm font-medium text-[#3AB5A0] hover:text-[#4CC4A4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? t("downloading") : t("cta")}
    </button>
  );
}
