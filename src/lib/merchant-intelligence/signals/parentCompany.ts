import type { Signal } from "./types";

// Activated in Phase 4 (was a dormant stub in Phase 2) — Merchant.parentCompany
// is now populated for a small curated set of known product families (see
// scripts/seed-merchant-relationships.ts: Google, Meta, Adobe). Belonging to
// a known corporate family is real corroborating evidence — a small, fixed
// bonus, the same spirit as countrySignal: never enough on its own to change
// a decision, just one more real signal among several.
export const parentCompanySignal: Signal = (ctx) => {
  if (!ctx.merchant || !ctx.merchant.parentCompany) return { present: false, weight: 0 };
  return {
    present: true,
    category: ctx.merchant.category,
    weight: 3,
    reason: `Part of the ${ctx.merchant.parentCompany} product family`,
  };
};
