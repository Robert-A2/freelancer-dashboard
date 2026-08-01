import type { Signal, SignalContext } from "./types";
import { identitySignal } from "./identity";
import { popularitySignal } from "./popularity";
import { globalAgreementSignal } from "./globalAgreement";
import { frequencySignal } from "./frequency";
import { amountPatternSignal } from "./amountPattern";
import { countrySignal } from "./country";
import { parentCompanySignal } from "./parentCompany";
import {
  industrySignal,
  businessTypeSignal,
  websiteSignal,
  taxBehaviourSignal,
  businessFunctionSignal,
  merchantCategoryCodeSignal,
} from "./dormant";

export type { Signal, SignalContext, SignalResult, SignalMerchantInfo, SignalFeedbackInfo } from "./types";

// The extension point: adding a new signal later is "write one file + add
// one line here." Order doesn't affect scoring (computeDecisionScore sums
// every present signal's weight), only readability.
export const SIGNAL_REGISTRY: Array<{ name: string; run: Signal }> = [
  { name: "identity", run: identitySignal },
  { name: "popularity", run: popularitySignal },
  { name: "globalAgreement", run: globalAgreementSignal },
  { name: "frequency", run: frequencySignal },
  { name: "amountPattern", run: amountPatternSignal },
  { name: "country", run: countrySignal },
  { name: "industry", run: industrySignal },
  { name: "businessType", run: businessTypeSignal },
  { name: "parentCompany", run: parentCompanySignal },
  { name: "website", run: websiteSignal },
  { name: "taxBehaviour", run: taxBehaviourSignal },
  { name: "businessFunction", run: businessFunctionSignal },
  { name: "merchantCategoryCode", run: merchantCategoryCodeSignal },
];

export interface DecisionResult {
  category: string;
  /** 0-100. */
  confidence: number;
  tier: "high" | "medium" | "low";
  signalsUsed: string[];
  reason: string;
}

/**
 * Runs every registered signal against ctx and picks the highest-scoring
 * category. Absent signals contribute nothing (never a penalty) — see
 * SignalResult.present. Most real signals vote for ctx.merchant.category
 * (they're corroborating an already-known identity); only
 * globalAgreementSignal can propose a different category, when enough users'
 * corrections have moved a merchant's real-world category away from its
 * recorded default.
 *
 * Returns null when there's no merchant identity to evaluate at all — the
 * caller (Phase 3's wiring into categorizeTransaction) falls through to the
 * existing keyword waterfall unchanged in that case, exactly as it does
 * today for any transaction with no Merchant match.
 */
export function computeDecisionScore(ctx: SignalContext): DecisionResult | null {
  if (!ctx.merchant) return null;

  const fired = SIGNAL_REGISTRY
    .map(({ name, run }) => ({ name, result: run(ctx) }))
    .filter((s) => s.result.present);

  if (fired.length === 0) return null;

  const byCategory = new Map<string, { total: number; signalsUsed: string[]; reasons: string[] }>();
  for (const { name, result } of fired) {
    const category = result.category ?? ctx.merchant.category;
    const bucket = byCategory.get(category) ?? { total: 0, signalsUsed: [], reasons: [] };
    bucket.total += result.weight;
    bucket.signalsUsed.push(name);
    if (result.reason) bucket.reasons.push(result.reason);
    byCategory.set(category, bucket);
  }

  let winner: { category: string; total: number; signalsUsed: string[]; reasons: string[] } | null = null;
  for (const [category, bucket] of byCategory) {
    if (!winner || bucket.total > winner.total) winner = { category, ...bucket };
  }
  // Unreachable (fired.length > 0 guarantees at least one bucket), but keeps
  // the return type honest without a non-null assertion.
  if (!winner) return null;

  const confidence = Math.max(0, Math.min(100, winner.total));
  const tier: DecisionResult["tier"] = confidence >= 80 ? "high" : confidence >= 50 ? "medium" : "low";

  return {
    category: winner.category,
    confidence,
    tier,
    signalsUsed: winner.signalsUsed,
    reason: winner.reasons.join("; "),
  };
}
