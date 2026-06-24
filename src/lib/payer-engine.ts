// Payer Identity Engine
//
// Core question: "Who sent this money?"
//
// Revenue confidence is derived from payer behaviour:
//   - Repeated payments from the same entity raise confidence over time
//   - A payer with regular intervals and consistent amounts becomes verified
//   - Known institutions (banks, governments) are excluded regardless of amount
//   - A single payment from an unknown payer is LOW confidence until more evidence
//
// Revenue tiers (computed per payer, stored in MonthlyAnalytics):
//   verified  → HIGH confidence payers
//   likely    → MEDIUM confidence payers
//   review    → LOW confidence — user should inspect these
//   (excluded → bank / government / refund — never counted as revenue)

import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";

// ── Public types ──────────────────────────────────────────────────────────────

export type PayerType =
  | "client"        // confirmed freelance client
  | "employer"      // salary / payroll payer
  | "platform"      // Upwork, Fiverr, Stripe, PayPal, Malt, etc.
  | "bank"          // financial institution — NOT revenue
  | "government"    // tax authority, social benefits — NOT revenue
  | "refund_source" // expense reversal — NOT revenue
  | "unknown";      // unclassified — confidence from payment history

export type RevenueConfidence = "high" | "medium" | "low" | "none";

export type Cadence =
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "quarterly"
  | "irregular";

export interface PayerExtraction {
  rawName: string;        // cleaned text extracted from description
  matchKey: string;       // normalised key for deduplication
  detectedType: PayerType;
  method: string;         // for auditability
}

export interface PayerProfile {
  payerId: string;
  canonicalName: string;
  displayName: string | null;
  payerType: PayerType;
  revenueConfidence: RevenueConfidence;
  totalPayments: number;
  totalAmount: number;
  firstPayment: Date;
  lastPayment: Date;
  avgPaymentAmount: number;
  amountCv: number;             // coefficient of variation (0 = perfectly consistent)
  avgIntervalDays: number | null;
  intervalCv: number | null;
  detectedCadence: Cadence | null;
}

// ── Signal dictionaries ───────────────────────────────────────────────────────
// All strings are matched against a lowercased, accent-stripped description.

// Own-account transfers — definitively not revenue regardless of amount.
// Checked FIRST so "VIREMENT INTERNE 5000" never leaks into payer extraction.
const TRANSFER_SIGNALS = [
  "virement interne", "vir interne", "virt interne",
  "virement entre comptes", "virement de compte a compte",
  "virement vers mon compte", "virement depuis mon compte",
  "own account", "own transfer", "internal transfer", "self transfer",
  "account to account", "between accounts", "between my accounts",
  "mon compte courant", "de mon compte", "vers mon compte",
  "compte a compte", "retour virement",
];

// Savings products and bank institution signals in the description.
// Space-padded short names ("lcl ", " n26 ") prevent matching unrelated words.
const BANK_SIGNALS = [
  // Savings products — own money returning from savings
  "livret a", "livret bleu", "ldd ", "ldds", "cel ", "pel ", "pea ",
  "assurance vie", "epargne", "savings account", "savings transfer",
  "isa account", "isa transfer", "lisa ", "premium bond", "ns&i",
  "mon livret", "compte epargne", "compte sur livret", "livret developpement",
  // Named French retail banks
  "bnp paribas", " bnp ", "credit agricole", "societe generale",
  "caisse d epargne", "banque postale", "la banque postale",
  "credit mutuel", " lcl ", "credit du nord", "banque populaire",
  "bpce", "natixis", "bpi france", "bpifrance", "credit foncier",
  // French online / neo banks
  "boursorama", "hello bank", "fortuneo", "orange bank", "shine bank",
  "monabanq", "axa banque",
  // International neo banks (excluding Revolut and Wise which also act as
  // payment platforms for client payments — handled in PLATFORM_SIGNALS)
  " n26 ", "monzo", "starling bank", "bunq", "qonto", "paysend",
  // UK banks
  "natwest", "lloyds bank", "barclays bank", "santander uk", "halifax",
  "nationwide", "first direct", "metro bank", "hsbc bank",
  "royal bank of scotland", "bank of scotland",
];

