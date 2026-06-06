import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { transactionId, newCategory, applyToSimilar } = await request.json();

    if (!transactionId || !newCategory) {
      return NextResponse.json({ error: "Missing transactionId or newCategory" }, { status: 400 });
    }

    // Verify the transaction belongs to this user
    const tx = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      select: { id: true, description: true },
    });

    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    if (applyToSimilar) {
      // Update every transaction with the same description — fixes all future and past entries
      await prisma.transaction.updateMany({
        where: { userId: user.id, description: tx.description },
        data: { category: newCategory },
      });
    } else {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { category: newCategory },
      });
    }

    // Recalculate monthly analytics so dashboards and forecasts reflect the change
    await recalculateMonthlyAnalytics(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Recategorize error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}
