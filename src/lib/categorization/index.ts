export type { Confidence, CategorizationResult, LearnedRules, MerchantEntry, MerchantPack, DbMerchantRow, MerchantIndex, DecisionIndex, DecisionMerchantData } from "./types";
export { categorizeTransaction, normalizeMerchantKey, stripDiacritics } from "./engine";
export { buildMerchantIndex, buildDecisionIndex } from "./merchant-db";
