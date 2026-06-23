// Client Identity Engine
// Extracts real client names from bank description strings.
// Core principle: never display a payment rail term as a client name.
// If confidence is insufficient, return "Unidentified Income Source".

export type ClientConfidence = "high" | "medium" | "low" | "unknown";

export interface ClientNameResult {
  name: string;
  confidence: ClientConfidence;
  isProcessor: boolean;
}

// Display name used when identity cannot be determined
export const UNIDENTIFIED_SOURCE = "Unidentified Income Source";

// ── Known payment processors ──────────────────────────────────────────────────
// These are intermediaries, not clients. Marked so the UI can explain
// that they may represent multiple underlying clients the bank can't see through.
const PAYMENT_PROCESSORS: Record<string, string> = {
  stripe:        "Stripe",
  paypal:        "PayPal",
  upwork:        "Upwork",
  fiverr:        "Fiverr",
  toptal:        "Toptal",
  malt:          "Malt",
  "malt.com":    "Malt",
  freelancer:    "Freelancer.com",
  "99designs":   "99designs",
  wise:          "Wise",
  transferwise:  "Wise",
  revolut:       "Revolut",
  "people per hour": "PeoplePerHour",
  peopleperhour: "PeoplePerHour",
  "guru.com":    "Guru",
};

// ── Payment rail prefixes ─────────────────────────────────────────────────────
// Ordered longest-first. We strip the FIRST matching prefix from the START
// of the description. These terms describe HOW money moved, never WHO sent it.
const RAIL_PREFIXES: string[] = [
  // SEPA (EU standard)
  "SEPA INSTANT CREDIT TRANSFER",
  "SEPA CREDIT TRANSFER",
  "SEPA CREDIT",
  "SEPA INST",
  "SEPA CT",
  // SCT (SEPA Credit Transfer abbreviation)
  "SCT INST",
  "SCT",
  // Credit / Transfer phrases
  "CREDIT TRANSFER",
  "CREDIT VIREMENT",
  "BANK CREDIT TRANSFER",
  "BANK TRANSFER",
  "WIRE TRANSFER",
  "DIRECT CREDIT",
  "DIRECT DEPOSIT",
  // UK Faster Payments / BACS / CHAPS
  "FASTER PAYMENTS",
  "FASTER PAYMENT",
  "FPS PAYMENT",
  "BACS PAYMENT",
  "CHAPS PAYMENT",
  "FPS",
  "BACS",
  "CHAPS",
  "CHAP",
  // US ACH
  "ACH PAYMENT",
  "ACH",
  // French virement
  "VIREMENT SEPA INSTANTANE",
  "VIREMENT INSTANTANE",
  "VIREMENT SEPA",
  "VIREMENT INST",
  "VIREMENT",
  "VIR INST",
  "VIR SEPA",
  "VIR",
  // French prélèvement
  "PRELEVEMENT SEPA",
  "PRELEVEMENT",
  "PRLV SEPA",
  "PRLV",
  // CB
  "REMISE CB",
  // Source patterns
  "TRANSFER FROM",
  "PAYMENT FROM",
  "RECEIVED FROM",
  "INCOMING PAYMENT",
  "INCOMING TRANSFER",
  "INBOUND PAYMENT",
  "INBOUND TRANSFER",
  "INCOMING",
  "INBOUND",
  // Standing orders
  "STANDING ORDER",
  // Short abbreviations — safe single words that never appear in company names
  "TRF",
  "TFR",
];

// These words, if found at the START of the REMAINING text after prefix stripping,
// are treated as additional rail noise and removed — but ONLY if they are not the
// only remaining word (we never reduce the result to nothing via this path).
const LEADING_NOISE_WORDS = new Set([
  "PAYMENT", "TRANSFER", "CREDIT", "DEBIT",
  "FROM", "BY", "REF", "REFERENCE",
]);

