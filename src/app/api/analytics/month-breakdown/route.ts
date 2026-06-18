import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")  ?? "");
  const month = parseInt(searchParams.get("month") ?? "");

  if (isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  const since = new Date(Date.UTC(year, month - 1, 1));
  const until = new Date(Date.UTC(year, month,     1)); // exclusive

  const base = { userId: user.id, transactionDate: { gte: since, lt: until } };

  const [expenseGroups, incomeGroups] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: { ...base, transactionType: "expense" },
      _sum:   { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: { ...base, transactionType: "income" },
      _sum:   { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);

  const expenseCategories = expenseGroups.map(g => ({
    category: g.category ?? "uncategorized",
    total:    Number(g._sum.amount ?? 0),
    count:    g._count.id,
  }));

  const incomeCategories = incomeGroups.map(g => ({
    category: g.category ?? "uncategorized",
    total:    Number(g._sum.amount ?? 0),
    count:    g._count.id,
  }));

  return NextResponse.json({
    year,
    month,
    totalExpenses: expenseCategories.reduce((s, c) => s + c.total, 0),
    totalIncome:   incomeCategories.reduce((s, c) => s + c.total, 0),
    expenseCategories,
    incomeCategories,
  });
}