// Normalised match keys for known banks — used for post-extraction exact check.
// After prefix-stripping, if the extracted payer IS one of these, it is a bank
// transfer disguised as a client payment (e.g. "VIREMENT BNP PARIBAS REF 001").
const KNOWN_BANK_MATCH_KEYS = new Set([
  "bnp", "bnp paribas",
  "credit agricole",
  "societe generale",
  "caisse epargne", "caisse d epargne",
  "banque postale", "la banque postale",
  "credit mutuel",
  "lcl",
  "credit du nord",
  "banque populaire",
  "bpce", "natixis", "bpi france", "bpifrance",
  "boursorama",
  "hello bank",
  "fortuneo",
  "orange bank",
  "shine", "shine bank",
  "qonto",
  "n26",
  "monzo",
  "starling", "starling bank",
  "bunq",
  "natwest",
  "lloyds", "lloyds bank",
  "barclays",
  "santander",
  "halifax",
  "nationwide",
  "hsbc",
  "ing",
  "axa banque",
  "credit foncier",
]);

// Single-word extractions that are not meaningful payer names.
// A description that yields only one of these after stripping provides no
// identity signal — returning null triggers the Needs Review queue correctly.
const MEANINGLESS_EXTRACTED = new Set([
  "credit", "debit", "virement", "paiement", "payment",
  "transfer", "transaction", "operation", "interne", "incoming",
  "received", "recu", "depot", "deposit", "compte", "banque", "bank",
]);

const GOVERNMENT_SIGNALS = [
  "dgfip", "direction generale des finances",
  "hmrc", "irs refund",
  "caf ", "pole emploi", "france travail",
  "impots ", "tresor public",
  "apl ", "rsa ", "csg ", "prime activite",
  "allocation famil", "prestation sociale",
  "remboursement tva", "credit tva",
  "cpam", "assurance maladie",
  "pension credit", "working tax credit", "social security",
];

// Platform display name keyed by the string to search in description
const PLATFORM_SIGNALS: Record<string, string> = {
  upwork:         "Upwork",
  fiverr:         "Fiverr",
  "malt.fr":      "Malt",
  " malt ":       "Malt",
  toptal:         "Toptal",
  "99designs":    "99designs",
  "guru.com":     "Guru",
  peopleperhour:  "PeoplePerHour",
  contently:      "Contently",
  hubstaff:       "Hubstaff",
  stripe:         "Stripe",
  paypal:         "PayPal",
  "wise.com":     "Wise",
  " wise ":       "Wise",
  sumup:          "SumUp",
  gocardless:     "GoCardless",
  adyen:          "Adyen",
  "checkout.com": "Checkout.com",
  braintree:      "Braintree",
  revolut:        "Revolut",
};

// Salary/payroll signals — classify payer as employer
const SALARY_SIGNALS = [
  "salaire", "salary", "payroll", "wages", "traitement",
  "virement salaire", "paie ", "paye ", "net a payer",
  "remuneration", "mensuel emploi",
];

// Refund signals — classify as refund_source
const REFUND_SIGNALS = [
  "refund", "remboursement achat", "cashback", "cash back",
  "reversal", "chargeback", "retour commande", "retour achat",
  "purchase reversal", "returned payment", "annulation commande",
];

