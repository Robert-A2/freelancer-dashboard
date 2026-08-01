import type { Signal } from "./types";

// The base signal — is this description tied to a known Merchant identity at
// all. Weight mirrors computeMerchantConfidence()'s own tier bases (see
// ../confidence.ts) so the two stay consistent: a "high" tier Merchant means
// the same thing whether you're looking at reporting or at a live decision.
const TIER_BASE = { high: 90, medium: 65, low: 35 } as const;

export const identitySignal: Signal = (ctx) => {
  if (!ctx.merchant) return { present: false, weight: 0 };
  return {
    present: true,
    category: ctx.merchant.category,
    weight: TIER_BASE[ctx.merchant.confidence],
    reason: `Known merchant identity (${ctx.merchant.confidence} confidence tier)`,
  };
};
