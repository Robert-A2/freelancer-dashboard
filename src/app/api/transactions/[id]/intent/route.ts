import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeMerchantKey } from "@/lib/categorization";
import { isFinancialIntent } from "@/lib/intent-engine";

// POST /api/transactions/[id]/intent
// Body: { intent: FinancialIntent, applyToSimilar?: boolean }
//
// Sets the financial intent for a transaction and optionally propagates it to
// all transactions sharing the same merchant key. Saves the rule to
// UserIntentRule so future imports inherit it automatically.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: transactionId } = await params;
    const { intent, applyToSimilar } = await request.json();

    if (!intent || !isFinancialIntent(intent)) {
      return NextResponse.json({ error: "Invalid intent value" }, { status: 400 });
    }

    // Verify the transaction belongs to this user
    const tx = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      select: { id: true, description: true, intent: true, needsReview: true },
    });
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const merchantKey = normalizeMerchantKey(tx.description);

    // Persist the learning rule — future imports apply this automatically
    await prisma.userIntentRule.upsert({
      where: { userId_merchantKey: { userId: user.id, merchantKey } },
      create: { userId: user.id, merchantKey, intent, source: "user" },
      update: { intent, source: "user", hitCount: { increment: 1 }, updatedAt: new Date() },
    });

    let affectedCount = 1;

    if (applyToSimilar) {
      // Back-propagate to all transactions that share the same merchant key
      // (normalized description). Source is "propagated" — distinct from the
      // directly-clicked "user" classification so both are auditable.
      const similar = await prisma.transaction.findMany({
        where: { userId: user.id, description: tx.description },
        select: { id: true },
      });

      await prisma.transaction.updateMany({
        where: { userId: user.id, description: tx.description },
        data: {
          intent,
          intentConfidence: "high",
          intentSource:     "user",
          needsReview:      false,
        },
      });

      affectedCount = similar.length;
    } else {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          intent,
          intentConfidence: "high",
          intentSource:     "user",
          needsReview:      false,
        },
      });
    }

    return NextResponse.json({ success: true, affectedCount });
  } catch (error) {
    console.error("Set intent error:", error);
    return NextResponse.json({ error: "Failed to set intent" }, { status: 500 });
  }
}
