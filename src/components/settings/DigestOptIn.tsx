"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setDigestOptIn } from "@/lib/digest-actions";

export default function DigestOptIn({ initialOptIn }: { initialOptIn: boolean }) {
  const t = useTranslations("settings.digest");
  const [optIn, setOptIn] = useState(initialOptIn);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !optIn;
    setOptIn(next);
    startTransition(async () => {
      await setDigestOptIn(next);
    });
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label mb-1">{t("label")}</p>
          <p className="text-sm text-[#6A97B4] leading-relaxed max-w-sm">{t("description")}</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isPending}
          role="switch"
          aria-checked={optIn}
          aria-label={t("optIn")}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-[#3AB5A0] focus:ring-offset-2 focus:ring-offset-[#0D2137]
            ${optIn ? "bg-[#3AB5A0]" : "bg-[#1E3A55]"}
            ${isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              optIn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {isPending && (
        <p className="text-xs text-[#4A7A9B] mt-3">{t("saving")}</p>
      )}
    </div>
  );
}
