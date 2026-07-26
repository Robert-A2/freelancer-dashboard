// ── Financial Reserve Engine — shared types ─────────────────────────────────
// The pluggable contract every country's rule set implements. Adding a new
// country means writing one file that satisfies CountryReserveRules and
// registering it in countries/index.ts — nothing else in the engine changes.

export interface UserFinancialProfile {
  country: string | null;             // ISO 3166-1 alpha-2, e.g. "FR"
  businessLegalStatus: string | null; // e.g. "micro_entrepreneur"
  activityType: string | null;        // country-specific key
  vatStatus: string | null;           // "exempt" | "registered" | "unknown"
}

export type BucketKey = "socialContributions" | "incomeTax" | "vat";
export type BucketConfidence = "known" | "unavailable";

export interface ReserveBucket {
  key: BucketKey;
  pct: number | null;    // null = cannot be determined from what we know
  amount: number;        // computed reserve amount for all-time confirmed income; 0 when pct is null
  confidence: BucketConfidence;
  noteKey: string | null; // i18n key for a clarifying caveat, e.g. "depends on your bracket"
}

export interface ReserveContext {
  totalIncomeAllTime: number;
  incomeThisMonth: number;
  monthlyIncomeSamples: number[]; // most recent months first, for volatility-based buffer sizing
}

export interface CountryReserveRules {
  countryCode: string;
  isProfileComplete(profile: UserFinancialProfile): boolean;
  computeTaxBuckets(profile: UserFinancialProfile, context: ReserveContext): ReserveBucket[];
}
