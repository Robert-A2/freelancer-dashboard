export { extractMerchantCandidate } from "./extract";
export { resolveMerchants, resolveMerchantForDescription } from "./resolve";
export { computeMerchantConfidence, recomputeMerchantConfidence } from "./confidence";
export type { MerchantExtraction, MerchantResolutionOptions, MerchantConfidenceInputs } from "./types";

// Decision Engine (Phase 2 of the Decision Engine plan) — standalone as of
// this export, not yet wired into categorizeTransaction() (that's Phase 3).
export { computeDecisionScore, SIGNAL_REGISTRY } from "./signals";
export type { DecisionResult, SignalContext, SignalResult, SignalMerchantInfo, SignalFeedbackInfo } from "./signals";
