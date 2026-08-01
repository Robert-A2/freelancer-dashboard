import { normalizeMatchKey } from "../payer-engine";
import type { MerchantExtraction } from "./types";

// ── Expense-domain-specific noise ────────────────────────────────────────
// No payer-engine.ts analog — that file's dictionaries are payer-specific
// (income-side). These are the expense-side equivalents: payment-processor
// pass-through prefixes, recurring-billing suffixes, and chain/location noise.

const PROCESSOR_PREFIX_PATTERNS: RegExp[] = [
  /^sq \*\s*/i,      // Square
  /^tst\*\s*/i,      // Toast POS
  /^cko\*\s*/i,      // Checkout.com
  /^paypal \*\s*/i,  // PayPal pass-through — strip to reveal the underlying merchant
                      // (deliberately the OPPOSITE of payer-engine.ts's PLATFORM_SIGNALS,
                      // which keeps "PayPal" as the identity on the income side — here
                      // we want what was actually bought, not the processor)
];

const RECURRING_SUFFIX_PATTERNS: RegExp[] = [
  /\s*\*recurring$/i,
  /\s+recurring pmt$/i,
  /\s*\*monthly$/i,
];

// Small local copy of the reference-number/date/location-number stripping
// shape used by payer-engine.ts's (unexported) SUFFIX_PATTERNS — generic
// enough not to warrant forcing a diff to that proven file for four regexes.
const REFERENCE_SUFFIX_PATTERNS: RegExp[] = [
  /\s+ref(?:erence)?[:\s]+[\w\-/]{3,}$/i,
  // Requires at least one digit (lookahead) — a genuine reference code
  // ("8H2K9LXQ2T", "REF88213AB") always has one; a plain all-caps English
  // word ("INTERNATIONAL", "WORLDWIDE") never does. Without this guard, raw
  // bank CSVs (routinely all-uppercase) had real merchant-identity words
  // silently deleted as if they were noise — found while testing Phase 2's
  // geo-noise resolution fallback (resolve.ts), which depends on words like
  // "INTERNATIONAL" surviving extraction to be stripped deliberately instead.
  /\s+(?=[A-Z0-9]*\d)[A-Z0-9]{8,}$/,
  /\s+\d{6,8}$/,
  /\s+\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/,
  /\s+#?\d{3,}$/, // trailing store/location numbers, e.g. "STORE 4521", "#3311"
];

// A candidate that's nothing but a generic transaction-mechanics word carries
// no identity signal — same principle as payer-engine.ts's MEANINGLESS_EXTRACTED.
const MEANINGLESS = new Set(["payment", "purchase", "transaction", "pos", "debit", "card", "pending"]);

function capitalizeWords(text: string): string {
  return text.toLowerCase().replace(/\b(\w)/g, (c) => c.toUpperCase());
}

/**
 * Extracts a clean merchant candidate from a raw expense description. Only
 * called for the unknown long tail (see resolve.ts) — a transaction that
 * matched a known merchant/keyword never reaches this function, since
 * categorizeTransaction()'s substring waterfall already solved it.
 *
 * Expense-side only (amount < 0) — income-side identity is payer-engine.ts's
 * job (Payer/PayerAlias), not this pipeline's; duplicating that would create
 * two competing identity systems for the same money movement.
 */
export function extractMerchantCandidate(description: string, amount: number): MerchantExtraction | null {
  if (amount >= 0) return null;

  let text = description.trim();
  let method: MerchantExtraction["method"] = "raw";

  for (const pattern of PROCESSOR_PREFIX_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      text = text.slice(match[0].length).trim();
      method = "processor-prefix-strip";
      break;
    }
  }

  // Iterate to convergence, not a single pass — stripping a trailing number
  // (e.g. " 4471") can newly expose a "REF 88213"-style pattern that only
  // matches once the token after it is gone. Bounded iteration count is pure
  // safety margin: every successful match strictly shortens `text`, so this
  // terminates on its own regardless.
  let strippedSuffix = false;
  const allSuffixPatterns = [...RECURRING_SUFFIX_PATTERNS, ...REFERENCE_SUFFIX_PATTERNS];
  for (let pass = 0; pass < 5; pass++) {
    let changedThisPass = false;
    for (const pattern of allSuffixPatterns) {
      if (pattern.test(text)) {
        text = text.replace(pattern, "").trim();
        strippedSuffix = true;
        changedThisPass = true;
      }
    }
    if (!changedThisPass) break;
  }
  if (strippedSuffix && method === "raw") method = "chain-suffix-strip";

  if (text.length < 3 || /^\d+$/.test(text)) return null;

  const normalizedKey = normalizeMatchKey(text);
  if (normalizedKey.length < 2 || MEANINGLESS.has(normalizedKey)) return null;

  return { candidateName: capitalizeWords(text), normalizedKey, method };
}