// Prefixes that precede the payer name in bank descriptions
const PREFIX_PATTERNS: RegExp[] = [
  // French SEPA / bank wire
  /^vir(?:ement)?\s*(?:recu\s+)?(?:de\s+|emis\s+par\s+|en\s+provenance\s+de\s+|par\s+)?/i,
  /^sepa\s*(?:credit|inst|virement|transfer)?\s*/i,
  /^credit\s+(?:sepa\s+)?(?:de\s+|par\s+)?/i,
  /^vrt\s+/i,
  /^rec(?:u)?\s+(?:de\s+)?/i,
  // French payroll
  /^salaire\s+(?:net\s+)?(?:\w+\s+)?(?:de\s+)?(?:la\s+)?(?:societe\s+)?/i,
  /^remun(?:eration)?\s+(?:de\s+)?/i,
  /^paie?\s+(?:de\s+)?/i,
  /^honoraires?\s+(?:de\s+)?/i,
  // French generic
  /^pay(?:ment)?\s+(?:recu\s+)?(?:from\s+|de\s+|par\s+)?/i,
  // UK bank
  /^faster\s+payment(?:s)?\s+(?:received\s+)?(?:from\s+)?/i,
  /^bacs\s+(?:credit\s+)?(?:from\s+)?/i,
  /^fps\s+(?:credit\s+)?(?:from\s+)?/i,
  /^standing\s+order\s+(?:from\s+)?/i,
  /^bank\s+transfer\s+(?:from\s+)?/i,
  /^internet\s+(?:banking\s+)?(?:transfer\s+)?(?:from\s+)?/i,
  // Generic
  /^transfer\s+(?:from\s+)?/i,
  /^income\s+(?:from\s+)?/i,
  /^received\s+from\s+/i,
  /^from\s+/i,
];

// Noise to strip from the end of the extracted name
const SUFFIX_PATTERNS: RegExp[] = [
  /\s+ref(?:erence)?[:\s]+[\w\-\/]{3,}$/i,
  /\s+[A-Z0-9]{8,}$/,                          // long alphanumeric codes
  /\s+\d{6,8}$/,                                // DDMMYYYY / YYYYMMDD
  /\s+\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}$/, // DD/MM/YY
  /\s+(?:fact|facture|inv|invoice|devis|po|bill)\s*[\w\-\/]+$/i,
  /\s+\d{4,}$/,                                 // trailing numbers
];

const LEGAL_SUFFIXES = [
  // French
  "sarl", "sas", "sa", "snc", "sci", "eurl", "selarl", "scp", "scea",
  // UK / Commonwealth
  "ltd", "limited", "plc", "llp",
  // US / International
  "llc", "inc", "corp", "co", "company",
  // German
  "gmbh", "ag", "ug", "kg",
  // Dutch / Belgian
  "bv", "nv",
  // Italian / Spanish
  "spa", "srl", "sl",
  // Nordic
  "ab", "as", "oy",
];

// ── Pure helper functions ─────────────────────────────────────────────────────

