import type { Confidence, CategorizationResult } from "./categorization";
import { stripDiacritics, normalizeMerchantKey } from "./categorization";

// ── Financial intent taxonomy ─────────────────────────────────────────────────
// A transaction's *intent* answers "WHY did money move?" while transactionType
// answers "HOW is it counted in analytics?". Both coexist — a WorldRemit send
// is transactionType:"transfer" (neutral for cashflow) and intent:"family_support"
// (meaningful for spending stories and insights).
export type FinancialIntent =
  | "internal_transfer"  // Own-account movement (Monzo → Revolut, pot to pot)
  | "savings_transfer"   // Moving money to a dedicated savings account
  | "savings_withdrawal" // Returning money from savings back to main spending account
  | "investment"         // Stocks, ETFs, crypto (Trading212, DeGiro, Coinbase…)
  | "family_support"     // Remittance to family (WorldRemit, TaptapSend…)
  | "owner_draw"         // Business → personal withdrawal
  | "loan_repayment"     // Mortgage, personal loan, student debt
  | "freelance_income"   // Client / platform payments (Stripe, Upwork…)
  | "salary"             // Regular employment payroll
  | "passive_income"     // Dividends, interest, rental income
  | "refund"             // Money returned by a vendor or service
  | "business_expense"   // Work-related cost (software, equipment, marketing…)
  | "personal_expense"   // Personal spending (food, health, transport…)
  | "tax_payment"        // Payment to a tax authority (HMRC, URSSAF, IRS…)
  | "subscription";      // Recurring software / service subscription

export const INTENT_LABELS: Record<FinancialIntent, string> = {
  internal_transfer:  "Internal Transfer",
  savings_transfer:   "Savings Transfer",
  savings_withdrawal: "Savings Withdrawal",
  investment:         "Investment",
  family_support:     "Family Support",
  owner_draw:         "Owner Draw",
  loan_repayment:     "Loan Repayment",
  freelance_income:   "Freelance Income",
  salary:             "Salary",
  passive_income:     "Passive Income",
  refund:             "Refund",
  business_expense:   "Business Expense",
  personal_expense:   "Personal Expense",
  tax_payment:        "Tax Payment",
  subscription:       "Subscription",
};

export const FINANCIAL_INTENTS = Object.keys(INTENT_LABELS) as FinancialIntent[];

export function isFinancialIntent(v: string): v is FinancialIntent {
  return v in INTENT_LABELS;
}

export interface IntentResult {
  intent:           FinancialIntent | null;
  intentConfidence: Confidence | null;
  intentSource:     "user" | "global" | "inferred" | null;
  needsReview:      boolean;
}

/** Per-user intent rules built from UserIntentRule DB rows. */
export type UserIntentRules = Map<string, FinancialIntent>;

// ── Global static intent rules ────────────────────────────────────────────────
// Keyword → intent mappings for well-known merchants and phrases. Longest
// match wins — prevents "isa" from clobbering "to my isa". Applied BEFORE
// inferring from categorization so well-known remittance/investment services
// are never left as "unclear".
interface GlobalIntentEntry {
  keyword:    string;
  intent:     FinancialIntent;
  confidence: Confidence;
}

