export type { Confidence, CategorizationResult, LearnedRules, MerchantEntry, MerchantPack, DbMerchantRow, MerchantIndex } from "./types";
export { categorizeTransaction, normalizeMerchantKey, stripDiacritics } from "./engine";
export { buildMerchantIndex } from "./merchant-db";