function asciiLower(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function capitalizeWords(text: string): string {
  return text.toLowerCase().replace(/\b(\w)/g, (c) => c.toUpperCase());
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── extractPayer ──────────────────────────────────────────────────────────────

/**
 * Extract a payer identity from a raw bank transaction description.
 * Returns null for expense / zero-amount transactions.
 *
 * Extraction is purely text-based — no DB lookups here.
 * Results are normalised and stored in PayerAlias for deduplication.
 */
export function extractPayer(
  description: string,
  category: string,
  amount: number,
): PayerExtraction | null {
  if (amount <= 0) return null;

  // Space-pad so signals with word boundaries (e.g. " bnp ", " n26 ") match
  // at the start and end of descriptions, not just in the middle.
  const norm = ` ${asciiLower(description)} `;
  const cat  = category.toLowerCase();

  // 1. Own-account transfer signals — must be first.
  //    "VIREMENT INTERNE 5000" would otherwise be extracted as payer "Interne".
  if (matchesAny(norm, TRANSFER_SIGNALS)) {
    return {
      rawName:      "Internal Transfer",
      matchKey:     "own-account-transfer",
      detectedType: "bank",
      method:       "transfer-signal",
    };
  }

  // 2. Savings products and named bank institutions in the description.
  for (const signal of BANK_SIGNALS) {
    if (norm.includes(signal)) {
      return {
        rawName:      capitalizeWords(description.slice(0, 40).trim()),
        matchKey:     normalizeMatchKey(signal.trim()),
        detectedType: "bank",
        method:       "bank-signal",
      };
    }
  }

  // 3. Government / benefits signals
  for (const signal of GOVERNMENT_SIGNALS) {
    if (norm.includes(signal)) {
      return {
        rawName:      capitalizeWords(description.slice(0, 40).trim()),
        matchKey:     normalizeMatchKey(signal.trim()),
        detectedType: "government",
        method:       "government-signal",
      };
    }
  }

  // 4. Known platforms (Stripe, Upwork, PayPal, etc.)
  for (const [keyword, displayName] of Object.entries(PLATFORM_SIGNALS)) {
    if (norm.includes(keyword)) {
      return {
        rawName:      displayName,
        matchKey:     keyword.trim(),
        detectedType: "platform",
        method:       "platform-match",
      };
    }
  }

  // 5. Refund signals
  if (matchesAny(norm, REFUND_SIGNALS) || cat === "refund") {
    return {
      rawName:      capitalizeWords(description.slice(0, 40).trim()),
      matchKey:     "refund:" + normalizeMatchKey(description.slice(0, 20)),
      detectedType: "refund_source",
      method:       "refund-signal",
    };
  }

  // 6. Strip bank prefixes to expose the payer name
  let extracted = description.trim();
  for (const pattern of PREFIX_PATTERNS) {
    const match = extracted.match(pattern);
    if (match) {
      extracted = extracted.slice(match[0].length).trim();
      break;
    }
  }

  // 7. Strip trailing reference noise
  for (const pattern of SUFFIX_PATTERNS) {
    extracted = extracted.replace(pattern, "").trim();
  }

  // 8. Validate: need at least 3 chars, not purely numeric
  if (extracted.length < 3 || /^\d+$/.test(extracted)) return null;

  const rawName  = capitalizeWords(extracted.slice(0, 60).trim());
  const matchKey = normalizeMatchKey(rawName);

  if (matchKey.length < 2) return null;

  // 9. Post-extraction: check if the extracted name resolves to a known bank.
  //    Catches "VIREMENT BNP PARIBAS REF 001" → extracted "BNP PARIBAS" → bank.
  if (KNOWN_BANK_MATCH_KEYS.has(matchKey)) {
    return {
      rawName,
      matchKey,
      detectedType: "bank",
      method:       "extracted-bank-name",
    };
  }

  // 10. Filter out meaningless single-word extractions.
  //     "CREDIT REF 48291730" → stripped to "CREDIT" → no identity signal.
  //     Return null: transaction goes to needsReview with no payer linked.
  if (MEANINGLESS_EXTRACTED.has(matchKey)) return null;

  // 11. Check salary markers in the extracted name → employer type
  const extractedNorm = asciiLower(extracted);
  const isEmployer    = matchesAny(extractedNorm, SALARY_SIGNALS) || cat === "salary";

  return {
    rawName,
    matchKey,
    detectedType: isEmployer ? "employer" : "unknown",
    method:       "prefix-strip",
  };
}

// ── normalizeMatchKey ─────────────────────────────────────────────────────────

/**
 * Normalize a payer name to a stable deduplication key.
 * "ACME SARL", "ACME LTD", "ACME LIMITED", "Acme Inc." → "acme"
 */
export function normalizeMatchKey(name: string): string {
  let key = asciiLower(name)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Iteratively remove trailing legal suffixes
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      const re = new RegExp(`(?:^|\\s+)${suffix}\\s*$`);
      const cleaned = key.replace(re, "").trim();
      if (cleaned !== key && cleaned.length >= 2) {
        key = cleaned;
        changed = true;
      }
    }
  }

  return key.replace(/\s+/g, " ").trim();
}

