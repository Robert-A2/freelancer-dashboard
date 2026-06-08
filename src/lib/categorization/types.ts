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
