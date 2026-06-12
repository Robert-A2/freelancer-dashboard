import type { SeedMerchant } from "./types";

/**
 * Other European merchants relevant to freelancers travelling or trading
 * across the EU. Only entries NOT already covered (same keyword + category)
 * by the static packs in src/lib/categorization/packs/ are listed here — see
 * the plan's additive-layer constraint.
 */
export const EUROPE_MERCHANTS: SeedMerchant[] = [
  // ── Transport / rail ──────────────────────────────────────────────────────
  { name: "Deutsche Bahn", keyword: "deutsche bahn", aliases: ["db bahn", "bahn.de"], category: "transport", transactionType: "expense", confidence: "high", country: "DE" },
  { name: "Trenitalia", keyword: "trenitalia", category: "transport", transactionType: "expense", confidence: "high", country: "IT" },
  { name: "Renfe", keyword: "renfe", category: "transport", transactionType: "expense", confidence: "high", country: "ES" },
  { name: "Telepass", keyword: "telepass", category: "transport", transactionType: "expense", confidence: "high", country: "IT" },

  // ── Food delivery ─────────────────────────────────────────────────────────
  { name: "Glovo", keyword: "glovo", category: "food", transactionType: "expense", confidence: "high", country: "ES" },
  { name: "Wolt", keyword: "wolt", category: "food", transactionType: "expense", confidence: "high", country: "FI" },

  // ── Telecom ───────────────────────────────────────────────────────────────
  { name: "Deutsche Telekom", keyword: "telekom", category: "utilities", transactionType: "expense", confidence: "medium", country: "DE" },

  // ── Groceries ─────────────────────────────────────────────────────────────
  { name: "REWE", keyword: "rewe", category: "food", transactionType: "expense", confidence: "high", country: "DE" },
  { name: "Edeka", keyword: "edeka", category: "food", transactionType: "expense", confidence: "high", country: "DE" },
  { name: "Mercadona", keyword: "mercadona", category: "food", transactionType: "expense", confidence: "high", country: "ES" },
  { name: "Esselunga", keyword: "esselunga", category: "food", transactionType: "expense", confidence: "high", country: "IT" },
];
