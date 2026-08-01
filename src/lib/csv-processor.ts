import Papa from "papaparse";
import { categorizeTransaction, type LearnedRules, type Confidence, type MerchantIndex } from "./categorization";
import { classifyIntent, type FinancialIntent, type UserIntentRules } from "./intent-engine";
import { extractClientName, UNIDENTIFIED_SOURCE } from "./client-identity";

export interface RawRow {
  [key: string]: string;
}

export interface NormalizedTransaction {
  transactionDate:  Date;
  description:      string;
  amount:           number;
  transactionType:  "income" | "expense" | "savings" | "transfer";
  category:         string;
  categoryConfidence: Confidence;
  categorySource:   string;
  /** Set only when categorization matched a DB-backed Merchant entry — see categorizeTransaction()'s matchedMerchantId. */
  merchantId?:      string;
  /** Set only when categorySource === "intelligence" — see categorizeTransaction()'s reason. */
  categoryReason?:  string;
  intent:           FinancialIntent | null;
  intentConfidence: Confidence | null;
  intentSource:     string | null;
  needsReview:      boolean;
}

export interface DetectedAccount {
  name: string;         // raw value from the CSV header line, e.g. "Revolut Business"
  institution?: string; // extracted institution when separable, e.g. "Revolut"
}

export interface ProcessResult {
  transactions: NormalizedTransaction[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
  currencies: string[];          // distinct currency symbols found (e.g. ["€","$"])
  hasMixedCurrencies: boolean;   // true when > 1 distinct currency detected
  parsedEarliest: Date | null;   // earliest transaction date in this file
  parsedLatest: Date | null;     // latest transaction date in this file
  detectedAccount: DetectedAccount | null; // account info extracted from CSV metadata rows
}

// ── BOM removal ───────────────────────────────────────────────────────────────
// Some banks add a BOM (byte order mark) that corrupts the first column name.
function stripBOM(text: string): string {
  return text.startsWith("﻿") ? text.slice(1) : text;
}

// ── Name likelihood check ─────────────────────────────────────────────────────
// Quick pre-filter before running full extraction: does this value look like it
// could contain a person or company name? Rejects pure numbers, IBANs, and
// values that are too short or too long to be a name.
function looksLikeName(val: string): boolean {
  if (!val || val.length < 3 || val.length > 120) return false;
  if (!/[A-Za-z]{2,}/.test(val)) return false;          // must have letters
  if (/^[A-Z0-9]{15,}$/.test(val.toUpperCase())) return false; // IBAN / token
  return true;
}

// ── Diacritic-insensitive lowercase ──────────────────────────────────────────
// Lets accented headers ("Libellé", "Débit", "Crédit", "Montant") match the
// same keyword lists as their unaccented equivalents.
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// ── Account header detection ──────────────────────────────────────────────────
// Many bank exports prepend account metadata before the transaction rows.
// Scan those lines for known patterns and return a best-guess account name.
// Examples from real exports:
//   "Account Name: Revolut Business"          → { name:"Revolut Business", institution:"Revolut" }
//   "Account Number: GB29NWBK60161331926819"  → { name:"GB29NWBK…", institution:undefined }
//   "Account: Current Account"                → { name:"Current Account" }
//   "Bank: BNP Paribas"                       → { name:"BNP Paribas", institution:"BNP Paribas" }

const ACCOUNT_HEADER_PATTERNS: { re: RegExp; isInstitution?: boolean }[] = [
  { re: /^account\s+name\s*[:\-]\s*(.+)/i },
  { re: /^account\s+holder\s*[:\-]\s*(.+)/i },
  { re: /^account\s+title\s*[:\-]\s*(.+)/i },
  { re: /^account\s*[:\-]\s*(.+)/i },
  { re: /^nom\s+du\s+compte\s*[:\-]\s*(.+)/i },          // French
  { re: /^titulaire\s*[:\-]\s*(.+)/i },                    // French account holder
  { re: /^bank\s*[:\-]\s*(.+)/i, isInstitution: true },
  { re: /^banque\s*[:\-]\s*(.+)/i, isInstitution: true },  // French
  { re: /^iban\s*[:\-]\s*([A-Z]{2}\w+)/i },
  { re: /^account\s+number\s*[:\-]\s*(\S+)/i },
  { re: /^sort\s+code\s*[:\-]\s*(\S+)/i },
];

// Well-known institution name prefixes to extract from account names like "Revolut Business"
const INSTITUTION_PREFIXES = [
  "revolut", "monzo", "starling", "wise", "n26", "bunq",
  "barclays", "natwest", "lloyds", "hsbc", "santander", "halifax",
  "bnp", "credit agricole", "societe generale", "lcl", "ing",
  "paypal", "stripe",
];

function detectAccountFromMetadata(lines: string[]): DetectedAccount | null {
  const limit = Math.min(lines.length, 20);
  let name: string | undefined;
  let institution: string | undefined;

  for (let i = 0; i < limit; i++) {
    const line = lines[i].trim();
    for (const { re, isInstitution } of ACCOUNT_HEADER_PATTERNS) {
      const m = line.match(re);
      if (m) {
        const val = m[1].trim().replace(/^["']|["']$/g, ""); // strip quotes
        if (!val) continue;
        if (isInstitution) {
          institution = institution ?? val;
        } else if (!name) {
          name = val;
          // Try to extract institution from names like "Revolut Business" or "BNP Paribas Courant"
          const lower = val.toLowerCase();
          for (const prefix of INSTITUTION_PREFIXES) {
            if (lower.startsWith(prefix)) {
              institution = institution ?? (val.slice(0, prefix.length).trim() ||
                val.split(/\s+/)[0]);
              break;
            }
          }
        }
      }
    }
    if (name && institution) break;
  }

  if (!name) return null;
  return { name, ...(institution ? { institution } : {}) };
}

// ── Metadata row skipping ─────────────────────────────────────────────────────
// Many banks prepend account info before the actual CSV header, e.g.:
//   Barclays Bank PLC
//   Account: 12345678
//   Date range: 01 Jan 2024 to 31 Jan 2024
//   Date,Description,Amount
function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lower = normalize(lines[i]);
    const hasDate    = /\bdate\b|datum\b|fecha\b|data\b/.test(lower);
    const hasAmount  = /amount|montant|debit|credit|betrag|bedrag|importe|money.?in|money.?out|paid.?in|paid.?out|withdrawal|deposit/.test(lower);
    const hasDesc    = /description|details|narrative|payee|merchant|reference|memo|omschrijving|particulars|libelle/.test(lower);
    if (hasDate && (hasAmount || hasDesc)) return i;
  }
  return 0;
}

// ── Column detection ──────────────────────────────────────────────────────────
// Finds which CSV columns map to date, description, payee, and signed amount.
// "payee" is detected separately from "description" because many banks export
// both: description = the payment rail string (e.g. "SEPA CREDIT TRANSFER"),
// payee = the actual sender name (e.g. "NEXO STARTUP SAS").
// When both exist, the payee value is prepended to the description so the
// client identity engine sees the real sender name first.
function detectColumns(headers: string[]): {
  dateCol: string | null;
  descCol: string | null;
  payeeCol: string | null;
  amountCol: string | null;
} {
  const lower = headers.map((h) => normalize(h));

  const dateCandidates = [
    "date", "transaction date", "trans date", "value date", "booking date",
    "posted date", "post date", "settlement date", "entry date",
    "datum", "fecha", "data", "started date", "completed date",
  ];
  // Payee candidates — these columns contain the actual counterparty name.
  // Must be detected BEFORE descCandidates so we don't accidentally merge them.
  const payeeCandidates = [
    "payee", "payee name", "beneficiary", "beneficiary name",
    "counterpart", "counterparty", "counterparty name",
    "third party", "third party name",
    "creditor name", "debtor name",
    "nom beneficiaire", "libelle beneficiaire", "tiers",
  ];
  const descCandidates = [
    "description", "details", "narrative", "narration", "memo", "merchant",
    "reference", "particulars", "transaction description",
    "omschrijving", "payment reference", "transaction details",
    "remittance info", "libelle", "remarks",
    // "name" and "payee" are intentionally absent here — they go to payeeCandidates
  ];
  // Only use as single amount col if NOT also paired with a separate debit col.
  // debit/credit pair detection happens separately and overrides this.
  const amountCandidates = [
    "amount", "transaction amount", "value", "net amount", "local amount",
    "betrag", "importe", "bedrag", "sum", "montant",
  ];

  const find = (candidates: string[]) => {
    for (const c of candidates) {
      const exact = lower.indexOf(c);
      if (exact !== -1) return headers[exact];
      const partial = lower.findIndex((h) => h.includes(c));
      if (partial !== -1) return headers[partial];
    }
    return null;
  };

  const payeeCol = find(payeeCandidates);
  // For descCol, exclude the column already claimed by payeeCol
  const descColHeaders = headers.filter((h) => h !== payeeCol);
  const descColLower   = descColHeaders.map((h) => normalize(h));
  const findInDesc = (candidates: string[]) => {
    for (const c of candidates) {
      const exact = descColLower.indexOf(c);
      if (exact !== -1) return descColHeaders[exact];
      const partial = descColLower.findIndex((h) => h.includes(c));
      if (partial !== -1) return descColHeaders[partial];
    }
    return null;
  };

  return {
    dateCol:   find(dateCandidates),
    descCol:   findInDesc(descCandidates),
    payeeCol,
    amountCol: find(amountCandidates),
  };
}

// ── Separate debit/credit column detection ─────────────────────────────────────
// Handles banks that use two always-positive columns instead of one signed amount:
// NatWest, AIB, Bank of Ireland, Ulster Bank, Lloyds, Santander, Monzo, etc.
function detectDebitCreditColumns(headers: string[]): {
  debitCol: string | null;
  creditCol: string | null;
  drCrCol: string | null;   // indicator column: "D"/"C" or "Dr"/"Cr" etc.
} {
  const lower = headers.map((h) => normalize(h));

  const debitKeywords  = ["debit", "withdrawal", "money out", "paid out", "payments out", "out ", "amount out", "withdrawals", "dr"];
  const creditKeywords = ["credit", "deposit", "money in", "paid in", "payments in", "in ",  "amount in", "deposits", "cr"];
  const drCrKeywords   = ["d/c", "cr/dr", "dr/cr", "dc", "debit/credit indicator", "credit/debit"];

  // Short keywords (≤2 chars like "dr", "cr") use exact-match only to prevent false
  // positives — e.g. "dr" as substring would match "address", "credit", "description".
  const findCol = (keywords: string[]) => {
    for (const kw of keywords) {
      const idx = kw.length <= 2
        ? lower.findIndex((h) => h === kw)
        : lower.findIndex((h) => h === kw || h.startsWith(kw) || h.endsWith(kw) || h.includes(kw));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  const debitCol  = findCol(debitKeywords);
  const creditCol = findCol(creditKeywords);

  // Only count as a pair when both sides are distinct columns
  if (debitCol && creditCol && debitCol === creditCol) {
    return { debitCol: null, creditCol: null, drCrCol: null };
  }

  return {
    debitCol,
    creditCol,
    drCrCol: findCol(drCrKeywords),
  };
}

// ── Amount parsing ────────────────────────────────────────────────────────────
// Handles every amount format seen in real bank exports:
//   •  1,234.56      (US/UK — comma thousands, period decimal)
//   •  1.234,56      (European — period thousands, comma decimal)
//   •  1 234,56      (French — space thousands, comma decimal)
//   •  (1,234.56)    (accounting negative — parentheses)
//   •  1,234.56-     (trailing minus)
//   •  1,234.56 Dr   (debit suffix — negative)
//   •  1,234.56 Cr   (credit suffix — positive)
//   •  -€1,234.56    (leading currency symbol + minus)
//   •  £1,234.56     (leading currency symbol, positive)
function parseRawAmount(raw: string): number {
  if (!raw?.trim()) return 0;

  let s = raw.trim();
  let sign = 1;

  // 1. Parentheses: (1,234.56) → negative
  if (s.startsWith("(") && s.endsWith(")")) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }

  // 2. Explicit leading minus (after stripping any currency symbol)
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }

  // 3. Currency symbols (strip, don't affect sign)
  s = s.replace(/[€£$¥₹₩]/g, "").trim();

  // 4. Trailing minus: "1,234.56-"
  if (s.endsWith("-")) {
    sign = -1;
    s = s.slice(0, -1).trim();
  }

  // 5. Dr/Cr suffixes (case-insensitive)
  if (/\s*dr\.?$/i.test(s)) {
    sign = -1;
    s = s.replace(/\s*dr\.?$/i, "").trim();
  } else if (/\s*cr\.?$/i.test(s)) {
    // Cr = credit = positive (sign stays 1, but override any earlier minus)
    sign = Math.abs(sign);
    s = s.replace(/\s*cr\.?$/i, "").trim();
  }

  // 6. Dr/Cr prefixes
  if (/^dr\.?\s*/i.test(s)) {
    sign = -1;
    s = s.replace(/^dr\.?\s*/i, "").trim();
  } else if (/^cr\.?\s*/i.test(s)) {
    sign = Math.abs(sign);
    s = s.replace(/^cr\.?\s*/i, "").trim();
  }

  // 7. Remove spaces (French thousands separator: "1 234,56")
  s = s.replace(/\s/g, "");

  // 8. Determine decimal convention:
  //    If the string ends with comma + 1 or 2 digits → European decimal comma
  //    e.g. "1.234,56" or "234,5" or "1.234,00"
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // US/UK: comma is thousands separator
    s = s.replace(/,/g, "");
  }

