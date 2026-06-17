import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { categorizeTransaction, type LearnedRules } from "@/lib/categorization";
import { loadMerchantIndex, reportUncategorizedMerchants } from "@/lib/merchant-reports";
import { classifyIntent, buildUserIntentRules } from "@/lib/intent-engine";
import { Prisma } from "@prisma/client";

const BATCH_SIZE = 500;

// Reusable re-categorization pass — re-runs the current engine (including the
// user's learned rules) against every stored transaction. Safe to call any
// time the categorization rules improve; only rows whose category, confidence,
// or source actually change are written.
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
    const ownerName = dbUser?.fullName || undefined;

    const [rules, intentRuleRows] = await Promise.all([
      prisma.categoryRule.findMany({
        where: { userId: user.id },
        select: { merchantKey: true, category: true },
      }),
      prisma.userIntentRule.findMany({
        where: { userId: user.id },
        select: { merchantKey: true, intent: true },
      }),
    ]);
    const learnedRules: LearnedRules = new Map(rules.map((r) => [r.merchantKey, r.category]));
    const userIntentRules = buildUserIntentRules(intentRuleRows);
    const merchantIndex = await loadMerchantIndex();

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: {
        id: true, description: true, amount: true, transactionType: true,
        category: true, categoryConfidence: true, categorySource: true,
        intent: true, intentConfidence: true, intentSource: true, needsReview: true,
      },
    });

    let changedCount = 0;
    const stillUncategorized: Array<{ description: string; category: string }> = [];

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const updates: Prisma.PrismaPromise<unknown>[] = [];

      for (const tx of batch) {
        // Stored amounts are absolute values; recover the original sign from the
        // existing transactionType so income/expense detection matches import-time behavior.
        const amount = Number(tx.amount);
        const signedAmount = tx.transactionType === "income" ? amount : -amount;
        const result = categorizeTransaction(tx.description, signedAmount, learnedRules, ownerName, merchantIndex);

        if (result.category === "uncategorized") {
          stillUncategorized.push({ description: tx.description, category: result.category });
        }

        // Re-run intent classification unless the user has explicitly set this intent.
        // intentSource:"user" means the user confirmed it — we never override that.
        const intentResult = tx.intentSource !== "user"
          ? classifyIntent(tx.description, result, userIntentRules)
          : null;

        const categoryChanged =
          result.category !== tx.category ||
          result.confidence !== tx.categoryConfidence ||
          result.source !== (tx.categorySource ?? null) ||
          result.transactionType !== tx.transactionType;

        const intentChanged = intentResult !== null && (
          intentResult.intent           !== (tx.intent ?? null) ||
          intentResult.intentConfidence !== (tx.intentConfidence ?? null) ||
          intentResult.intentSource     !== (tx.intentSource ?? null) ||
          intentResult.needsReview      !== tx.needsReview
        );

        if (categoryChanged || intentChanged) {
          if (categoryChanged) changedCount++;
          updates.push(
            prisma.transaction.update({
              where: { id: tx.id },
              data: {
                ...(categoryChanged ? {
                  category:          result.category,
                  categoryConfidence: result.confidence,
                  categorySource:    result.source,
                  transactionType:   result.transactionType,
                } : {}),
                ...(intentResult !== null ? {
                  intent:            intentResult.intent,
                  intentConfidence:  intentResult.intentConfidence,
                  intentSource:      intentResult.intentSource,
                  needsReview:       intentResult.needsReview,
                } : {}),
              },
            })
          );
        }
      }

      if (updates.length > 0) await prisma.$transaction(updates);
    }

    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    // ── Feed the global uncategorized-merchant worklist ────────────────────
    await reportUncategorizedMerchants(stillUncategorized);

    const newUncategorized = await prisma.transaction.count({
      where: { userId: user.id, category: "uncategorized" },
    });
    const totalScanned = transactions.length;
    const newUncategorizedPct = totalScanned > 0 ? (newUncategorized / totalScanned) * 100 : 0;

    return NextResponse.json({
      success: true,
      totalScanned,
      changedCount,
      newUncategorizedCount: newUncategorized,
      newUncategorizedPct: Math.round(newUncategorizedPct * 10) / 10,
    });
  } catch (error) {
    console.error("Recategorize-all error:", error);
    return NextResponse.json({ error: "Failed to re-run categorization" }, { status: 500 });
  }
}
