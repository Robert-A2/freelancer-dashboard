import { prisma } from "../prisma";
import type { MerchantConfidenceInputs } from "./types";

/**
 * Numeric (0-100) merchant confidence from available signals. Reporting/UI
 * input only in v1 — does NOT feed engine.ts's matching waterfall (that
 * stays on its own proven coarse high/medium/low tier). See resolve.ts for
 * why this degrades gracefully with near-zero users instead of requiring
 * scale to be meaningful.
 */
export function computeMerchantConfidence(inputs: MerchantConfidenceInputs): number {
  const base = { high: 90, medium: 65, low: 35, unknown: 15 }[inputs.tier];
  const popularityBonus = Math.min(10, Math.floor(Math.log2(inputs.popularity + 1)) * 2);

  const totalFeedback = inputs.agreeCount + inputs.disagreeCount;
  // Gated behind >= 2 data points — a single correction should never swing
  // the score; that's not enough evidence to call it agreement or disagreement.
  const agreementBonus = totalFeedback >= 2
    ? Math.round(((inputs.agreeCount - inputs.disagreeCount) / totalFeedback) * 15)
    : 0;

  return Math.max(0, Math.min(100, base + popularityBonus + agreementBonus));
}

/**
 * Recomputes and persists globalConfidence for one merchant from its current
 * popularity + feedback state. Called on Merchant creation and whenever
 * MerchantFeedback changes (see recategorize/route.ts) — a single-row
 * operation, cheap enough to run inline rather than batching.
 */
export async function recomputeMerchantConfidence(merchantId: string): Promise<void> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { confidence: true, popularity: true, feedback: { select: { agreeCount: true, disagreeCount: true } } },
  });
  if (!merchant) return;

  const agreeCount = merchant.feedback.reduce((s, f) => s + f.agreeCount, 0);
  const disagreeCount = merchant.feedback.reduce((s, f) => s + f.disagreeCount, 0);

  const globalConfidence = computeMerchantConfidence({
    tier: merchant.confidence as MerchantConfidenceInputs["tier"],
    popularity: merchant.popularity,
    agreeCount,
    disagreeCount,
  });

  await prisma.merchant.update({
    where: { id: merchantId },
    data: { globalConfidence, confidenceBreakdown: { tier: merchant.confidence, popularity: merchant.popularity, agreeCount, disagreeCount } },
  });
}
