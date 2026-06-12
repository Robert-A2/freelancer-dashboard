import type { SeedMerchant } from "./types";

/**
 * France-specific merchants. Only entries NOT already covered (same keyword +
 * category) by the static packs in src/lib/categorization/packs/ are listed
 * here — see the plan's additive-layer constraint.
 */
export const FRANCE_MERCHANTS: SeedMerchant[] = [
  // ── Income: state benefits & reimbursements ──────────────────────────────
  { name: "CAF", keyword: "allocations familiales", aliases: ["caisse d'allocations familiales", "cnaf", "prestations familiales"], category: "refund", transactionType: "income", confidence: "high", country: "FR", notes: "Family/housing allowance payments. Keyword avoids the 3-letter 'caf' colliding with 'café'/'cafe' after diacritic stripping" },
  { name: "Ameli / CPAM", keyword: "ameli", aliases: ["cpam"], category: "refund", transactionType: "income", confidence: "high", country: "FR", notes: "Health insurance reimbursements" },
  { name: "France Travail", keyword: "france travail", aliases: ["pole emploi", "pôle emploi"], category: "salary", transactionType: "income", confidence: "high", country: "FR", notes: "Unemployment benefit payments" },

  // ── Groceries / food ──────────────────────────────────────────────────────
  { name: "Auchan", keyword: "auchan", category: "food", transactionType: "expense", confidence: "high", country: "FR" },
  { name: "Casino", keyword: "casino", category: "food", transactionType: "expense", confidence: "medium", country: "FR", notes: "Lower confidence to avoid overriding gambling-venue matches elsewhere" },
  { name: "Picard", keyword: "picard", category: "food", transactionType: "expense", confidence: "high", country: "FR" },

  // ── Telecom / energy / utilities ─────────────────────────────────────────
  { name: "Orange", keyword: "orange", category: "utilities", transactionType: "expense", confidence: "medium", country: "FR", notes: "Generic word — kept medium-confidence to avoid overriding more specific matches" },
  { name: "SFR", keyword: "sfr", category: "utilities", transactionType: "expense", confidence: "high", country: "FR" },
  { name: "EDF", keyword: "edf", category: "utilities", transactionType: "expense", confidence: "medium", country: "FR" },
  { name: "Engie", keyword: "engie", category: "utilities", transactionType: "expense", confidence: "high", country: "FR" },
  { name: "Veolia", keyword: "veolia", category: "utilities", transactionType: "expense", confidence: "high", country: "FR" },

  // ── Generic banking-fee phrases (French) ─────────────────────────────────
  { name: "Cotisation carte", keyword: "cotisation carte", category: "banking fees", transactionType: "expense", confidence: "medium", country: "FR" },
];
