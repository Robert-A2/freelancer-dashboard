export interface SeedMerchant {
  /** Display name shown in Prisma Studio / admin tooling. */
  name: string;
  /** Lowercase substring matched against the transaction description. */
  keyword: string;
  /** Additional lowercase substrings that resolve to the same merchant. */
  aliases?: string[];
  /** Must be one of the existing categories in messages/*.json "categories". */
  category: string;
  transactionType: "income" | "expense" | "savings" | "transfer";
  confidence: "high" | "medium" | "low";
  /** ISO 3166-1 alpha-2, omitted/null = international. */
  country?: string | null;
  notes?: string;

  // ── Merchant knowledge (not just a keyword) ──────────────────────────────
  // These map to Merchant's rich-identity columns, which have existed since
  // the schema was designed but sat unpopulated until curated here entry by
  // entry — deliberately NOT free-text guesses, only filled in when actually
  // known for a real, named company.
  /** The legal entity that owns this brand, e.g. "Adobe Inc." */
  parentCompany?: string;
  /** e.g. "Software", "Financial Technology", "Freelance Marketplace". */
  industry?: string;
  /** Short, human-readable answer to "why does a freelancer pay/get paid by this" — maps to Merchant.businessFunction. */
  businessPurpose?: string;
  /** Canonical domain, e.g. "stripe.com" — no protocol/path. */
  website?: string;
  /** Does this typically recur on a schedule? Maps to Merchant.recurringIndicator ("always"/"never") — omit if genuinely unknown. */
  recurring?: boolean;
}