const GLOBAL_INTENT_RAW: GlobalIntentEntry[] = [
  // ── Family support / remittance ─────────────────────────────────────────
  { keyword: "taptap send",     intent: "family_support", confidence: "high" },
  { keyword: "taptapsend",      intent: "family_support", confidence: "high" },
  { keyword: "worldremit",      intent: "family_support", confidence: "high" },
  { keyword: "remitly",         intent: "family_support", confidence: "high" },
  { keyword: "western union",   intent: "family_support", confidence: "high" },
  { keyword: "moneygram",       intent: "family_support", confidence: "high" },
  { keyword: "xoom",            intent: "family_support", confidence: "high" },
  { keyword: "azimo",           intent: "family_support", confidence: "high" },
  { keyword: "sendwave",        intent: "family_support", confidence: "high" },
  { keyword: "ria money",       intent: "family_support", confidence: "high" },
  { keyword: "small world",     intent: "family_support", confidence: "high" },
  { keyword: "lemfi",           intent: "family_support", confidence: "high" },
  { keyword: "chipper cash",    intent: "family_support", confidence: "high" },
  { keyword: "paysend",         intent: "family_support", confidence: "high" },

  // ── Investment platforms ─────────────────────────────────────────────────
  { keyword: "trading 212",        intent: "investment", confidence: "high" },
  { keyword: "degiro",             intent: "investment", confidence: "high" },
  { keyword: "etoro",              intent: "investment", confidence: "high" },
  { keyword: "vanguard",           intent: "investment", confidence: "high" },
  { keyword: "fidelity investments", intent: "investment", confidence: "high" },
  { keyword: "charles schwab",     intent: "investment", confidence: "high" },
  { keyword: "schwab",             intent: "investment", confidence: "high" },
  { keyword: "robinhood",          intent: "investment", confidence: "high" },
  { keyword: "freetrade",          intent: "investment", confidence: "high" },
  { keyword: "lightyear",          intent: "investment", confidence: "high" },
  { keyword: "wealthsimple",       intent: "investment", confidence: "high" },
  { keyword: "betterment",         intent: "investment", confidence: "high" },
  { keyword: "acorns",             intent: "investment", confidence: "high" },
  { keyword: "trade republic",     intent: "investment", confidence: "high" },
  { keyword: "coinbase",           intent: "investment", confidence: "high" },
  { keyword: "binance",            intent: "investment", confidence: "high" },
  { keyword: "kraken",             intent: "investment", confidence: "high" },
  { keyword: "yomoni",             intent: "investment", confidence: "high" },
  { keyword: "nalo",               intent: "investment", confidence: "high" },
  { keyword: "boursorama invest",  intent: "investment", confidence: "high" },
  { keyword: "fortuneo invest",    intent: "investment", confidence: "high" },
  { keyword: "stock purchase",     intent: "investment", confidence: "high" },
  { keyword: "etf purchase",       intent: "investment", confidence: "high" },
  { keyword: "index fund",         intent: "investment", confidence: "high" },

  // ── Savings transfer ─────────────────────────────────────────────────────
  { keyword: "hello bank",         intent: "savings_transfer", confidence: "high" },
  { keyword: "into savings",       intent: "savings_transfer", confidence: "high" },
  { keyword: "to my isa",          intent: "savings_transfer", confidence: "high" },
  { keyword: "transfer to isa",    intent: "savings_transfer", confidence: "high" },
  { keyword: "to isa account",     intent: "savings_transfer", confidence: "high" },
  { keyword: "to isa",             intent: "savings_transfer", confidence: "high" },
  { keyword: "isa transfer",       intent: "savings_transfer", confidence: "high" },
  { keyword: "transfer to pension", intent: "savings_transfer", confidence: "high" },
  { keyword: "to pension",         intent: "savings_transfer", confidence: "high" },
  { keyword: "pension transfer",   intent: "savings_transfer", confidence: "high" },
  { keyword: "transfer to sipp",   intent: "savings_transfer", confidence: "high" },
  { keyword: "to sipp account",    intent: "savings_transfer", confidence: "high" },
  { keyword: "sipp",               intent: "savings_transfer", confidence: "high" },
  { keyword: "livret a",           intent: "savings_transfer", confidence: "high" },
  { keyword: "ldds",               intent: "savings_transfer", confidence: "high" },
  { keyword: "livret jeune",       intent: "savings_transfer", confidence: "high" },
  { keyword: "plan epargne",       intent: "savings_transfer", confidence: "high" },
  { keyword: "assurance vie",      intent: "savings_transfer", confidence: "high" },
  { keyword: "vers epargne",       intent: "savings_transfer", confidence: "high" },
  { keyword: "virement epargne",   intent: "savings_transfer", confidence: "high" },
  { keyword: "emergency fund",     intent: "savings_transfer", confidence: "high" },
  { keyword: "savings pot",        intent: "savings_transfer", confidence: "high" },
  { keyword: "future savings",     intent: "savings_transfer", confidence: "high" },
  { keyword: "to savings",         intent: "savings_transfer", confidence: "medium" },

  // ── Loan / mortgage repayments ───────────────────────────────────────────
  { keyword: "mortgage",           intent: "loan_repayment", confidence: "high" },
  { keyword: "loan repayment",     intent: "loan_repayment", confidence: "high" },
  { keyword: "loan payment",       intent: "loan_repayment", confidence: "high" },
  { keyword: "credit repayment",   intent: "loan_repayment", confidence: "high" },
  { keyword: "remboursement credit", intent: "loan_repayment", confidence: "high" },
  { keyword: "remboursement pret", intent: "loan_repayment", confidence: "high" },
  { keyword: "pret immobilier",    intent: "loan_repayment", confidence: "high" },
  { keyword: "student loan",       intent: "loan_repayment", confidence: "high" },
  { keyword: "car loan",           intent: "loan_repayment", confidence: "high" },
  { keyword: "personal loan",      intent: "loan_repayment", confidence: "high" },

  // ── Tax payments ─────────────────────────────────────────────────────────
  { keyword: "hmrc",               intent: "tax_payment", confidence: "high" },
  { keyword: "urssaf",             intent: "tax_payment", confidence: "high" },
  { keyword: "dgfip",              intent: "tax_payment", confidence: "high" },
  { keyword: "revenue commissioners", intent: "tax_payment", confidence: "high" },
  { keyword: "tresor public",      intent: "tax_payment", confidence: "high" },
  { keyword: "impots.gouv",        intent: "tax_payment", confidence: "high" },
  { keyword: "hacienda",           intent: "tax_payment", confidence: "high" },
  { keyword: "finanzamt",          intent: "tax_payment", confidence: "high" },
  { keyword: "income tax",         intent: "tax_payment", confidence: "high" },
  { keyword: "corporation tax",    intent: "tax_payment", confidence: "high" },
  { keyword: "vat payment",        intent: "tax_payment", confidence: "high" },

  // ── Passive income ───────────────────────────────────────────────────────
  { keyword: "dividend",           intent: "passive_income", confidence: "high" },
  { keyword: "interest payment",   intent: "passive_income", confidence: "high" },
  { keyword: "interest earned",    intent: "passive_income", confidence: "high" },
  { keyword: "rental income",      intent: "passive_income", confidence: "high" },
  { keyword: "royalt",             intent: "passive_income", confidence: "high" },

  // ── Salary / payroll ─────────────────────────────────────────────────────
  { keyword: "virement de salaire", intent: "salary", confidence: "high" },
  { keyword: "payroll",            intent: "salary", confidence: "high" },
  { keyword: "salaire",            intent: "salary", confidence: "high" },
  { keyword: "salary",             intent: "salary", confidence: "high" },
];

