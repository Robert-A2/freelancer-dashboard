import { NextResponse } from "next/server";
import { DEMO_TRANSACTIONS } from "@/lib/demo/transactions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")  ?? "");
  const month = parseInt(searchParams.get("month") ?? "");

  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  const txs = DEMO_TRANSACTIONS.filter(tx => {
    const d = tx.transactionDate;
    return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
  });

  const expenseMap = new Map<string, { total: number; count: number }>();
  const incomeMap  = new Map<string, { total: number; count: number }>();

  for (const tx of txs) {
    const cat = tx.category ?? "uncategorized";
    if (tx.transactionType === "expense") {
      const e = expenseMap.get(cat) ?? { total: 0, count: 0 };
      e.total += tx.amount;
      e.count += 1;
      expenseMap.set(cat, e);
    } else if (tx.transactionType === "income") {
      const e = incomeMap.get(cat) ?? { total: 0, count: 0 };
      e.total += tx.amount;
      e.count += 1;
      incomeMap.set(cat, e);
    }
  }

  const expenseCategories = [...expenseMap.entries()]
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);

  const incomeCategories = [...incomeMap.entries()]
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    year,
    month,
    totalExpenses: expenseCategories.reduce((s, c) => s + c.total, 0),
    totalIncome:   incomeCategories.reduce((s, c) => s + c.total, 0),
    expenseCategories,
    incomeCategories,
  });
}
