export type Confidence = "high" | "medium" | "low";

export interface CategorizationResult {
  transactionType: "income" | "expense" | "savings" | "transfer";
  category: string;
  confidence: Confidence;
  source: string;
  /** Set only when the winning entry came from the DB-backed merchantIndex — lets
   *  callers cheaply bump Merchant.popularity without re-deriving the match. */
  matchedMerchantId?: string;
  /** Set only when source === "intelligence" — the Decision Engine's own explanation. */
  reason?: string;
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
  /** Set only for DB-backed entries — absent for static-pack entries. */
  merchantId?: string;
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
  /** Absent only in hand-constructed test fixtures — every real DB-fetched row has one. */
  id?: string;
  keyword: string;
  /** income | expense | savings | transfer */
  transactionType: string;
  category: string;
  confidence: Confidence;
  aliases: string[];
  /** Decision Engine fields (Phase 3/4) — absent in hand-constructed test fixtures. */
  popularity?: number;
  country?: string | null;
  feedback?: Array<{ category: string; agreeCount: number; disagreeCount: number }>;
  parentCompany?: string | null;
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
  incomePatterns: Array<{ keywords: string[]; subcategory: string; confidence: Confidence; merchantId?: string }>;
  savingsKeywords: string[];
  transferKeywords: string[];
}

/**
 * Decision Engine data (Phase 3), keyed by Merchant.id — deliberately a
 * SEPARATE structure from MerchantIndex/MerchantEntry rather than new fields
 * bolted onto them: several existing tests pin MerchantEntry's exact shape
 * via `toEqual`, so adding always-present fields there would have broken
 * them. This index is looked up only AFTER `findBestMatch` already found a
 * candidate the normal way — it just supplies the richer signal data that
 * candidate's Merchant row carries, for `computeDecisionScore` to evaluate.
 * `confidence` here is the TRUE, uncoerced Merchant.confidence tier — unlike
 * MerchantEntry.confidence, which is coerced to "high"/"medium" only for the
 * existing bucket-matching system.
 */
export interface DecisionMerchantData {
  category: string;
  confidence: Confidence;
  popularity: number;
  country: string | null;
  parentCompany: string | null;
  feedback: Array<{ category: string; agreeCount: number; disagreeCount: number }>;
}
export type DecisionIndex = Map<string, DecisionMerchantData>;
