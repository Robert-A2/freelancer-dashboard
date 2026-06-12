import { prisma } from "./prisma";
import { buildMerchantIndex, normalizeMerchantKey, type Confidence, type MerchantIndex } from "./categorization";

/**
 * Loads every active `Merchant` (with its aliases) and merges them into a
 * `MerchantIndex` for `categorizeTransaction`/`parseCsv`. Called once per
 * upload or recategorize-all pass.
 */
export async function loadMerchantIndex(): Promise<MerchantIndex> {
  const merchants = await prisma.merchant.findMany({
    where: { isActive: true },
    include: { aliases: true },
  });

  return buildMerchantIndex(
    merchants.map((m) => ({
      keyword: m.keyword,
      transactionType: m.transactionType,
      category: m.category,
      confidence: m.confidence as Confidence,
      aliases: m.aliases.map((a) => a.keyword),
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
