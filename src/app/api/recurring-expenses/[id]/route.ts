import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { syncRecurringExpenses } from "@/lib/recurring-expense-engine";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { amount, merchantName, category, dayOfMonth } = body as {
      amount?: number;
      merchantName?: string;
      category?: string;
      dayOfMonth?: number;
    };

    const data: { amount?: Decimal; merchantName?: string; category?: string; dayOfMonth?: number } = {};
    if (amount !== undefined) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
      }
      data.amount = new Decimal(amount);
    }
    if (merchantName !== undefined) {
      if (!merchantName.trim()) return NextResponse.json({ error: "Merchant name cannot be empty." }, { status: 400 });
      data.merchantName = merchantName.trim();
    }
    if (category !== undefined) {
      if (!category.trim()) return NextResponse.json({ error: "Category cannot be empty." }, { status: 400 });
      data.category = category;
    }
    if (dayOfMonth !== undefined) {
      if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
        return NextResponse.json({ error: "Day of month must be between 1 and 28." }, { status: 400 });
      }
      data.dayOfMonth = dayOfMonth;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.recurringExpense.update({ where: { id }, data });
    await syncRecurringExpenses(user.id);

    return NextResponse.json({ recurringExpense: updated });
  } catch (error) {
    console.error("Update recurring expense error:", error);
    return NextResponse.json({ error: "Failed to update recurring expense" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.recurringExpense.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Soft delete — preserves already-generated Transaction history.
    // syncRecurringExpenses only ever materializes months for ACTIVE
    // recurring expenses, so no new rows get created going forward once
    // this flips, but past ones stay real.
    await prisma.recurringExpense.update({ where: { id }, data: { isActive: false } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete recurring expense error:", error);
    return NextResponse.json({ error: "Failed to delete recurring expense" }, { status: 500 });
  }
}
