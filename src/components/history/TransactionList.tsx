"use client";

import { useState } from "react";
import { formatCurrency } from "@/utils/finance";
import RecategorizeButton from "./RecategorizeButton";

const INITIAL = 15;

const TYPE_COLORS: Record<string, string> = {
  income: "text-[#4CC4A4]", expense: "text-[#D4A254]",
  savings: "text-[#7BA8C4]", transfer: "text-[#6A97B4]",
};
const TYPE_PREFIX: Record<string, string> = {
  income: "+", expense: "−", savings: "→", transfer: "⇄",
};

interface TxRow {
  id: string;
  description: string;
  transactionDate: string;
  category: string;
  transactionType: string;
  amount: number;
}

export default function TransactionList({ transactions }: { transactions: TxRow[] }) {
  const [expanded, setExpanded] = useState(false);

  const visible   = expanded ? transactions : transactions.slice(0, INITIAL);
  const remaining = transactions.length - INITIAL;

  return (
    <div className="card">
      <div className="divide-y divide-[#243F5E]">
        {visible.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between py-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#E8F0F8] truncate">{tx.description}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-[#6A97B4]">
                  {new Date(tx.transactionDate).toLocaleDateString("en-IE", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
                <RecategorizeButton
                  transactionId={tx.id}
                  currentCategory={tx.category}
                  description={tx.description}
                />
              </div>
            </div>
            <span className={`text-sm font-semibold whitespace-nowrap flex-shrink-0 ${TYPE_COLORS[tx.transactionType] ?? "text-[#7BA8C4]"}`}>
              {TYPE_PREFIX[tx.transactionType]}{formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>

      {!expanded && remaining > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A3048] hover:bg-[#1E3550] text-sm text-[#A8C6E0] font-medium transition-colors"
        >
          Show {remaining} more transaction{remaining !== 1 ? "s" : ""}
          <svg className="w-4 h-4 text-[#6A97B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {expanded && transactions.length > INITIAL && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A3048] hover:bg-[#1E3550] text-sm text-[#A8C6E0] font-medium transition-colors"
        >
          Show less
          <svg className="w-4 h-4 text-[#6A97B4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
