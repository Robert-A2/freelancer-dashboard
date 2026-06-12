import type { SeedMerchant } from "./types";

/**
 * UK-specific merchants. Only entries NOT already covered (same keyword +
 * category) by the static packs in src/lib/categorization/packs/ are listed
 * here — see the plan's additive-layer constraint.
 */
export const UK_MERCHANTS: SeedMerchant[] = [
  // ── Groceries / food ──────────────────────────────────────────────────────
  { name: "ASDA", keyword: "asda", category: "food", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Aldi", keyword: "aldi", category: "food", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Marks & Spencer", keyword: "marks & spencer", aliases: ["m&s", "marks and spencer"], category: "food", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Iceland Foods", keyword: "iceland foods", category: "food", transactionType: "expense", confidence: "high", country: "GB", notes: "Specific keyword avoids matching the country name 'Iceland'" },
  { name: "Co-op Food", keyword: "co-op food", aliases: ["coop food"], category: "food", transactionType: "expense", confidence: "high", country: "GB" },

  // ── Utilities / energy ────────────────────────────────────────────────────
  { name: "Octopus Energy", keyword: "octopus energy", category: "utilities", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Thames Water", keyword: "thames water", category: "utilities", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Severn Trent", keyword: "severn trent", category: "utilities", transactionType: "expense", confidence: "high", country: "GB" },

  // ── Telecom / broadband ───────────────────────────────────────────────────
  { name: "giffgaff", keyword: "giffgaff", category: "utilities", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "O2", keyword: "telefonica o2", aliases: ["o2 uk"], category: "utilities", transactionType: "expense", confidence: "medium", country: "GB" },

  // ── Transport ─────────────────────────────────────────────────────────────
  { name: "Transport for London", keyword: "tfl", aliases: ["transport for london"], category: "transport", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Trainline", keyword: "trainline", category: "transport", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "National Rail", keyword: "national rail", category: "transport", transactionType: "expense", confidence: "high", country: "GB" },

  // ── Taxes / government (Finding #6) ──────────────────────────────────────
  { name: "Council Tax", keyword: "council tax", category: "taxes", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "TV Licence", keyword: "tv licence", aliases: ["tv license"], category: "subscriptions", transactionType: "expense", confidence: "high", country: "GB" },

  // ── Health ────────────────────────────────────────────────────────────────
  { name: "Boots", keyword: "boots", category: "health", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Superdrug", keyword: "superdrug", category: "health", transactionType: "expense", confidence: "high", country: "GB" },

  // ── Postal / entertainment ────────────────────────────────────────────────
  { name: "Royal Mail", keyword: "royal mail", category: "business services", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Vue Cinema", keyword: "vue cinema", category: "entertainment", transactionType: "expense", confidence: "high", country: "GB" },
  { name: "Odeon", keyword: "odeon", category: "entertainment", transactionType: "expense", confidence: "high", country: "GB" },
];
