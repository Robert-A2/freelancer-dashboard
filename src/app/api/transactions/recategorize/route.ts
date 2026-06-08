import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { normalizeMerchantKey } from "@/lib/categorization";

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
      select: { id: true, description: true, category: true },
    });

    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const updateData = { category: newCategory, categoryConfidence: "high", categorySource: "learned" };
    let affectedCount = 1;

    if (applyToSimilar) {
      // Update every transaction with the same description — fixes all future and past entries
      const result = await prisma.transaction.updateMany({
        where: { userId: user.id, description: tx.description },
        data: updateData,
      });
      affectedCount = result.count;
    } else {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: updateData,
      });
    }

    // Learning loop: remember this merchant -> category mapping so future imports
    // (and the recategorize-all backfill) resolve it automatically next time.
    const merchantKey = normalizeMerchantKey(tx.description);
    await prisma.categoryRule.upsert({
      where: { userId_merchantKey: { userId: user.id, merchantKey } },
      create: { userId: user.id, merchantKey, category: newCategory },
      update: { category: newCategory, hitCount: { increment: 1 } },
    });

    // Audit log — powers "most corrected merchants" analytics
    await prisma.categoryCorrection.create({
      data: {
        userId: user.id,
        transactionId: tx.id,
        description: tx.description,
        fromCategory: tx.category,
        toCategory: newCategory,
        appliedToSimilar: !!applyToSimilar,
        affectedCount,
      },
    });

    // Recalculate monthly analytics so dashboards and forecasts reflect the change
    await recalculateMonthlyAnalytics(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Recategorize error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}
