import type { CategorizationResult, Confidence, LearnedRules, MerchantEntry, MerchantIndex } from "./types";
import { ACTIVE_PACKS } from "./packs";
import { KEYWORD_PATTERNS } from "./keywords";

// ── Diacritic stripping ──────────────────────────────────────────────────────────
// Bank exports are inconsistent about accents (e.g. "Virement épargne" vs the
// "virement epargne" keyword below), so descriptions AND every keyword list are
// normalized through this before matching — accented and unaccented spellings of
// the same word always match each other. Exported so merchant-db.ts can apply
// the same normalization to DB-sourced merchant keywords/aliases.
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ── Merchant-key normalization ──────────────────────────────────────────────────
// Used both when persisting a learned rule (on correction) and when looking one up
// (during categorization), so the two stay in lockstep. Strips noise that varies
// transaction-to-transaction (reference numbers, card-terminal IDs, punctuation)
// while keeping the merchant name intact — e.g. "PAYPAL *UBER 88213764" -> "paypal uber".
export function normalizeMerchantKey(description: string): string {
  return stripDiacritics(description.toLowerCase())
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
].map(stripDiacritics);

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
].map(stripDiacritics);

// "Transfer to X" / "Transfer from X" are AMBIGUOUS for incoming money: many
// banks describe an incoming Faster Payment / SEPA credit FROM A CLIENT as
// "TRANSFER FROM ACME CONSULTING LTD". A positive amount matching one of these
// is only treated as an internal transfer when the description also names the
// account owner (a genuine self-transfer, see isSelfTransfer below) — otherwise
// it falls through to income detection (Priority 5) so real client payments are
// never silently dropped.
const AMBIGUOUS_TRANSFER_KEYWORDS = ["transfer to", "transfer from"].map(stripDiacritics);

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
].map(stripDiacritics);

// ── Tax payments ───────────────────────────────────────────────────────────────
const TAX_KEYWORDS = [
  "hmrc", "hm revenue & customs", "hm revenue and customs",
  "irs ", " irs", "revenue commissioners", "impôts", "impots.gouv",
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
].map(stripDiacritics);

// ── Income patterns (ordered by specificity) ───────────────────────────────────
// Any positive amount that doesn't match savings/transfer keywords is treated as
// income, so client payments with generic descriptions are always captured.
// Each pattern is tagged with a confidence: "high" for unambiguous platform/brand
// names, "medium" for generic descriptive phrases. Kept separate from the expense
// merchant entries below — e.g. Stripe/PayPal are income sources here but expense
// "banking fees" merchants on the negative-amount side.
const INCOME_PATTERNS_RAW: Array<{ keywords: string[]; subcategory: string; confidence: Confidence }> = [
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
const INCOME_PATTERNS = INCOME_PATTERNS_RAW.map((pattern) => ({ ...pattern, keywords: pattern.keywords.map(stripDiacritics) }));

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
  const parts = stripDiacritics(ownerName.toLowerCase()).split(/\s+/).filter((p) => p.length > 1);
  if (parts.length < 2) return false;
  return parts.every((p) => lower.includes(p));
}

// "...transfer to/from <target>" — captures whatever follows the matched
// AMBIGUOUS_TRANSFER_KEYWORDS phrase, e.g. "TRANSFER FROM ACME CONSULTING LTD"
// -> "acme consulting ltd".
const TRANSFER_TO_FROM_TARGET = /transfer (?:to|from)\s+(.+)$/;

