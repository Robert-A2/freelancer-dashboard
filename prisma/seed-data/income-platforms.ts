import type { SeedMerchant } from "./types";

/**
 * Income-side payment platforms, curated with full merchant knowledge (not
 * just a keyword -> category mapping) — parent company, industry, business
 * purpose, website, recurring behaviour. Wise and Square already existed as
 * bare keyword entries in global.ts; they're enriched there in place rather
 * than duplicated here. Everything below is genuinely new.
 *
 * Confidence is deliberately left as the coarse "high" tier for all of
 * these, not a hand-typed decimal (e.g. "99.9%") — Merchant.globalConfidence
 * is a COMPUTED value (see computeMerchantConfidence() in
 * src/lib/merchant-intelligence/confidence.ts), derived from tier +
 * real-world popularity + cross-user agreement. Hand-asserting a specific
 * decimal per company would fabricate precision no evidence backs yet;
 * "high" tier + this seed's real popularity is what actually earns the
 * eventual number.
 */
export const INCOME_PLATFORM_MERCHANTS: SeedMerchant[] = [
  {
    name: "Stripe", keyword: "stripe", aliases: ["stripe payments", "stripe inc"],
    category: "stripe", transactionType: "income", confidence: "high",
    parentCompany: "Stripe, Inc.", industry: "Financial Technology",
    businessPurpose: "Client Payments", country: "US", website: "stripe.com", recurring: false,
  },
  {
    name: "PayPal", keyword: "paypal", aliases: ["pp*", "paypal europe"],
    category: "paypal", transactionType: "income", confidence: "high",
    parentCompany: "PayPal Holdings, Inc.", industry: "Financial Technology",
    businessPurpose: "Client Payments", country: "US", website: "paypal.com", recurring: false,
  },
  {
    name: "GoCardless", keyword: "gocardless",
    category: "bank transfer", transactionType: "income", confidence: "high",
    parentCompany: "GoCardless Ltd", industry: "Financial Technology",
    businessPurpose: "Direct Debit Collections", country: "GB", website: "gocardless.com", recurring: true,
  },
  {
    name: "SumUp", keyword: "sumup",
    category: "card payment", transactionType: "income", confidence: "high",
    parentCompany: "SumUp Ltd", industry: "Financial Technology",
    businessPurpose: "Card Payments", country: "GB", website: "sumup.com", recurring: false,
  },
  {
    name: "Revolut Business", keyword: "revolut business", aliases: ["revolut"],
    category: "income", transactionType: "income", confidence: "high",
    parentCompany: "Revolut Ltd", industry: "Financial Technology",
    businessPurpose: "Business Banking", country: "GB", website: "revolut.com", recurring: false,
  },
  {
    name: "Malt", keyword: "malt ",
    category: "freelance platform", transactionType: "income", confidence: "high",
    parentCompany: "Malt SAS", industry: "Freelance Marketplace",
    businessPurpose: "Client Marketplace", country: "FR", website: "malt.fr", recurring: false,
  },
  {
    name: "Upwork", keyword: "upwork",
    category: "freelance platform", transactionType: "income", confidence: "high",
    parentCompany: "Upwork Inc.", industry: "Freelance Marketplace",
    businessPurpose: "Client Marketplace", country: "US", website: "upwork.com", recurring: false,
  },
  {
    name: "Fiverr", keyword: "fiverr",
    category: "freelance platform", transactionType: "income", confidence: "high",
    parentCompany: "Fiverr International Ltd", industry: "Freelance Marketplace",
    businessPurpose: "Client Marketplace", country: "IL", website: "fiverr.com", recurring: false,
  },
  {
    name: "Toptal", keyword: "toptal",
    category: "freelance platform", transactionType: "income", confidence: "high",
    parentCompany: "Toptal LLC", industry: "Freelance Marketplace",
    businessPurpose: "Premium Client Marketplace", country: "US", website: "toptal.com", recurring: false,
  },
];