// Normalize at module load — same diacritic stripping the categorization engine uses.
const GLOBAL_INTENT_ENTRIES: GlobalIntentEntry[] = GLOBAL_INTENT_RAW.map((e) => ({
  ...e,
  keyword: stripDiacritics(e.keyword),
}));

// ── Category → intent inference ───────────────────────────────────────────────
// When neither user rules nor global keywords match, the categorization result
// gives enough signal for common cases (income sub-categories, tax expenses, etc.).

const BUSINESS_EXPENSE_CATEGORIES = new Set([
  "software", "ai tools", "marketing", "advertising", "education",
  "equipment", "office", "banking fees",
]);
const PERSONAL_EXPENSE_CATEGORIES = new Set([
  "food", "health", "transport", "travel", "housing", "utilities",
]);
const FREELANCE_INCOME_CATEGORIES = new Set([
  "stripe", "paypal", "freelance platform", "card payment",
  "invoice payment", "client payment", "bank transfer", "income",
]);

function inferFromCategorization(
  catResult: CategorizationResult,
): { intent: FinancialIntent; confidence: Confidence } | null {
  const { transactionType, category } = catResult;

  if (transactionType === "income") {
    if (category === "salary")  return { intent: "salary",          confidence: "high" };
    if (category === "refund")  return { intent: "refund",          confidence: "high" };
    if (FREELANCE_INCOME_CATEGORIES.has(category))
                                return { intent: "freelance_income", confidence: "high" };
    return                             { intent: "freelance_income", confidence: "medium" };
  }

  if (transactionType === "expense") {
    if (category === "taxes")        return { intent: "tax_payment",      confidence: "high" };
    if (category === "subscriptions") return { intent: "subscription",     confidence: "high" };
    if (BUSINESS_EXPENSE_CATEGORIES.has(category))
                                     return { intent: "business_expense",  confidence: "high" };
    if (PERSONAL_EXPENSE_CATEGORIES.has(category))
                                     return { intent: "personal_expense",  confidence: "high" };
    if (category !== "uncategorized") return { intent: "personal_expense", confidence: "medium" };
    return null;
  }

  if (transactionType === "savings") {
    // The categorization engine's savings keywords already cover the most specific
    // cases; here we just give the remaining savings transactions a medium-confidence
    // savings_transfer intent rather than leaving them needs-review.
    return { intent: "savings_transfer", confidence: "medium" };
  }

  // transfer with no match → cannot safely infer, will be flagged needsReview
  return null;
}