// True only when <target> genuinely IS the account owner — every word of the
// owner's name is present, and any extra words are just a trailing reference
// number/code (e.g. "Robert Arthur Ref 12345"), not extra name words. This is
// intentionally stricter than isSelfTransfer: it's what stops a client whose
// name happens to contain the owner's first+last name (e.g. owner "Paul Martin"
// vs "PAUL MARTIN CONSULTING LTD") from being misread as an internal transfer
// and having their payment silently excluded from income.
function isTransferToOwner(lower: string, ownerName?: string): boolean {
  if (!ownerName) return false;
  const match = TRANSFER_TO_FROM_TARGET.exec(lower);
  if (!match) return false;

  const ownerWords = stripDiacritics(ownerName.toLowerCase()).split(/\s+/).filter((p) => p.length > 1);
  if (ownerWords.length < 2) return false;

  const targetWords = match[1].split(/\s+/).filter(Boolean);
  if (!ownerWords.every((w) => targetWords.includes(w))) return false;

  const extraWords = targetWords.filter((w) => !ownerWords.includes(w));
  return extraWords.every((w) => /\d/.test(w) || /^(ref\.?|reference|no\.?|number)$/.test(w) || /^[-#.]+$/.test(w));
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
].map((entry) => ({ ...entry, keyword: stripDiacritics(entry.keyword) }));
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
  ownerName?: string,
  merchantIndex?: MerchantIndex
): CategorizationResult {
  const lower = stripDiacritics(description.toLowerCase());

  // DB-backed merchant entries (src/lib/categorization/merchant-db.ts) are
  // merged into the same buckets the static arrays below feed, so additions
  // to the Merchant table take effect without any engine changes. When no
  // index is supplied (e.g. existing tests calling this directly), these are
  // just the original static arrays.
  const transferKw = merchantIndex?.transferKeywords.length
    ? [...TRANSFER_KEYWORDS, ...merchantIndex.transferKeywords]
    : TRANSFER_KEYWORDS;
  const savingsKw = merchantIndex?.savingsKeywords.length
    ? [...SAVINGS_KEYWORDS, ...merchantIndex.savingsKeywords]
    : SAVINGS_KEYWORDS;
  const incomePatterns = merchantIndex?.incomePatterns.length
    ? [...merchantIndex.incomePatterns, ...INCOME_PATTERNS]
    : INCOME_PATTERNS;
  const highEntries = merchantIndex?.expenseHigh.length
    ? [...HIGH_CONFIDENCE_ENTRIES, ...merchantIndex.expenseHigh]
    : HIGH_CONFIDENCE_ENTRIES;
  const mediumEntries = merchantIndex?.expenseMedium.length
    ? [...MEDIUM_CONFIDENCE_ENTRIES, ...merchantIndex.expenseMedium]
    : MEDIUM_CONFIDENCE_ENTRIES;

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
  if (transferKw.some((kw) => lower.includes(kw))) {
    return { transactionType: "transfer", category: "transfer", confidence: "high", source: "merchant" };
  }
  // "Transfer to/from X" — only a transfer if X IS the account owner (a genuine
  // self-transfer between the user's own accounts), checked via
  // isTransferToOwner regardless of amount sign. Otherwise:
  //  - a positive amount falls through to income detection (a client payment
  //    described as "TRANSFER FROM ACME CONSULTING LTD" must never be lost), and
  //  - a negative amount falls through to expense merchant/keyword matching (a
  //    "Transfer to ABC Supplies Ltd" is a real vendor payment, not money
  //    leaving via an internal transfer).
  if (AMBIGUOUS_TRANSFER_KEYWORDS.some((kw) => lower.includes(kw)) && isTransferToOwner(lower, ownerName)) {
    return { transactionType: "transfer", category: "transfer", confidence: "high", source: "merchant" };
  }

  // PRIORITY 3 — Savings (investment platforms, ISA, pension, etc.)
  if (savingsKw.some((kw) => lower.includes(kw))) {
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
    for (const pattern of incomePatterns) {
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
  // searched across every active global + country pack (plus DB merchants) at once.
  const brandMatch = findBestMatch(lower, highEntries);
  if (brandMatch) {
    return { transactionType: "expense", category: brandMatch.category, confidence: "high", source: "merchant" };
  }
  // Layer 3: generic descriptive keyword / pattern match (medium confidence) —
  // e.g. "boulangerie" -> food, "pharmacie" -> health, "tabac" -> personal spending.
  const genericMatch = findBestMatch(lower, mediumEntries);
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
