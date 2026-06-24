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

const BANK_SIGNALS = [
  "livret a", "livret bleu", "ldd ", "ldds", "cel ", "pel ", "pea ",
  "assurance vie", "epargne", "savings account", "savings transfer",
  "isa account", "isa transfer", "lisa ", "premium bond", "ns&i",
  "mon livret", "compte epargne", "compte sur livret",
  "livret developpement",
];

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

  const norm = asciiLower(description);
  const cat  = category.toLowerCase();

  // 1. Known savings / bank signals → payer type = bank
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

  // 2. Government / benefits signals
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

  // 3. Known platforms (Stripe, Upwork, PayPal, etc.)
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

  // 4. Refund signals
  if (matchesAny(norm, REFUND_SIGNALS) || cat === "refund") {
    return {
      rawName:      capitalizeWords(description.slice(0, 40).trim()),
      matchKey:     "refund:" + normalizeMatchKey(description.slice(0, 20)),
      detectedType: "refund_source",
      method:       "refund-signal",
    };
  }

  // 5. Strip bank prefixes from the description to expose the payer name
  let extracted = description.trim();
  for (const pattern of PREFIX_PATTERNS) {
    const match = extracted.match(pattern);
    if (match) {
      extracted = extracted.slice(match[0].length).trim();
      break;
    }
  }

  // 6. Strip trailing reference noise
  for (const pattern of SUFFIX_PATTERNS) {
    extracted = extracted.replace(pattern, "").trim();
  }

  // 7. Validate: need at least 3 chars, and it can't be purely numeric
  if (extracted.length < 3 || /^\d+$/.test(extracted)) return null;

  const rawName  = capitalizeWords(extracted.slice(0, 60).trim());
  const matchKey = normalizeMatchKey(rawName);

  if (matchKey.length < 2) return null;

  // 8. Check whether the extracted name contains salary markers
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

  // Process each transaction
  const txUpdates: Array<{ id: string; payerId: string; needsReview: boolean }> = [];
  const newPayers:  Map<string, { canonicalName: string; payerType: PayerType; txIds: string[] }> = new Map();
  const aliasHits:  Map<string, { payerId: string; aliasId: string; txIds: string[] }> = new Map();
  const newAliases: Map<string, { payerId: string; rawText: string; matchKey: string }> = new Map();

  for (const tx of txs) {
    const extraction = extractPayer(tx.description, tx.category, Number(tx.amount));
    if (!extraction) continue;

    const { matchKey, rawName, detectedType } = extraction;

    const existingMatch = aliasMap.get(matchKey);

    if (existingMatch) {
      // Known payer → just increment hit and link
      const hit = aliasHits.get(matchKey) ?? { ...existingMatch, txIds: [] };
      hit.txIds.push(tx.id);
      aliasHits.set(matchKey, hit);
      txUpdates.push({ id: tx.id, payerId: existingMatch.payerId, needsReview: false });

    } else if (newPayers.has(matchKey)) {
      // Already creating this payer in the same batch → link to it
      newPayers.get(matchKey)!.txIds.push(tx.id);

    } else {
      // Brand-new payer for this batch
      newPayers.set(matchKey, {
        canonicalName: rawName,
        payerType:     detectedType,
        txIds:         [tx.id],
      });
    }
  }

  // Persist new Payer records and aliases
  for (const [matchKey, payerData] of newPayers) {
    // Upsert so concurrent imports don't race on the unique constraint
    const payer = await prisma.payer.upsert({
      where:  { userId_canonicalName: { userId, canonicalName: payerData.canonicalName } },
      update: { updatedAt: new Date() },
      create: {
        userId,
        canonicalName: payerData.canonicalName,
        payerType:     payerData.payerType,
      },
    });

    // Upsert alias
    await prisma.payerAlias.upsert({
      where:  { payerId_matchKey: { payerId: payer.id, matchKey } },
      update: { hitCount: { increment: 1 } },
      create: {
        payerId:  payer.id,
        rawText:  payerData.canonicalName,
        matchKey,
        hitCount: 1,
      },
    });

    // Register in aliasMap for future txs in this batch
    aliasMap.set(matchKey, { payerId: payer.id, aliasId: "" });

    for (const txId of payerData.txIds) {
      txUpdates.push({ id: txId, payerId: payer.id, needsReview: true });
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

  // Update all transactions with their resolved payerId
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
