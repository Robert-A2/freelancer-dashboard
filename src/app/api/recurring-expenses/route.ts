import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getOrCreateManualAccount } from "@/lib/manual-accounts";
import { syncRecurringExpenses } from "@/lib/recurring-expense-engine";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount, merchantName, category, tag, dayOfMonth } = body as {
      amount?: number;
      merchantName?: string;
      category?: string;
      tag?: "business" | "personal";
      dayOfMonth?: number;
    };

    if (!Number.isFinite(amount) || (amount as number) <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }
    if (!merchantName?.trim()) {
      return NextResponse.json({ error: "Merchant name is required." }, { status: 400 });
    }
    if (!category?.trim()) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }
    if (tag !== "business" && tag !== "personal") {
      return NextResponse.json({ error: "tag must be business or personal." }, { status: 400 });
    }
    if (!Number.isInteger(dayOfMonth) || (dayOfMonth as number) < 1 || (dayOfMonth as number) > 28) {
      return NextResponse.json({ error: "Day of month must be between 1 and 28." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, fullName: user.user_metadata?.full_name ?? "", email: user.email ?? "" },
    });

    const account = await getOrCreateManualAccount(user.id, tag);

    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        userId: user.id,
        accountId: account.id,
        merchantName: merchantName.trim(),
        category,
        amount: new Decimal(amount as number),
        dayOfMonth: dayOfMonth as number,
      },
    });

    // Materialize this month's (and any already-elapsed) transaction rows
    // immediately, so "Known Monthly Commitments" and cash position reflect
    // it right away rather than waiting for the next Dashboard-visit sync.
    await syncRecurringExpenses(user.id);

    return NextResponse.json({ recurringExpense });
  } catch (error) {
    console.error("Create recurring expense error:", error);
    return NextResponse.json({ error: "Failed to save recurring expense" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const recurringExpenses = await prisma.recurringExpense.findMany({
      where: { userId: user.id, isActive: true },
      include: { account: { select: { accountType: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ recurringExpenses });
  } catch (error) {
    console.error("List recurring expenses error:", error);
    return NextResponse.json({ error: "Failed to load recurring expenses" }, { status: 500 });
  }
}
