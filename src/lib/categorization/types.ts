export type Confidence = "high" | "medium" | "low";

export interface CategorizationResult {
  transactionType: "income" | "expense" | "savings" | "transfer";
  category: string;
  confidence: Confidence;
  source: string;
}

/** Per-user learned mapping built from manual recategorizations: merchantKey -> category. */
export type LearnedRules = Map<string, string>;

/**
 * One recognizable merchant or descriptive keyword, matched as a lowercase
 * substring of the transaction description.
 *   "high"   — a specific brand/company name (Layers 1–2: exact/partial merchant match)
 *   "medium" — a generic descriptive word that strongly implies a category but
 *              could plausibly appear elsewhere (Layer 3: keyword recognition)
 */
export interface MerchantEntry {
  keyword: string;
  category: string;
  confidence: "high" | "medium";
}

/**
 * A bundle of merchant entries scoped to a single market. The engine merges
 * every active pack's entries into one lookup table at module-load time, so
 * adding a new country is purely a data change — drop a new file in `packs/`,
 * register it in `packs/index.ts`, and the engine itself never changes.
 */
export interface MerchantPack {
  id: string;
  label: string;
  entries: MerchantEntry[];
}

/**
 * Flattened shape of a `Merchant` row (plus its `MerchantAlias` rows) as
 * fetched from the database. Kept separate from the Prisma model types so
 * `src/lib/categorization` stays DB-agnostic and testable without a database.
 */
export interface DbMerchantRow {
  keyword: string;
  /** income | expense | savings | transfer */
  transactionType: string;
  category: string;
  confidence: Confidence;
  aliases: string[];
}

/**
 * Pre-merged lookup structure built once per categorization run (e.g. once per
 * CSV import or recategorize-all pass) and passed into `categorizeTransaction`.
 * Each bucket lines up with an existing static array in `engine.ts` and is
 * concatenated with it at the matching priority point.
 */
export interface MerchantIndex {
  expenseHigh: MerchantEntry[];
  expenseMedium: MerchantEntry[];
  incomePatterns: Array<{ keywords: string[]; subcategory: string; confidence: Confidence }>;
  savingsKeywords: string[];
  transferKeywords: string[];
}
