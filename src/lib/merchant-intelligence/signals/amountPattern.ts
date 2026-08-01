import type { Signal } from "./types";

// A consistent recurring amount (e.g. the same $54.99 every month) is
// evidence this is a genuine subscription/recurring merchant, not a one-off.
// amountConsistency is a pre-computed 0-1 ratio (how tightly past amounts for
// this description cluster) — this signal just tier-weights it; it does not
// compute the ratio itself (that needs a user's transaction history, which
// belongs to whichever layer builds SignalContext, not this pure module).
export const amountPatternSignal: Signal = (ctx) => {
  if (!ctx.merchant || ctx.amountConsistency <= 0) return { present: false, weight: 0 };
  const weight = Math.round(ctx.amountConsistency * 6);
  if (weight <= 0) return { present: false, weight: 0 };
  return {
    present: true,
    category: ctx.merchant.category,
    weight,
    reason: "Amount matches a consistent recurring pattern for this merchant",
  };
};