// ── Cadence detection ─────────────────────────────────────────────────────────

/**
 * Detect a regular payment cadence from a list of inter-payment intervals (days).
 * Requires at least 2 intervals (3 payments) to detect a cadence.
 */
export function detectCadence(intervals: number[]): Cadence | null {
  if (intervals.length < 2) return null;

  const avg = mean(intervals);
  const cv  = avg > 0 ? stdDev(intervals, avg) / avg : 1;

  // Timing too inconsistent to label — call it irregular
  if (cv > 0.35) return "irregular";

  if (avg >= 5  && avg <= 9)   return "weekly";
  if (avg >= 12 && avg <= 17)  return "bi-weekly";
  if (avg >= 25 && avg <= 35)  return "monthly";
  if (avg >= 80 && avg <= 100) return "quarterly";

  return "irregular";
}

// ── Revenue confidence ────────────────────────────────────────────────────────

/**
 * Compute revenue confidence from payer behaviour.
 * The confidence rises as the payer makes more payments with a consistent pattern.
 *
 * "none"   → bank / government / refund — definitively not revenue
 * "low"    → 1 payment, unknown payer — needs review
 * "medium" → 2+ payments from same payer (they came back — likely real)
 * "high"   → 3+ payments with detectable cadence, OR 6+ payments regardless
 */
export function computeRevenueConfidence(
  payerType: PayerType,
  totalPayments: number,
  cadence: Cadence | null,
): RevenueConfidence {
  if (payerType === "bank" || payerType === "government" || payerType === "refund_source") {
    return "none";
  }

  // Platforms and employers are inherently revenue sources
  if (payerType === "platform" || payerType === "employer") {
    return totalPayments >= 2 ? "high" : "medium";
  }

  // client / unknown: let the payment history speak
  const hasPattern = cadence !== null && cadence !== "irregular";

  if (totalPayments >= 3 && hasPattern) return "high";
  if (totalPayments >= 6)               return "high";
  if (totalPayments >= 2)               return "medium";
  return "low";
}

// ── DB: resolve payers for a batch of transactions ────────────────────────────

/**
 * Link a set of newly-imported transaction IDs to Payer records.
 * Creates new Payer + PayerAlias rows when no match exists.
 * Updates hitCount on existing aliases.
 * Sets transaction.payerId and transaction.needsReview for low-confidence payers.
 *
 * Called by the upload route immediately after createMany.
 */
