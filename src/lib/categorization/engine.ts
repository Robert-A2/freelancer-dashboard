import type { CategorizationResult, Confidence, LearnedRules, MerchantEntry } from "./types";
import { ACTIVE_PACKS } from "./packs";
import { KEYWORD_PATTERNS } from "./keywords";

// ── Merchant-key normalization ──────────────────────────────────────────────────
// Used both when persisting a learned rule (on correction) and when looking one up
// (during categorization), so the two stay in lockstep. Strips noise that varies
// transaction-to-transaction (reference numbers, card-terminal IDs, punctuation)
// while keeping the merchant name intact — e.g. "PAYPAL *UBER 88213764" -> "paypal uber".
export function normalizeMerchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[*#]/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Savings-specific transfer phrases ──────────────────────────────────────────
// Checked BEFORE general transfer detection so that "transfer to savings" is
// correctly classified as savings, not a neutral internal transfer.
const SAVINGS_TRANSFER_OVERRIDES = [
  "transfer to savings",
  "to savings account",
  "savings account transfer",
  "to my isa",
  "transfer to isa",
  "to isa account",
  "to pension",
  "transfer to pension",
  "pension transfer",
  "transfer to sipp",
  "to sipp account",
  "savings pot transfer",
  "to savings pot",
  "into savings",
  "to investment account",
  "transfer to investment",
  "to emergency fund",
  // Revolut/N26-style auto-save "pockets" — e.g. "To pocket EUR Future savings from EUR"
  "to pocket",
  "future savings",
  "stock security fund",
  // French savings/investment vehicles
  "vers epargne",
  "virement epargne",
  "vers mon epargne",
  "plan epargne",
  "assurance vie",
  // Neo-banks commonly used as savings accounts
  "hello bank",
  "n26",
  "bunq",
  "trade republic",
  "lightyear",
];

// ── General transfer detection ─────────────────────────────────────────────────
// Internal account movements — excluded from income AND expenses so they never
// inflate cashflow figures.
//
// "internal transfer" / "own transfer" / "my account" / "between accounts"
// structurally reference the user's OWN accounts and never name a third party,
// so they're unambiguous regardless of amount sign.
const TRANSFER_KEYWORDS = [
  "internal transfer", "own transfer",
  "between accounts", "my account", "to my account", "from my account",
  "pocket transfer", "monzo pot", "revolut vault", "revolut savings",
  "bunq pocket", "bunq savings", "starling space", "round up",
  "spare change", "auto-save", "autosave",
  "virement interne", "virement propre", "virement de compte a compte",
  "eigene überweisung", "umbuchung",
  "traspaso propio", "transferencia propia",
  // International remittance / money-transfer services — typically personal
  // money movement (e.g. sending money to family abroad), not business expense
  "taptap send", "worldremit", "remitly", "xoom", "azimo", "moneygram",
  "western union",
];

// "Transfer to X" / "Transfer from X" are AMBIGUOUS for incoming money: many
// banks describe an incoming Faster Payment / SEPA credit FROM A CLIENT as
// "TRANSFER FROM ACME CONSULTING LTD". A positive amount matching one of these
// is only treated as an internal transfer when the description also names the
// account owner (a genuine self-transfer, see isSelfTransfer below) — otherwise
// it falls through to income detection (Priority 5) so real client payments are
// never silently dropped.
const AMBIGUOUS_TRANSFER_KEYWORDS = ["transfer to", "transfer from"];

// ── Savings detection ──────────────────────────────────────────────────────────
// Money being intentionally set aside. Treated separately from expenses so the
// freelancer's savings rate is calculated accurately.
const SAVINGS_KEYWORDS = [
  "savings transfer", "savings account", "to savings",
  "investment transfer", "emergency fund",
  " isa", "isa ", "sipp ", " sipp",
  "pension fund", "pension contribution", "pension payment",
  "vanguard", "fidelity investments", "fidelity fund",
  "trading 212", "wealthsimple", "degiro", "etoro ",
  "coinbase savings", "stock purchase", "etf purchase", "index fund",
  "schwab", "robinhood transfer", "betterment", "acorns",
  // French savings/investment products
  "livret a", "ldds", "livret jeune", "pea ", " pea",
  "boursorama epargne", "fortuneo epargne", "yomoni", "nalo ",
];

// ── Tax payments ───────────────────────────────────────────────────────────────
const TAX_KEYWORDS = [
  "hmrc", "irs ", " irs", "revenue commissioners", "impôts", "impots.gouv",
  "vat payment", "income tax", "tax payment", "corporation tax",
  "social security", "prsi ", " prsi", "national insurance",
  "usc payment", "estimated tax", "preliminary tax", "tax return",
  "agenzia delle entrate",  // Italian
  "hacienda",               // Spanish
  "finanzamt",              // German
  // French freelancer tax & social-contribution bodies — extremely common in
  // this user base (URSSAF collects the mandatory freelancer social charges)
  "urssaf", "dgfip", "service-public.fr", "impots.gouv.fr",
  "cfe ", " cfe", "cotisation fonciere", "cotisation sociale",
  "carsat", "ircantec", "caisse de retraite", "tresor public",
  "prelevement a la source", "acoss", "ville de paris", "mairie de",
];

// ── Income patterns (ordered by specificity) ───────────────────────────────────
// Any positive amount that doesn't match savings/transfer keywords is treated as
// income, so client payments with generic descriptions are always captured.
// Each pattern is tagged with a confidence: "high" for unambiguous platform/brand
// names, "medium" for generic descriptive phrases. Kept separate from the expense
// merchant entries below — e.g. Stripe/PayPal are income sources here but expense
// "banking fees" merchants on the negative-amount side.
const INCOME_PATTERNS: Array<{ keywords: string[]; subcategory: string; confidence: Confidence }> = [
  { keywords: ["stripe"], subcategory: "stripe", confidence: "high" },
  { keywords: ["paypal"], subcategory: "paypal", confidence: "high" },
  {
    keywords: [
      "upwork", "freelancer.com", "fiverr", "toptal", "99designs",
      "guru.com", "peopleperhour", "malt ", "codementor", "contra.com",
      "comet ", "brigad", "crew "
    ],
    subcategory: "freelance platform",
    confidence: "high",
  },
  {
    // Mobile card-payment terminals — very common for French freelancers
    // collecting card payments directly from clients
    keywords: ["smile & pay", "smile&pay", "sumup", "izettle", "zettle", "lydia pro", "yavin "],
    subcategory: "card payment",
    confidence: "high",
  },
  {
    keywords: ["invoice payment", "inv-", " inv ", "#inv", "invoice #", "invoice ref", "invoice no", "facture "],
    subcategory: "invoice payment",
    confidence: "medium",
  },
  {
    keywords: [
      "client payment", "project payment", "consulting fee",
      "consulting payment", "retainer", "freelance payment",
      "contractor payment", "service payment", "honoraires",
      "prestation de service", "remuneration",
    ],
    subcategory: "client payment",
    confidence: "medium",
  },
  { keywords: ["salary", "payroll", "wages ", " wage ", "salaire", "virement de salaire"], subcategory: "salary", confidence: "medium" },
  {
    keywords: [
      "wire transfer", "bank transfer", "sepa credit", "bacs credit",
      "ach deposit", "direct deposit", "faster payment", "chaps credit",
      "fps credit", "tfs credit", "virement recu", "virement sepa",
    ],
    subcategory: "bank transfer",
    confidence: "medium",
  },
  { keywords: ["refund", "reimbursement", "cashback", "rebate", "remboursement"], subcategory: "refund", confidence: "medium" },
];

// ── Personal-transfer heuristics (Layer 5 fallback) ────────────────────────────
// "To Robert Arthur" / "From Camille Pervenche" — money moving to/from a named
// individual rather than a business. The prefix ("to"/"from") is matched
// case-insensitively, but the name itself must be Title Case — this is what
// keeps it from matching ALL-CAPS business names like "To PICKUP SERVICES".
const TRANSFER_PREFIX_PATTERN = /^(to|from)\s+(.+)$/i;
const TITLE_CASE_NAME_PATTERN = /^[A-ZÀ-Þ][a-zà-öø-ÿ'’.-]+(?:\s+[A-ZÀ-Þ][a-zà-öø-ÿ'’.-]+){1,4}$/u;

