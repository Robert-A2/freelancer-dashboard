import type { Signal } from "./types";

// The one signal that can vote for a DIFFERENT category than the merchant's
// recorded default — if enough users have corrected it toward something
// else, that category should genuinely be able to compete, not just in name.
// Gated to >= 2 feedback data points before contributing anything at all,
// matching computeMerchantConfidence()'s own gating (a single correction
// should never swing a decision).
//
// THREE weight scales, not two — found via a real end-to-end test, not
// designed upfront:
//  - REINFORCING the merchant's own recorded category: a modest nudge
//    (±15 max), the same scale computeMerchantConfidence() uses for its own
//    confidence bonus — this is corroboration, not a takeover.
//  - The recorded category is "uncategorized" — every newly-discovered
//    merchant starts here, and it is NEVER updated by the correction flow
//    (see recategorize/route.ts and resolveMerchantForDescription — only
//    MerchantFeedback records what users actually picked). This is not a
//    real category being defended, it's the absence of one, so it needs
//    nowhere near the volume required to overturn an actual choice — a
//    couple of clean corrections should be enough. Without this case,
//    identity + popularity for the stale "uncategorized" default permanently
//    outweighs real corrections requiring 20+ data points to compete,
//    silently defeating "future recognition" for the most common real-world
//    case: a brand-new merchant a user has already told the system about.
//  - PROPOSING a genuinely different category over one the merchant was
//    ACTIVELY recorded as: needs real weight to be able to outweigh the
//    identity signal's own tier base (35-90, see identity.ts), scaled by
//    both agreement ratio AND feedback volume (capped at 80) so a lone
//    correction can't override a real, deliberately-set category — only
//    overwhelming, high-volume cross-user consensus can.
export const globalAgreementSignal: Signal = (ctx) => {
  if (!ctx.merchant || ctx.feedback.length === 0) return { present: false, weight: 0 };

  let best = ctx.feedback[0];
  for (const f of ctx.feedback) {
    if (f.agreeCount - f.disagreeCount > best.agreeCount - best.disagreeCount) best = f;
  }

  const total = best.agreeCount + best.disagreeCount;
  if (total < 2) return { present: false, weight: 0 };

  const ratio = (best.agreeCount - best.disagreeCount) / total; // -1..1
  if (ratio <= 0) return { present: false, weight: 0 }; // net-negative consensus isn't a vote FOR anything

  const isRecordedCategory = best.category === ctx.merchant.category;
  const isUnrecorded = ctx.merchant.category === "uncategorized";

  let weight: number;
  if (isRecordedCategory) {
    weight = Math.round(ratio * 15);
  } else if (isUnrecorded) {
    weight = Math.round(ratio * 70);
  } else {
    weight = Math.round(Math.min(1, total / 20) * ratio * 80);
  }

  return {
    present: true,
    category: best.category,
    weight,
    reason: isRecordedCategory
      ? `${best.agreeCount} user(s) agreed, ${best.disagreeCount} disagreed on "${best.category}"`
      : `${best.agreeCount} user(s) corrected this to "${best.category}" (${best.disagreeCount} kept the old category)`,
  };
};
