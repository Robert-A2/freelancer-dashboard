import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { normalizeMerchantKey, type CategorizationResult } from "@/lib/categorization";
import { resolveMerchantForDescription, recomputeMerchantConfidence } from "@/lib/merchant-intelligence";

// Mirrors the transactionType derivation in categorizeTransaction()'s learned-rule
// layer: savings/transfer categories carry a fixed type, everything else is
// income/expense based on the transaction's own signed amount.
function deriveTransactionType(category: string, signedAmount: number): CategorizationResult["transactionType"] {
  if (category === "savings") return "savings";
  if (category === "transfer") return "transfer";
  return signedAmount > 0 ? "income" : "expense";
}

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
      select: { id: true, description: true, category: true, amount: true, transactionType: true },
    });

    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    let affectedCount = 1;

    if (applyToSimilar) {
      // Update every transaction with the same description — fixes all future and past entries.
      // Each transaction's transactionType is re-derived from its OWN signed amount
      // (stored amounts are absolute values; sign is recovered from the existing
      // transactionType), so e.g. a refund and a charge sharing a description don't
      // both get forced to the same income/expense type.
      const similar = await prisma.transaction.findMany({
        where: { userId: user.id, description: tx.description },
        select: { id: true, amount: true, transactionType: true },
      });
      await prisma.$transaction(
        similar.map((t) => {
          const amount = Number(t.amount);
          const signedAmount = t.transactionType === "income" ? amount : -amount;
          return prisma.transaction.update({
            where: { id: t.id },
            data: {
              category: newCategory,
              categoryConfidence: "high",
              categorySource: "learned",
              categoryReason: null,
              transactionType: deriveTransactionType(newCategory, signedAmount),
            },
          });
        })
      );
      affectedCount = similar.length;
    } else {
      const amount = Number(tx.amount);
      const signedAmount = tx.transactionType === "income" ? amount : -amount;
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          category: newCategory,
          categoryConfidence: "high",
          categorySource: "learned",
          categoryReason: null,
          transactionType: deriveTransactionType(newCategory, signedAmount),
        },
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

    // Merchant Intelligence feedback loop — anonymized cross-user signal
    // (see MerchantFeedback in schema.prisma). Best-effort and non-blocking:
    // a human correction is real signal, but this must never fail or slow
    // down the user's actual category change. Expense-side only, matching
    // extractMerchantCandidate()'s scope — income-side identity belongs to
    // payer-engine.ts, not this pipeline. Gated to at most one increment per
    // correction event (including bulk applyToSimilar, which still only
    // touches the one anchor transaction here) so repeated corrections from
    // a single user can't skew the aggregate signal.
    if (tx.transactionType === "expense") {
      try {
        const merchantId = await resolveMerchantForDescription(tx.description);
        if (merchantId) {
          const isFirstAssignment = tx.category === "uncategorized";
          const isGenuineChange = !isFirstAssignment && tx.category !== newCategory;

          if (isFirstAssignment || isGenuineChange) {
            await prisma.merchantFeedback.upsert({
              where: { merchantId_category: { merchantId, category: newCategory } },
              update: { agreeCount: { increment: 1 } },
              create: { merchantId, category: newCategory, agreeCount: 1 },
            });
            if (isGenuineChange) {
              await prisma.merchantFeedback.upsert({
                where: { merchantId_category: { merchantId, category: tx.category } },
                update: { disagreeCount: { increment: 1 } },
                create: { merchantId, category: tx.category, disagreeCount: 1 },
              });
            }
            await recomputeMerchantConfidence(merchantId);
          }
        }
      } catch (err) {
        console.error("Merchant feedback update failed (non-critical):", err);
      }
    }

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

    // Recalculate monthly analytics, then regenerate the forecast from the updated
    // analytics so dashboards, charts, and forecasts all reflect the change.
    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Recategorize error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}