function isPersonalTransferPattern(description: string): boolean {
  const match = TRANSFER_PREFIX_PATTERN.exec(description.trim());
  if (!match) return false;
  return TITLE_CASE_NAME_PATTERN.test(match[2]);
}

function isSelfTransfer(lower: string, ownerName?: string): boolean {
  if (!ownerName) return false;
  const parts = ownerName.toLowerCase().split(/\s+/).filter((p) => p.length > 1);
  if (parts.length < 2) return false;
  return parts.every((p) => lower.includes(p));
}

// ── Unified expense-merchant lookup ─────────────────────────────────────────────
// Every active country/global pack's entries, plus the generic Layer-3 keyword
// patterns, merged into one flat table and split by confidence. This is the
// expense-side counterpart to INCOME_PATTERNS (kept deliberately separate —
// e.g. "stripe"/"paypal" are income sources there but expense "banking fees"
// merchants here, and unifying the two would corrupt income detection).
const ALL_EXPENSE_ENTRIES: MerchantEntry[] = [
  ...ACTIVE_PACKS.flatMap((pack) => pack.entries),
  ...KEYWORD_PATTERNS,
];
const HIGH_CONFIDENCE_ENTRIES = ALL_EXPENSE_ENTRIES.filter((e) => e.confidence === "high");
const MEDIUM_CONFIDENCE_ENTRIES = ALL_EXPENSE_ENTRIES.filter((e) => e.confidence === "medium");

