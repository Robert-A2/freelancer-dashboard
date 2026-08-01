import type { DbMerchantRow, DecisionIndex, MerchantEntry, MerchantIndex } from "./types";
import { stripDiacritics } from "./engine";

export type { DbMerchantRow, MerchantIndex, DecisionIndex };

const EMPTY_INDEX: MerchantIndex = {
  expenseHigh: [],
  expenseMedium: [],
  incomePatterns: [],
  savingsKeywords: [],
  transferKeywords: [],
};

/**
 * Expands each DB merchant row (canonical keyword + aliases) into the bucket
 * matching its transactionType, normalizing every keyword the same way the
 * static packs are (lowercased, diacritic-stripped) so DB entries match
 * regardless of accents in the seed data.
 */
export function buildMerchantIndex(rows: DbMerchantRow[]): MerchantIndex {
  if (rows.length === 0) return EMPTY_INDEX;

  const index: MerchantIndex = {
    expenseHigh: [],
    expenseMedium: [],
    incomePatterns: [],
    savingsKeywords: [],
    transferKeywords: [],
  };

  for (const row of rows) {
    const keywords = [row.keyword, ...row.aliases].map((k) => stripDiacritics(k.toLowerCase()));

    switch (row.transactionType) {
      case "income":
        index.incomePatterns.push({ keywords, subcategory: row.category, confidence: row.confidence, merchantId: row.id });
        break;
      case "savings":
        index.savingsKeywords.push(...keywords);
        break;
      case "transfer":
        index.transferKeywords.push(...keywords);
        break;
      case "expense":
      default: {
        // MerchantEntry only distinguishes "high"/"medium" — a "low" confidence
        // DB merchant is treated as a medium-confidence (Layer 3 keyword) match.
        const bucket = row.confidence === "high" ? index.expenseHigh : index.expenseMedium;
        const confidence: MerchantEntry["confidence"] = row.confidence === "high" ? "high" : "medium";
        for (const keyword of keywords) {
          bucket.push({ keyword, category: row.category, confidence, merchantId: row.id });
        }
        break;
      }
    }
  }

  return index;
}

/**
 * Builds the Decision Engine's per-merchant signal data (Phase 3), keyed by
 * Merchant.id. Deliberately separate from buildMerchantIndex() — see
 * DecisionIndex's doc comment in types.ts for why. Expense-only, matching
 * the Decision Engine's own scope (extractMerchantCandidate/resolveMerchants
 * are expense-only too).
 */
export function buildDecisionIndex(rows: DbMerchantRow[]): DecisionIndex {
  const index: DecisionIndex = new Map();
  for (const row of rows) {
    if (row.transactionType !== "expense" || !row.id) continue;
    index.set(row.id, {
      category: row.category,
      confidence: row.confidence,
      popularity: row.popularity ?? 0,
      country: row.country ?? null,
      parentCompany: row.parentCompany ?? null,
      feedback: row.feedback ?? [],
    });
  }
  return index;
}
