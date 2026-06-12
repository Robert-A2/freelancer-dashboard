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
}
