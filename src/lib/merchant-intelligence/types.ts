// Types for the merchant-intelligence pipeline — extraction, resolution, and
// confidence for the expense/service side, mirroring payer-engine.ts's proven
// shape for the income side (see resolve.ts's header comment for the mapping).

export interface MerchantExtraction {
  /** Cleaned display candidate, e.g. "XYZ Consulting" — never the raw description. */
  candidateName: string;
  /** Stable identity key from normalizeMatchKey() — used for dedup against existing Merchant rows. */
  normalizedKey: string;
  method: "processor-prefix-strip" | "chain-suffix-strip" | "raw";
}

/**
 * Optional AI-assist seam — reserved for a future fast-follow, never passed
 * by any v1 call site. Documented here so the interface exists before the
 * implementation does, per "merchant intelligence first, AI second": AI is
 * only ever consulted for a merchant this pipeline couldn't resolve on its
 * own, never as the primary path.
 */
export interface MerchantResolutionOptions {
  onUnknownMerchant?: (
    candidate: MerchantExtraction,
    context: { description: string; amount: number },
  ) => Promise<{ category: string; industry?: string; confidence: number; explanation: string } | null>;
}

export interface MerchantConfidenceInputs {
  tier: "high" | "medium" | "low" | "unknown";
  popularity: number;
  agreeCount: number;
  disagreeCount: number;
}
