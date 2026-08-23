import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";

// Edit/delete for a single manually-entered transaction (spec section 13:
// "editing manual entries, deleting manual entries with confirmation").
// Scoped to csvImportId === null so a CSV-imported row can never be reached
// through this route — CSV corrections go through the existing
// recategorize endpoints instead, which is a deliberately different,
// narrower operation (category only, never amount/date/description).
async function loadOwnedManualTransaction(userId: string, id: string) {
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.userId !== userId || tx.csvImportId !== null) return null;
  return tx;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await loadOwnedManualTransaction(user.id, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const { amount, description, category, date } = body as {
      amount?: number;
      description?: string;
      category?: string;
      date?: string;
    };

    const data: { amount?: Decimal; description?: string; category?: string; transactionDate?: Date } = {};
    if (amount !== undefined) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
      }
      data.amount = new Decimal(amount);
    }
    if (description !== undefined) {
      if (!description.trim()) return NextResponse.json({ error: "Description cannot be empty." }, { status: 400 });
      data.description = description.trim();
    }
    if (category !== undefined) {
      if (!category.trim()) return NextResponse.json({ error: "Category cannot be empty." }, { status: 400 });
      data.category = category;
    }
    if (date !== undefined) data.transactionDate = new Date(date);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.transaction.update({ where: { id }, data });

    // Recalculate factual totals across Dashboard/Analytics/Forecast (spec
    // section 33) — same synchronous-before-response pattern every other
    // write path in this app already uses.
    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    return NextResponse.json({ transaction: updated });
  } catch (error) {
    console.error("Update manual transaction error:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await loadOwnedManualTransaction(user.id, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.transaction.delete({ where: { id } });

    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete manual transaction error:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