export async function resolvePayers(
  userId: string,
  transactionIds: string[],
): Promise<void> {
  if (transactionIds.length === 0) return;

  // Fetch the new transactions
  const txs = await prisma.transaction.findMany({
    where:  { id: { in: transactionIds }, transactionType: "income" },
    select: { id: true, description: true, category: true, amount: true },
  });

  if (txs.length === 0) return;

  // Load all existing aliases for this user (for O(1) match lookup)
  const existingAliases = await prisma.payerAlias.findMany({
    where:  { payer: { userId } },
    select: { matchKey: true, payerId: true, id: true },
  });
  const aliasMap = new Map<string, { payerId: string; aliasId: string }>(
    existingAliases.map((a) => [a.matchKey, { payerId: a.payerId, aliasId: a.id }]),
  );

  // Payer types that are definitively identified — no review needed
  const KNOWN_TYPES = new Set<PayerType>(["bank", "government", "refund_source", "platform", "employer"]);

  // Process each transaction
  const txUpdates:     Array<{ id: string; payerId: string; needsReview: boolean }> = [];
  const unresolvable:  string[] = []; // income txs where payer identity cannot be extracted
  const newPayers:     Map<string, { canonicalName: string; payerType: PayerType; txIds: string[] }> = new Map();
  const aliasHits:     Map<string, { payerId: string; aliasId: string; txIds: string[] }> = new Map();

  for (const tx of txs) {
    const extraction = extractPayer(tx.description, tx.category, Number(tx.amount));

    if (!extraction) {
      // Description too generic to extract a payer identity (e.g. "CREDIT REF 48291730").
      // Mark for manual review — do NOT silently skip.
      unresolvable.push(tx.id);
      continue;
    }

    const { matchKey, rawName, detectedType } = extraction;
    const existingMatch = aliasMap.get(matchKey);

    if (existingMatch) {
      // Returning payer — link to existing record, no review needed
      const hit = aliasHits.get(matchKey) ?? { ...existingMatch, txIds: [] };
      hit.txIds.push(tx.id);
      aliasHits.set(matchKey, hit);
      txUpdates.push({ id: tx.id, payerId: existingMatch.payerId, needsReview: false });

    } else if (newPayers.has(matchKey)) {
      // Same new payer seen twice in this batch
      newPayers.get(matchKey)!.txIds.push(tx.id);

    } else {
      // Brand-new payer
      newPayers.set(matchKey, { canonicalName: rawName, payerType: detectedType, txIds: [tx.id] });
    }
  }

  // Persist new Payer records and aliases
  for (const [matchKey, payerData] of newPayers) {
    const payer = await prisma.payer.upsert({
      where:  { userId_canonicalName: { userId, canonicalName: payerData.canonicalName } },
      update: { updatedAt: new Date() },
      create: { userId, canonicalName: payerData.canonicalName, payerType: payerData.payerType },
    });

    await prisma.payerAlias.upsert({
      where:  { payerId_matchKey: { payerId: payer.id, matchKey } },
      update: { hitCount: { increment: 1 } },
      create: { payerId: payer.id, rawText: payerData.canonicalName, matchKey, hitCount: 1 },
    });

    aliasMap.set(matchKey, { payerId: payer.id, aliasId: "" });

    // needsReview = false when the payer type is definitively known (bank, platform, etc.)
    // needsReview = true when payer is "unknown" or "client" appearing for the first time
    const needsReview = !KNOWN_TYPES.has(payerData.payerType);
    for (const txId of payerData.txIds) {
      txUpdates.push({ id: txId, payerId: payer.id, needsReview });
    }
  }

  // Increment hit counts for existing aliases
  for (const hit of aliasHits.values()) {
    if (hit.aliasId) {
      await prisma.payerAlias.update({
        where: { id: hit.aliasId },
        data:  { hitCount: { increment: hit.txIds.length } },
      }).catch(() => { /* non-critical */ });
    }
  }

  // Apply payerId + needsReview to resolved transactions
  if (txUpdates.length > 0) {
    await Promise.all(
      txUpdates.map((u) =>
        prisma.transaction.update({
          where: { id: u.id },
          data:  { payerId: u.payerId, needsReview: u.needsReview },
        }),
      ),
    );
  }

  // Mark unresolvable income transactions for manual review
  if (unresolvable.length > 0) {
    await prisma.transaction.updateMany({
      where: { id: { in: unresolvable } },
      data:  { needsReview: true },
    });
  }
}

// ── DB: compute payer profiles ────────────────────────────────────────────────

/**
 * Compute PayerProfile for every payer belonging to userId.
 * Profiles are derived entirely from the payment history — no assumptions.
 */
