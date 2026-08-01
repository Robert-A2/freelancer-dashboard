import type { Signal } from "./types";

// Weak, sparse, but real — Merchant.country is populated for a minority of
// rows (mostly the France pack). A small, fixed bonus: knowing the merchant's
// country is corroborating context, never enough on its own to change a decision.
export const countrySignal: Signal = (ctx) => {
  if (!ctx.merchant || !ctx.merchant.country) return { present: false, weight: 0 };
  return {
    present: true,
    category: ctx.merchant.category,
    weight: 2,
    reason: `Merchant country known (${ctx.merchant.country})`,
  };
};
