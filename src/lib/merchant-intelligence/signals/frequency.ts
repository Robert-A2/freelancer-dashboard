import type { Signal } from "./types";

// This SAME user has seen this exact description before — a private,
// per-user repetition signal distinct from cross-user popularity. Requires
// >= 2 prior occurrences (one prior transaction could just be a coincidence);
// capped low (max 8) since it never has cross-user data behind it.
export const frequencySignal: Signal = (ctx) => {
  if (!ctx.merchant || ctx.sameDescriptionCount < 2) return { present: false, weight: 0 };
  return {
    present: true,
    category: ctx.merchant.category,
    weight: Math.min(8, ctx.sameDescriptionCount),
    reason: `You've had ${ctx.sameDescriptionCount} other transaction(s) with this same description`,
  };
};