// A plain "first entry in the list wins" approach causes collisions like
// "Uber Eats" matching a "uber" transport entry before a more specific "uber eats"
// food entry. Picking the longest matching keyword across ALL entries resolves
// this generally, regardless of which pack or section it came from.
function findBestMatch(lower: string, entries: MerchantEntry[]): MerchantEntry | null {
  let best: MerchantEntry | null = null;
  for (const entry of entries) {
    if (lower.includes(entry.keyword) && (!best || entry.keyword.length > best.keyword.length)) {
      best = entry;
    }
  }
  return best;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function categorizeTransaction(
  description: string,
  amount: number,
  learnedRules?: LearnedRules,
  ownerName?: string
): CategorizationResult {
  const lower = description.toLowerCase();

  // LAYER 1 — Learned exact match. User corrections are ground truth, so this
  // runs before every hardcoded rule and can override built-in keywords.
  if (learnedRules) {
    const learned = learnedRules.get(normalizeMerchantKey(description));
    if (learned) {
      const transactionType: CategorizationResult["transactionType"] =
        learned === "savings" ? "savings" : learned === "transfer" ? "transfer"
        : amount > 0 ? "income" : "expense";
      return { transactionType, category: learned, confidence: "high", source: "learned" };
    }
  }

  // PRIORITY 1 — Savings-specific transfers
  // These phrases contain "transfer" but describe money going to savings/investments.
  // Must be checked BEFORE the general transfer detection.
  if (SAVINGS_TRANSFER_OVERRIDES.some((kw) => lower.includes(kw))) {
    return { transactionType: "savings", category: "savings", confidence: "high", source: "merchant" };
  }

  // PRIORITY 2 — General internal transfers (neutral, excluded from cashflow)
  if (TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { transactionType: "transfer", category: "transfer", confidence: "high", source: "merchant" };
  }
  // "Transfer to/from X" — only a transfer if X is the account owner themself
  // (or the amount is leaving the account, e.g. moving funds to another of the
  // user's own accounts). A positive amount with no owner-name match is treated
  // as a third-party payment and falls through to income detection below.
  if (AMBIGUOUS_TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))) {
    if (amount <= 0 || isSelfTransfer(lower, ownerName)) {
      return { transactionType: "transfer", category: "transfer", confidence: "high", source: "merchant" };
    }
  }

  // PRIORITY 3 — Savings (investment platforms, ISA, pension, etc.)
  if (SAVINGS_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { transactionType: "savings", category: "savings", confidence: "high", source: "merchant" };
  }

  // PRIORITY 4 — Tax payments (categorised as expense/taxes)
  if (amount < 0 && TAX_KEYWORDS.some((kw) => lower.includes(kw))) {
    return { transactionType: "expense", category: "taxes", confidence: "high", source: "merchant" };
  }

  // PRIORITY 5 — Income
  // ANY positive amount is income. We try to sub-categorise it first, but the
  // fallback ensures no client payment is ever lost.
  if (amount > 0) {
    for (const pattern of INCOME_PATTERNS) {
      if (pattern.keywords.some((kw) => lower.includes(kw))) {
        return {
          transactionType: "income",
          category: pattern.subcategory,
          confidence: pattern.confidence,
          source: pattern.confidence === "high" ? "merchant" : "keyword",
        };
      }
    }
    return { transactionType: "income", category: "income", confidence: "medium", source: "fallback" };
  }

  // PRIORITY 6 — Expense (negative amounts)
  // Layers 1–2: exact/partial known-merchant brand match (high confidence),
  // searched across every active global + country pack at once.
  const brandMatch = findBestMatch(lower, HIGH_CONFIDENCE_ENTRIES);
  if (brandMatch) {
    return { transactionType: "expense", category: brandMatch.category, confidence: "high", source: "merchant" };
  }
  // Layer 3: generic descriptive keyword / pattern match (medium confidence) —
  // e.g. "boulangerie" -> food, "pharmacie" -> health, "tabac" -> personal spending.
  const genericMatch = findBestMatch(lower, MEDIUM_CONFIDENCE_ENTRIES);
  if (genericMatch) {
    return { transactionType: "expense", category: genericMatch.category, confidence: "medium", source: "keyword" };
  }

  // LAYER 5 — Structural fallback heuristics (low confidence, but a real guess
  // beats "uncategorized": it gives the user something concrete to confirm or fix).
  if (isSelfTransfer(lower, ownerName)) {
    return { transactionType: "transfer", category: "transfer", confidence: "medium", source: "heuristic:self-transfer" };
  }
  if (isPersonalTransferPattern(description)) {
    return { transactionType: "transfer", category: "transfer", confidence: "low", source: "heuristic:personal-transfer" };
  }

  return { transactionType: "expense", category: "uncategorized", confidence: "low", source: "fallback" };
}