export async function getPayerProfiles(userId: string): Promise<PayerProfile[]> {
  const payers = await prisma.payer.findMany({
    where: { userId },
    include: {
      transactions: {
        where:   { transactionType: "income" },
        select:  { amount: true, transactionDate: true },
        orderBy: { transactionDate: "asc" },
      },
    },
  });

  return payers.map((p) => {
    const txs = p.transactions;
    if (txs.length === 0) {
      return {
        payerId:           p.id,
        canonicalName:     p.canonicalName,
        displayName:       p.displayName,
        payerType:         p.payerType as PayerType,
        revenueConfidence: p.payerType === "bank" || p.payerType === "government" || p.payerType === "refund_source"
          ? "none"
          : "low",
        totalPayments:     0,
        totalAmount:       0,
        firstPayment:      new Date(0),
        lastPayment:       new Date(0),
        avgPaymentAmount:  0,
        amountCv:          0,
        avgIntervalDays:   null,
        intervalCv:        null,
        detectedCadence:   null,
      } satisfies PayerProfile;
    }

    const amounts = txs.map((t) => Number(t.amount));
    const dates   = txs.map((t) => new Date(t.transactionDate).getTime());

    const totalAmount  = amounts.reduce((s, a) => s + a, 0);
    const avgAmount    = mean(amounts);
    const amountCv     = avgAmount > 0 ? stdDev(amounts, avgAmount) / avgAmount : 0;

    // Inter-payment intervals in days
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / 86_400_000);
    }

    const avgIntervalDays  = intervals.length > 0 ? mean(intervals) : null;
    const avgInterval      = avgIntervalDays ?? 0;
    const intervalCv       = intervals.length >= 2 && avgInterval > 0
      ? stdDev(intervals, avgInterval) / avgInterval
      : null;
    const detectedCadence  = detectCadence(intervals);

    const payerType        = p.payerType as PayerType;
    const revenueConfidence = computeRevenueConfidence(
      payerType,
      txs.length,
      detectedCadence,
    );

    return {
      payerId:          p.id,
      canonicalName:    p.canonicalName,
      displayName:      p.displayName,
      payerType,
      revenueConfidence,
      totalPayments:    txs.length,
      totalAmount,
      firstPayment:     new Date(dates[0]),
      lastPayment:      new Date(dates[dates.length - 1]),
      avgPaymentAmount: avgAmount,
      amountCv,
      avgIntervalDays,
      intervalCv,
      detectedCadence,
    } satisfies PayerProfile;
  });
}

// ── DB: recompute verified revenue in MonthlyAnalytics ───────────────────────

/**
 * Recompute verifiedRevenue / likelyRevenue / reviewRevenue in MonthlyAnalytics
 * from payer profiles. Called after resolvePayers on every import.
 *
 * Revenue is never assumed — it is earned through demonstrated payer behaviour.
 */
export async function recomputeVerifiedRevenue(userId: string): Promise<void> {
  const profiles = await getPayerProfiles(userId);

  // Build a confidence map: payerId → confidence
  const confidenceMap = new Map<string, RevenueConfidence>(
    profiles.map((p) => [p.payerId, p.revenueConfidence]),
  );

  // Fetch all income transactions with their payer + date
  const txs = await prisma.transaction.findMany({
    where:  { userId, transactionType: "income" },
    select: { amount: true, transactionDate: true, payerId: true },
  });

  // Aggregate by month/year and confidence tier
  type MonthKey = string;
  const agg: Record<MonthKey, { verified: number; likely: number; review: number }> = {};

  for (const tx of txs) {
    if (!tx.payerId) continue; // not yet resolved → skip for now

    const confidence = confidenceMap.get(tx.payerId);
    if (!confidence || confidence === "none") continue;

    const d   = new Date(tx.transactionDate);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    if (!agg[key]) agg[key] = { verified: 0, likely: 0, review: 0 };

    const amt = Number(tx.amount);
    if (confidence === "high")   agg[key].verified += amt;
    if (confidence === "medium") agg[key].likely   += amt;
    if (confidence === "low")    agg[key].review   += amt;
  }

  // Update MonthlyAnalytics rows
  await Promise.all(
    Object.entries(agg).map(async ([key, totals]) => {
      const [yearStr, monthStr] = key.split("-");
      const year  = parseInt(yearStr,  10);
      const month = parseInt(monthStr, 10);

      await prisma.monthlyAnalytics.updateMany({
        where: { userId, year, month },
        data:  {
          verifiedRevenue: new Decimal(totals.verified),
          likelyRevenue:   new Decimal(totals.likely),
          reviewRevenue:   new Decimal(totals.review),
        },
      });
    }),
  );
}
