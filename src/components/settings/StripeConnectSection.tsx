"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Status = "notConnected" | "pending" | "connected";

export default function StripeConnectSection({ status }: { status: Status }) {
  const t = useTranslations("settings.payments");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4 mb-1">
        <p className="label">{t("label")}</p>
        {status === "connected" && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4CC4A41A] text-[#4CC4A4]">
            {t("connectedLabel")}
          </span>
        )}
      </div>

      <p className="text-sm text-[#7BA8C4] mb-4">
        {status === "connected" ? t("connectedBody") : status === "pending" ? t("pendingBody") : t("notConnectedBody")}
      </p>

      {status !== "connected" && (
        <button onClick={handleConnect} disabled={loading} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? t("connecting") : status === "pending" ? t("finishSetup") : t("connect")}
        </button>
      )}
    </div>
  );
}
