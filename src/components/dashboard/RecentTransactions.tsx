"use client";

import Link from "next/link";
import { formatCurrency } from "@/utils/finance";

interface Transaction {
  id: string; date: string; description: string; amount: number; type: string; category: string;
}
interface Props {
  transactions: Transaction[];
  notable?: string[];
}

const TYPE_STYLES: Record<string, string> = {
  income:   "text-[#5B8A72]",
  expense:  "text-[#C79A63]",
  savings:  "text-[#6B7280]",
  transfer: "text-[#9CA3AF]",
};
const TYPE_PREFIX: Record<string, string> = {
  income: "+", expense: "−", savings: "→", transfer: "⇄",
};

export default function RecentTransactions({ transactions, notable }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="card">
        <p className="label mb-2">Recent Activity</p>
        <p className="text-[#6B7280] text-sm">No transactions yet. Upload a CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="label mb-3">Recent Activity</p>

      {notable && notable.length > 0 && (
        <div className="mb-3 space-y-1">
          {notable.map((note, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2.5 bg-[#F7F8F5] rounded-lg">
              <span className="text-[#4F7A65] text-xs mt-0.5 flex-shrink-0">★</span>
              <p className="text-sm text-[#374151]">{note}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-0">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between py-3 border-b border-[#E8EAE5] last:border-0 gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1F2937] truncate">{tx.description}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-[#9CA3AF]">
                  {new Date(tx.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                </p>
                <span className="text-xs px-1.5 py-0.5 bg-[#F3F4F0] rounded text-[#6B7280] capitalize">
                  {tx.category}
                </span>
              </div>
            </div>
            <span className={`text-sm font-semibold whitespace-nowrap flex-shrink-0 ${TYPE_STYLES[tx.type] ?? "text-[#1F2937]"}`}>
              {TYPE_PREFIX[tx.type]}{formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-3 mt-1 border-t border-[#E8EAE5]">
        <Link
          href="/history"
          className="flex items-center justify-center gap-1.5 text-sm text-[#4F7A65] hover:text-[#3D6554] font-medium transition-colors py-1"
        >
          View all transactions
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
