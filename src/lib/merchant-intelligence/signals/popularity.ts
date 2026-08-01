import type { Signal } from "./types";

// Log-scaled, capped at +10 — identical shape to computeMerchantConfidence()'s
// own popularity bonus (see ../confidence.ts), reused here so a merchant's
// popularity means the same thing in both places.
export const popularitySignal: Signal = (ctx) => {
  if (!ctx.merchant || ctx.merchant.popularity <= 0) return { present: false, weight: 0 };
  return {
    present: true,
    category: ctx.merchant.category,
    weight: Math.min(10, Math.floor(Math.log2(ctx.merchant.popularity + 1)) * 2),
    reason: `Seen ${ctx.merchant.popularity} time(s) across users`,
  };
};