  const num = parseFloat(s);
  if (isNaN(num) || num === 0) return 0;
  return sign * num;
}

// ── Month name → 0-indexed map ────────────────────────────────────────────────
const MONTH_ABBR: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// ── Date parsing ──────────────────────────────────────────────────────────────
// ALL formats produce a UTC-midnight Date so month/year extraction is
// timezone-independent everywhere downstream (getUTCMonth, getUTCFullYear).
//
// End-of-string anchors ($) are intentionally omitted from numeric patterns so
// dates with trailing time components (e.g. "15/01/2024 09:14:38") parse correctly.
export function parseDate(raw: string): Date | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();

  // YYYY-MM-DD or YYYY/MM/DD (ISO 8601, with optional time component)
  // Accepts 1-2 digit month/day to handle banks that omit zero-padding ("2024/1/5").
  const isoDate = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoDate) {
    const date = new Date(Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY  (with optional time suffix, 2 or 4-digit year)
  // Validates month 1-12 so US-format dates (e.g. "01/13/2023") fall through to mdy.
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const year = yy.length === 2 ? 2000 + +yy : +yy;
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
      const date = new Date(Date.UTC(year, +mm - 1, +dd));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // MM/DD/YYYY (US format) — only reached when month field > 12 (with optional time suffix)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const [, mm, dd, yy] = mdy;
    if (+mm <= 12 && +dd >= 1 && +dd <= 31) {
      const date = new Date(Date.UTC(+yy, +mm - 1, +dd));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // "01 Jan 2024", "01-Jan-2024", "01 January 2024" (with optional time suffix, 2 or 4-digit year)
  const dmyText = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]+)[\s\-]+(\d{2,4})/);
  if (dmyText) {
    const month = MONTH_ABBR[dmyText[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const yy = dmyText[3];
      const year = yy.length === 2 ? 2000 + +yy : +yy;
      const date = new Date(Date.UTC(year, month, +dmyText[1]));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // "Jan 01, 2024", "January 01, 2024", "Jan-01-2024" (with optional time suffix, 2 or 4-digit year)
  const mdyText = s.match(/^([A-Za-z]+)[\s\-]+(\d{1,2}),?[\s\-]+(\d{2,4})/);
  if (mdyText) {
    const month = MONTH_ABBR[mdyText[1].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const yy = mdyText[3];
      const year = yy.length === 2 ? 2000 + +yy : +yy;
      const date = new Date(Date.UTC(year, month, +mdyText[2]));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseCsv(
  csvText: string,
  learnedRules?: LearnedRules,
  ownerName?: string,
  merchantIndex?: MerchantIndex,
  userIntentRules?: UserIntentRules,
): ProcessResult {
  // 1. Strip BOM
  const clean = stripBOM(csvText);

  // 2. Split into lines, detect account metadata, find where the real header starts
  const allLines = clean.split(/\r?\n/);
  const detectedAccount = detectAccountFromMetadata(allLines);
  const headerIdx = findHeaderRowIndex(allLines);
  const csvFromHeader = allLines.slice(headerIdx).join("\n");

  // 3. Parse — PapaParse auto-detects delimiter (comma, semicolon, tab)
  const result = Papa.parse<RawRow>(csvFromHeader, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const rows = (result as Papa.ParseResult<RawRow>).data;
  if (!rows.length) {
    return { transactions: [], totalRows: 0, validRows: 0, skippedRows: 0, currencies: [], hasMixedCurrencies: false, parsedEarliest: null, parsedLatest: null, detectedAccount };
  }

  const headers = Object.keys(rows[0]);
  const { dateCol, descCol, payeeCol, amountCol } = detectColumns(headers);
  const { debitCol, creditCol, drCrCol } = detectDebitCreditColumns(headers);

  // All columns that are not structural (date / amount / debit / credit).
  // We'll scan these for a client name when the primary description column
  // doesn't yield one — so the app works regardless of column naming conventions.
  const reservedCols = new Set(
    [dateCol, amountCol, debitCol, creditCol, drCrCol].filter(Boolean) as string[]
  );
  const scanCols = headers.filter(h => !reservedCols.has(h));

  // Use separate debit/credit pair when both sides are detected
  const useDebitCreditPair = !!(debitCol && creditCol);

  const transactions: NormalizedTransaction[] = [];
  const currencySymbols = new Set<string>();
  let skippedRows = 0;

  for (const row of rows) {
    // Scan for currency symbols in the raw amount string before parsing
    const rawForCurrencyScan = [
      amountCol   ? row[amountCol]   : "",
      creditCol   ? row[creditCol!]  : "",
      debitCol    ? row[debitCol!]   : "",
    ].join(" ");
    const found = rawForCurrencyScan.match(/[€£$¥₹₩]/g);
    if (found) found.forEach((c) => currencySymbols.add(c));
    // ── Date ────────────────────────────────────────────────────────────────
    const rawDate = dateCol ? row[dateCol] ?? "" : "";
    const date    = parseDate(rawDate);
    if (!date) { skippedRows++; continue; }

    // ── Description ─────────────────────────────────────────────────────────
    const rawDesc    = (descCol  ? row[descCol]  ?? "" : "").trim();
    const payeeValue = (payeeCol ? row[payeeCol] ?? "" : "").trim();

    // Multi-column name scan: try every non-reserved column to find the
    // highest-confidence client name — regardless of what the column is called.
    // This makes the parser work with any bank CSV format, not just ones that
    // use the column names we know about.
    const CONF_RANK: Record<string, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
    let bestNameValue = payeeValue; // payeeCol already wins if it exists
    let bestRank = payeeValue ? CONF_RANK[extractClientName(payeeValue, "income").confidence] : -1;

    if (bestRank < 3) { // only scan further if we don't already have a "high" result
      for (const col of scanCols) {
        if (col === descCol || col === payeeCol) continue; // already handled
        const val = (row[col] ?? "").trim();
        if (!looksLikeName(val)) continue;
        const result = extractClientName(val, "income");
        const rank = CONF_RANK[result.confidence] ?? 0;
        if (rank > bestRank && result.name !== UNIDENTIFIED_SOURCE) {
          bestRank = rank;
          bestNameValue = val;
          if (rank === 3) break; // high confidence — no need to keep searching
        }
      }
    }

    // Build the stored description: prepend the best name value so the identity
    // engine sees the sender name before any payment-rail noise.
    const description = bestNameValue && bestNameValue !== rawDesc
      ? `${bestNameValue} ${rawDesc}`.trim()
      : rawDesc;
    if (!description) { skippedRows++; continue; }

    // ── Amount ──────────────────────────────────────────────────────────────
    let amount: number;

    if (useDebitCreditPair) {
      // Separate debit/credit columns (NatWest, AIB, Lloyds, Monzo, etc.)
      const credit = parseRawAmount(row[creditCol!] ?? "");
      const debit  = parseRawAmount(row[debitCol!]  ?? "");
      if (credit > 0)     amount = credit;   // money in
      else if (debit > 0) amount = -debit;   // money out
      else { skippedRows++; continue; }      // both zero — skip

    } else if (amountCol && drCrCol) {
      // Single amount column + separate D/C indicator column
      const raw = parseRawAmount(row[amountCol] ?? "");
      const indicator = (row[drCrCol] ?? "").toLowerCase().trim();
      if (indicator.startsWith("d") || indicator === "out" || indicator === "withdrawal" || indicator === "debit") {
        amount = -Math.abs(raw);
      } else if (indicator.startsWith("c") || indicator === "in" || indicator === "deposit" || indicator === "credit") {
        amount = Math.abs(raw);
      } else {
        // Unrecognized indicator value (e.g. "CARD_PAYMENT", "TOPUP") — trust the
        // original signed amount rather than forcing it positive.
        amount = raw;
      }
      if (amount === 0) { skippedRows++; continue; }

    } else if (amountCol) {
      // Standard single signed amount column
      amount = parseRawAmount(row[amountCol] ?? "");
      if (amount === 0) { skippedRows++; continue; }

    } else {
      // No amount column found at all
      skippedRows++;
      continue;
    }

    // ── Categorize ──────────────────────────────────────────────────────────
    const catResult = categorizeTransaction(description, amount, learnedRules, ownerName, merchantIndex);
    const { transactionType, category, confidence, source, matchedMerchantId, reason } = catResult;

    // ── Classify intent ─────────────────────────────────────────────────────
    const { intent, intentConfidence, intentSource, needsReview } =
      classifyIntent(description, catResult, userIntentRules);

    transactions.push({
      transactionDate:  date,
      description,
      amount:           Math.abs(amount),
      transactionType,
      category,
      categoryConfidence: confidence,
      categorySource:   source,
      merchantId:       matchedMerchantId,
      categoryReason:   reason,
      intent,
      intentConfidence,
      intentSource,
      needsReview,
    });
  }

  const currencies = Array.from(currencySymbols);

  // Compute actual date range from parsed transactions
  let parsedEarliest: Date | null = null;
  let parsedLatest: Date | null = null;
  if (transactions.length > 0) {
    const timestamps = transactions.map(t => t.transactionDate.getTime());
    parsedEarliest = new Date(Math.min(...timestamps));
    parsedLatest   = new Date(Math.max(...timestamps));
    console.log(
      `[CSV Parser] ${transactions.length} transactions parsed, ${skippedRows} skipped — ` +
      `range: ${parsedEarliest.toISOString().slice(0, 10)} to ${parsedLatest.toISOString().slice(0, 10)}`
    );
  }

  return {
    transactions,
    totalRows: rows.length,
    validRows: transactions.length,
    skippedRows,
    currencies,
    hasMixedCurrencies: currencies.length > 1,
    parsedEarliest,
    parsedLatest,
    detectedAccount,
  };
}
