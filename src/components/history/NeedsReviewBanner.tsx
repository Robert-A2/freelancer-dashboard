"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NeedsReviewBanner({ count }: { count: number }) {
  const [dismissed, setDismissed] = useState(false);
  const t = useTranslations("history.needsReview");
  if (dismissed || count === 0) return null;

  return (
    <div className="bg-[#D4A2540A] border border-[#D4A25420] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm text-[#A8C6E0]">
        {t.rich("message", {
          count,
          b: (chunks) => <span className="text-[#D4A254] font-semibold">{chunks}</span>,
        })}
      </p>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link href="/history?confidence=low" className="text-sm text-[#D4A254] hover:text-[#E0B068] font-medium transition-colors">
          {t("reviewNow")}
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-sm text-[#6A97B4] hover:text-[#7BA8C4] transition-colors"
          aria-label={t("dismiss")}
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
