import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, category, transactionType: "expense" },
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
