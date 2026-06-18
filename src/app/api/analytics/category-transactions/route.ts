import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const type     = searchParams.get("type") ?? "expense";
  const since    = searchParams.get("since");
  const yearStr  = searchParams.get("year");
  const monthStr = searchParams.get("month");

  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

  // year+month takes precedence over since, giving an exact monthly range
  let dateFilter: { gte: Date; lt?: Date } | { gte: Date } | undefined;
  if (yearStr && monthStr) {
    const y = parseInt(yearStr);
    const m = parseInt(monthStr);
    dateFilter = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt:  new Date(Date.UTC(y, m,     1)),
    };
  } else if (since) {
    dateFilter = { gte: new Date(since) };
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      category,
      transactionType: type,
      ...(dateFilter ? { transactionDate: dateFilter } : {}),
    },
    orderBy: { transactionDate: "desc" },
    select: {
      id: true,
      description: true,
      transactionDate: true,
      amount: true,
      intent: true,
      intentConfidence: true,
    },
  });

  const total = transactions.reduce((s, t) => s + Number(t.amount), 0);

  return NextResponse.json({
    category,
    total,
    count: transactions.length,
    transactions: transactions.map((t) => ({
      id: t.id,
      description: t.description,
      transactionDate: t.transactionDate.toISOString(),
      amount: Number(t.amount),
      intent: t.intent,
      intentConfidence: t.intentConfidence,
    })),
  });
}