// ── Tail noise patterns ───────────────────────────────────────────────────────
// Removed from the END of the extracted name.
// Reference numbers, dates, invoice IDs — not part of the client's name.
const TAIL_PATTERNS: RegExp[] = [
  /\b(ref|reference|inv|invoice|payment|id|no\.?|num|number|order)\s*[:#\-]?\s*[\w\-/]+$/gi,
  /\b\d{5,}\b/g,        // long numeric refs (5+ digits)
  /\b\d{2}[/-]\d{2}([/-]\d{2,4})?\b/g, // date patterns DD/MM/YY
  /\s+$/g,
];

// Words that, if they make up the ENTIRE remaining string after all cleanup,
// tell us we haven't found a real client name.
const RAIL_ONLY_WORDS = new Set([
  "SEPA", "CREDIT", "TRANSFER", "PAYMENT", "BANK", "WIRE",
  "VIREMENT", "VIR", "SCT", "FPS", "BACS", "CHAPS", "ACH",
  "TRF", "TFR", "TRANSACTION", "INCOMING", "INBOUND", "DEPOSIT",
  "REMITTANCE", "RECEIVED", "RECEIPT", "DIRECT", "CR", "DB",
  "STANDING", "ORDER", "INSTANT", "INST", "FASTER", "PRLV",
  "REMISE", "CB", "FROM", "BY", "REF", "ID", "NO",
]);

// ── Core extraction ───────────────────────────────────────────────────────────

export function extractClientName(
  description: string,
  category: string
): ClientNameResult {
  const lower = description.toLowerCase().trim();

  // Step 1: Check category for known processors (most reliable signal)
  if (PAYMENT_PROCESSORS[category]) {
    return { name: PAYMENT_PROCESSORS[category], confidence: "high", isProcessor: true };
  }

  // Step 2: Check description for processor keywords
  for (const [kw, label] of Object.entries(PAYMENT_PROCESSORS)) {
    if (lower.includes(kw)) {
      return { name: label, confidence: "high", isProcessor: true };
    }
  }

  // Work in uppercase for consistent prefix matching
  let working = description.toUpperCase().trim();

  // Step 3: Strip the first matching rail prefix from the start
  for (const prefix of RAIL_PREFIXES) {
    if (working === prefix) {
      working = "";
      break;
    }
    if (working.startsWith(prefix + " ") || working.startsWith(prefix + ":")) {
      working = working.slice(prefix.length).replace(/^[\s:]+/, "").trim();
      break;
    }
  }

  // Step 4: Strip additional leading noise words (but only if there's still content after)
  {
    const words = working.split(/\s+/);
    let i = 0;
    while (i < words.length - 1 && LEADING_NOISE_WORDS.has(words[i])) {
      i++;
    }
    working = words.slice(i).join(" ").trim();
  }

  // Step 5: Strip tail noise (reference numbers, invoice IDs, dates)
  for (const pattern of TAIL_PATTERNS) {
    working = working.replace(pattern, " ");
  }
  working = working.replace(/\s+/g, " ").trim();

  // Step 6: Remove characters that can't appear in a name (keep letters, digits, &, ', -, .)
  working = working.replace(/[^A-Z0-9\s&'.'\-]/g, " ").replace(/\s+/g, " ").trim();

  // Step 7: Check if what remains is only rail/noise words
  if (working.length === 0) {
    return { name: UNIDENTIFIED_SOURCE, confidence: "unknown", isProcessor: false };
  }

  const words = working.split(/\s+/).filter(w => w.length > 0);
  const meaningfulWords = words.filter(w => !RAIL_ONLY_WORDS.has(w) && w.length >= 2);

  if (meaningfulWords.length === 0) {
    return { name: UNIDENTIFIED_SOURCE, confidence: "unknown", isProcessor: false };
  }

  // Step 8: Title-case the result, cap at 40 chars
  const titleCased = meaningfulWords
    .map(w => w[0] + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 40)
    .trim();

  if (titleCased.length < 2) {
    return { name: UNIDENTIFIED_SOURCE, confidence: "unknown", isProcessor: false };
  }

  // Step 9: Assign confidence
  const hasMultipleWords = meaningfulWords.length >= 2;
  const hasOnlyLetterWords = meaningfulWords.every(w => /^[A-Z&'.'\-]+$/.test(w));
  const isReasonableLength = titleCased.length >= 4 && titleCased.length <= 40;

  let confidence: ClientConfidence;
  if (hasMultipleWords && isReasonableLength) {
    confidence = hasOnlyLetterWords ? "high" : "medium";
  } else if (isReasonableLength) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return { name: titleCased, confidence, isProcessor: false };
}

// ── Alias resolution ──────────────────────────────────────────────────────────
// Strips legal suffixes so "ACME LTD", "ACME LIMITED", "ACME CONSULTING LTD"
// all normalize to the same key and are merged into one canonical identity.

const LEGAL_SUFFIX_RE = /\s+(LTD\.?|LIMITED|LLC\.?|INC\.?|CORP\.?|PLC\.?|PTY\.?|SARL|SAS|S\.A\.S?\.?|S\.A\.?|GMBH|B\.V\.?|BV|NV|AG|AB|OY|AS|CONSULTING|SERVICES|SOLUTIONS|GROUP|HOLDING|HOLDINGS|INTERNATIONAL|INTL)\s*$/i;

export function normalizeForAlias(name: string): string {
  if (name === UNIDENTIFIED_SOURCE) return UNIDENTIFIED_SOURCE;
  return name
    .toUpperCase()
    .replace(LEGAL_SUFFIX_RE, "")
    .replace(LEGAL_SUFFIX_RE, "") // run twice — catches "CONSULTING LTD"
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
