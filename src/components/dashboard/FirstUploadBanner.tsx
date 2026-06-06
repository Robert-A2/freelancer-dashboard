"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  months: number;
  transactions: number;
  summary: string;
  firstName: string;
}

export default function FirstUploadBanner({ months, transactions, summary, firstName }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    setDismissed(true);
    router.replace("/dashboard");
  }

  if (dismissed) return null;

  return (
    <div className="bg-[#4F7A650A] border border-[#4F7A6520] rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="label mb-1">Your financial picture is ready</p>
          <h2 className="text-xl font-semibold text-[#1F2937]">
            {firstName ? `Welcome, ${firstName}.` : "Welcome."}
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors p-1 flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-3">
        <span>
          <span className="text-[#1F2937] font-semibold">{months}</span> month{months !== 1 ? "s" : ""} of history
        </span>
        <span className="text-[#E8EAE5]">·</span>
        <span>
          <span className="text-[#1F2937] font-semibold">{transactions.toLocaleString()}</span> transactions analysed
        </span>
      </div>

      {summary && (
        <p className="text-sm text-[#374151] mb-5 leading-relaxed border-l-2 border-[#4F7A65] pl-3">
          {summary}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/forecast" className="btn-primary text-sm text-center">
          See your forecast →
        </Link>
        <Link href="/analytics" className="btn-secondary text-sm text-center">
          Explore analytics
        </Link>
        <button
          onClick={dismiss}
          className="text-sm text-[#9CA3AF] hover:text-[#6B7280] transition-colors px-3 py-2 text-center"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
