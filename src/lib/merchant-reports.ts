import { prisma } from "./prisma";
import { buildMerchantIndex, buildDecisionIndex, normalizeMerchantKey, type Confidence, type MerchantIndex, type DecisionIndex } from "./categorization";

/**
 * Loads every active `Merchant` (with its aliases) and merges them into a
 * `MerchantIndex` for `categorizeTransaction`/`parseCsv`. Called once per
 * upload or recategorize-all pass.
 */
export async function loadMerchantIndex(): Promise<MerchantIndex> {
  const merchants = await prisma.merchant.findMany({
    where: { isActive: true },
    include: { aliases: true, feedback: true },
  });

  return buildMerchantIndex(
    merchants.map((m) => ({
      id: m.id,
      keyword: m.normalizedKey,
      transactionType: m.transactionType,
      category: m.category,
      confidence: m.confidence as Confidence,
      aliases: m.aliases.map((a) => a.keyword),
      popularity: m.popularity,
      country: m.country,
      feedback: m.feedback.map((f) => ({ category: f.category, agreeCount: f.agreeCount, disagreeCount: f.disagreeCount })),
    }))
  );
}

/**
 * Loads the Decision Engine's per-merchant signal data (Phase 3) — a
 * separate query from loadMerchantIndex() (see DecisionIndex's doc comment
 * in categorization/types.ts for why it's a separate structure). Called
 * alongside loadMerchantIndex() at the same call sites.
 */
export async function loadDecisionIndex(): Promise<DecisionIndex> {
  const merchants = await prisma.merchant.findMany({
    where: { isActive: true, transactionType: "expense" },
    include: { feedback: true },
  });

  return buildDecisionIndex(
    merchants.map((m) => ({
      id: m.id,
      keyword: m.normalizedKey,
      transactionType: m.transactionType,
      category: m.category,
      confidence: m.confidence as Confidence,
      aliases: [],
      popularity: m.popularity,
      country: m.country,
      parentCompany: m.parentCompany,
      feedback: m.feedback.map((f) => ({ category: f.category, agreeCount: f.agreeCount, disagreeCount: f.disagreeCount })),
    }))
  );
}

/**
 * Aggregates transactions that fell through to "uncategorized" into the
 * global `UncategorizedMerchantReport` table, grouped by normalized merchant
 * key. This is a cross-user signal — distinct from the per-user
 * `getCategorizationHealth.topUncategorizedMerchants` — used as a worklist
 * for the next merchant seed-data update (see scripts/uncategorized-report.ts).
 */
export async function reportUncategorizedMerchants(
  transactions: Array<{ description: string; category: string }>
): Promise<void> {
  const counts = new Map<string, { sample: string; count: number }>();

  for (const tx of transactions) {
    if (tx.category !== "uncategorized") continue;
    const key = normalizeMerchantKey(tx.description);
    if (!key) continue;

    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { sample: tx.description, count: 1 });
  }

  if (counts.size === 0) return;

  for (const [merchantKey, { sample, count }] of counts) {
    await prisma.uncategorizedMerchantReport.upsert({
      where: { merchantKey },
      update: { occurrenceCount: { increment: count }, lastSeenAt: new Date(), sampleDescription: sample },
      create: { merchantKey, sampleDescription: sample, occurrenceCount: count },
    });
  }
}
