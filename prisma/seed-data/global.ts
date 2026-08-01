import type { SeedMerchant } from "./types";

/**
 * International merchants relevant to freelancers, not tied to a specific
 * country. Categories must match the keys under "categories" in
 * messages/en.json (and messages/fr.json).
 *
 * Only merchants that are NOT already covered (same keyword + category) by
 * the static packs in src/lib/categorization/packs/ + keywords.ts are listed
 * here — see the plan's additive-layer constraint.
 */
export const GLOBAL_MERCHANTS: SeedMerchant[] = [
  // ── Income: freelance/payment platforms ──────────────────────────────────
  {
    name: "Wise", keyword: "wise", aliases: ["transferwise"], category: "bank transfer", transactionType: "income", confidence: "high", notes: "International client payouts",
    parentCompany: "Wise plc", industry: "Financial Technology", businessPurpose: "International Client Payments",
    country: "GB", website: "wise.com", recurring: false,
  },
  { name: "Payoneer", keyword: "payoneer", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Deel", keyword: "deel", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Remote", keyword: "remote.com", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Gumroad", keyword: "gumroad", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Lemon Squeezy", keyword: "lemonsqueezy", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Paddle", keyword: "paddle.com", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Patreon", keyword: "patreon", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Ko-fi", keyword: "ko-fi", aliases: ["kofi"], category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Buy Me a Coffee", keyword: "buymeacoffee", category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Shopify Payout", keyword: "shopify payout", aliases: ["shopify payments"], category: "freelance platform", transactionType: "income", confidence: "high" },
  { name: "Etsy Payout", keyword: "etsy payments", category: "freelance platform", transactionType: "income", confidence: "high" },
  {
    name: "Square", keyword: "square inc", aliases: ["sq *"], category: "card payment", transactionType: "income", confidence: "high",
    parentCompany: "Block, Inc.", industry: "Financial Technology", businessPurpose: "Card Payments",
    country: "US", website: "squareup.com", recurring: false,
  },
  { name: "Braintree", keyword: "braintree", category: "card payment", transactionType: "income", confidence: "high" },

  // ── Expense: SaaS / productivity tools ───────────────────────────────────
  // Adobe already exists as a static-pack keyword (src/lib/categorization/packs/global.ts)
  // — category/confidence here match it exactly, so matching behavior is
  // unchanged; this only adds the rich knowledge fields (and correctly
  // upgrades its provenance from "static-pack" to "seed-curated", since it's
  // no longer just a bare keyword the founder listed).
  {
    name: "Adobe", keyword: "adobe", category: "software", transactionType: "expense", confidence: "high",
    parentCompany: "Adobe Inc.", industry: "Software", businessPurpose: "Creative Design",
    country: "US", website: "adobe.com", recurring: true,
  },
  { name: "Asana", keyword: "asana", category: "software", transactionType: "expense", confidence: "high" },
  { name: "Trello", keyword: "trello", category: "software", transactionType: "expense", confidence: "high" },
  { name: "Wave Accounting", keyword: "waveapps", category: "software", transactionType: "expense", confidence: "high" },
  { name: "Bonsai", keyword: "hellobonsai", category: "software", transactionType: "expense", confidence: "high" },
  { name: "Harvest", keyword: "getharvest", category: "software", transactionType: "expense", confidence: "high" },
  { name: "Toggl", keyword: "toggl", category: "software", transactionType: "expense", confidence: "high" },
  { name: "WordPress", keyword: "wordpress", category: "software", transactionType: "expense", confidence: "high" },

  // ── Expense: marketing tools ──────────────────────────────────────────────
  { name: "Hootsuite", keyword: "hootsuite", category: "marketing", transactionType: "expense", confidence: "high" },
  { name: "Buffer", keyword: "buffer.com", category: "marketing", transactionType: "expense", confidence: "high" },
  { name: "Semrush", keyword: "semrush", category: "marketing", transactionType: "expense", confidence: "high" },
  { name: "Ahrefs", keyword: "ahrefs", category: "marketing", transactionType: "expense", confidence: "high" },

  // ── Expense: shipping & logistics ────────────────────────────────────────
  { name: "DHL", keyword: "dhl", category: "business services", transactionType: "expense", confidence: "high" },
  { name: "UPS", keyword: "ups.com", aliases: ["united parcel service"], category: "business services", transactionType: "expense", confidence: "high" },
  { name: "FedEx", keyword: "fedex", category: "business services", transactionType: "expense", confidence: "high" },
  { name: "DPD", keyword: "dpd", category: "business services", transactionType: "expense", confidence: "high" },

  // ── Expense: generic banking-fee phrase not already covered by KEYWORD_PATTERNS ──
  { name: "Card replacement fee", keyword: "card replacement fee", category: "banking fees", transactionType: "expense", confidence: "medium" },
];
