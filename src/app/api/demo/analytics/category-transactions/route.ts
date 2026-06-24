import { NextResponse } from "next/server";
import { DEMO_TRANSACTIONS } from "@/lib/demo/transactions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const type     = searchParams.get("type") ?? "expense";
  const yearStr  = searchParams.get("year");
  const monthStr = searchParams.get("month");

  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

  let txs = DEMO_TRANSACTIONS.filter(
    tx => tx.category === category && tx.transactionType === type,
  );

  if (yearStr && monthStr) {
    const y = parseInt(yearStr);
    const m = parseInt(monthStr);
    txs = txs.filter(tx => {
      const d = tx.transactionDate;
      return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m;
    });
  }

  txs = [...txs].sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());

  const total = txs.reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    category,
    total,
    count: txs.length,
    transactions: txs.map(t => ({
      id: t.id,
      description: t.description,
      transactionDate: t.transactionDate.toISOString(),
      amount: t.amount,
      intent: t.intent ?? null,
      intentConfidence: t.intentConfidence ?? null,
    })),
  });
}