// Longest match wins — prevents "isa" from clobbering "to my isa".
function findBestGlobalMatch(lower: string): GlobalIntentEntry | null {
  let best: GlobalIntentEntry | null = null;
  for (const entry of GLOBAL_INTENT_ENTRIES) {
    if (lower.includes(entry.keyword) && (!best || entry.keyword.length > best.keyword.length)) {
      best = entry;
    }
  }
  return best;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classifies the financial intent of a transaction in four priority layers:
 *
 * 1. User-confirmed rule — ground truth, never overridden.
 * 2. Global keyword match — well-known merchants (WorldRemit → family_support).
 * 3. Inferred from categorization — income sub-types, business vs personal.
 * 4. Unknown — flags transfers for user review; income/expense without a match
 *    are still readable from their category so are NOT flagged.
 */
export function classifyIntent(
  description: string,
  catResult: CategorizationResult,
  userRules: UserIntentRules = new Map(),
): IntentResult {
  const lower = stripDiacritics(description.toLowerCase());

  // Layer 1 — user rule (ground truth)
  const merchantKey = normalizeMerchantKey(description);
  const userIntent = userRules.get(merchantKey);
  if (userIntent) {
    return { intent: userIntent, intentConfidence: "high", intentSource: "user", needsReview: false };
  }

  // Layer 2 — global keyword
  const globalMatch = findBestGlobalMatch(lower);
  if (globalMatch) {
    return {
      intent:           globalMatch.intent,
      intentConfidence: globalMatch.confidence,
      intentSource:     "global",
      needsReview:      false,
    };
  }

  // Layer 3 — infer from categorization
  const inferred = inferFromCategorization(catResult);
  if (inferred) {
    return {
      intent:           inferred.intent,
      intentConfidence: inferred.confidence,
      intentSource:     "inferred",
      needsReview:      false,
    };
  }

  // Layer 4 — no match: only flag transfers for review
  const needsReview = catResult.transactionType === "transfer";
  return { intent: null, intentConfidence: null, intentSource: null, needsReview };
}

/**
 * Builds the per-user intent rules map from DB rows.
 * Pass the result into `classifyIntent` as `userRules`.
 */
export function buildUserIntentRules(
  rows: Array<{ merchantKey: string; intent: string }>,
): UserIntentRules {
  const map = new Map<string, FinancialIntent>();
  for (const row of rows) {
    map.set(row.merchantKey, row.intent as FinancialIntent);
  }
  return map;
}
