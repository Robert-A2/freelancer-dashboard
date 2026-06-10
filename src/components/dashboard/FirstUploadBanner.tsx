"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Insight } from "@/lib/insight-types";
import InsightText from "@/components/ui/InsightText";

interface Props {
  months: number;
  transactions: number;
  summary?: Insight | null;
  firstName: string;
}

export default function FirstUploadBanner({ months, transactions, summary, firstName }: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard.firstUpload");
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    setDismissed(true);
    router.replace("/dashboard");
  }

  if (dismissed) return null;

  const bold = (chunks: React.ReactNode) => <span className="text-[#E8F0F8] font-semibold">{chunks}</span>;

  return (
    <div className="bg-[#3AB5A00A] border border-[#3AB5A020] rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="label mb-1">{t("ready")}</p>
          <h2 className="text-xl font-semibold text-[#E8F0F8]">
            {firstName ? t("welcome", { name: firstName }) : t("welcomeGeneric")}
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="text-[#6A97B4] hover:text-[#7BA8C4] transition-colors p-1 flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
          aria-label={t("dismiss")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm text-[#7BA8C4] mb-3">
        <span>{t.rich("monthsOfHistory", { count: months, b: bold })}</span>
        <span className="text-[#243F5E]">·</span>
        <span>{t.rich("transactionsAnalysed", { count: transactions, b: bold })}</span>
      </div>

      {summary && (
        <p className="text-sm text-[#A8C6E0] mb-5 leading-relaxed border-l-2 border-[#3AB5A0] pl-3">
          <InsightText insight={summary} />
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/forecast" className="btn-primary text-sm text-center">
          {t("seeForecast")}
        </Link>
        <Link href="/analytics" className="btn-secondary text-sm text-center">
          {t("exploreAnalytics")}
        </Link>
        <button
          onClick={dismiss}
          className="text-sm text-[#6A97B4] hover:text-[#7BA8C4] transition-colors px-3 py-2 text-center"
        >
          {t("dismiss")}
        </button>
      </div>
    </div>
  );
}
