import Papa from "papaparse";
import { categorizeTransaction, type LearnedRules, type Confidence } from "./categorization";

export interface RawRow {
  [key: string]: string;
}

export interface NormalizedTransaction {
  transactionDate: Date;
  description: string;
  amount: number;
  transactionType: "income" | "expense" | "savings" | "transfer";
  category: string;
  categoryConfidence: Confidence;
  categorySource: string;
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
}

// ── BOM removal ───────────────────────────────────────────────────────────────
// Some banks add a BOM (byte order mark) that corrupts the first column name.
function stripBOM(text: string): string {
  return text.startsWith("﻿") ? text.slice(1) : text;
}

// ── Metadata row skipping ─────────────────────────────────────────────────────
// Many banks prepend account info before the actual CSV header, e.g.:
//   Barclays Bank PLC
//   Account: 12345678
//   Date range: 01 Jan 2024 to 31 Jan 2024
//   Date,Description,Amount
function findHeaderRowIndex(lines: string[]): number {
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lower = lines[i].toLowerCase();
    const hasDate    = /\bdate\b|datum\b|fecha\b|data\b/.test(lower);
    const hasAmount  = /amount|debit|credit|betrag|bedrag|importe|money.?in|money.?out|paid.?in|paid.?out|withdrawal|deposit/.test(lower);
    const hasDesc    = /description|details|narrative|payee|merchant|reference|memo|omschrijving|particulars/.test(lower);
    if (hasDate && (hasAmount || hasDesc)) return i;
  }
  return 0;
}

// ── Column detection ──────────────────────────────────────────────────────────
// Finds which CSV columns map to date, description, and signed amount.
function detectColumns(headers: string[]): {
  dateCol: string | null;
  descCol: string | null;
  amountCol: string | null;
} {
  const lower = headers.map((h) => h.toLowerCase().trim());

  const dateCandidates = [
    "date", "transaction date", "trans date", "value date", "booking date",
    "posted date", "post date", "settlement date", "entry date",
    "datum", "fecha", "data", "started date", "completed date",
  ];
  const descCandidates = [
    "description", "details", "narrative", "memo", "payee", "merchant",
    "name", "reference", "particulars", "transaction description",
    "omschrijving", "payment reference", "transaction details",
    "beneficiary name", "remittance info",
  ];
  // Only use as single amount col if NOT also paired with a separate debit col.
  // debit/credit pair detection happens separately and overrides this.
  const amountCandidates = [
    "amount", "transaction amount", "value", "net amount", "local amount",
    "betrag", "importe", "bedrag", "sum",
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

  return {
    dateCol: find(dateCandidates),
    descCol: find(descCandidates),
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
  const lower = headers.map((h) => h.toLowerCase().trim());

  const debitKeywords  = ["debit", "withdrawal", "money out", "paid out", "payments out", "out ", "amount out", "withdrawals"];
  const creditKeywords = ["credit", "deposit", "money in", "paid in", "payments in", "in ",  "amount in", "deposits"];
  const drCrKeywords   = ["d/c", "cr/dr", "dr/cr", "dc", "debit/credit indicator", "credit/debit"];

  const findCol = (keywords: string[]) => {
    for (const kw of keywords) {
      const idx = lower.findIndex((h) => h === kw || h.startsWith(kw) || h.endsWith(kw) || h.includes(kw));
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
export function parseDate(raw: string): Date | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();

  // YYYY-MM-DD (ISO 8601, with optional time component) — keep date part only
  const isoDate = s.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})/);
  if (isoDate) {
    const date = new Date(Date.UTC(+isoDate[1], +isoDate[2] - 1, +isoDate[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  // DD/MM/YYYY  DD-MM-YYYY  DD.MM.YYYY
  // Validates that month field is 1-12 so US-format dates (e.g. "01/13/2023")
  // fall through to the MM/DD/YYYY branch below rather than wrapping.
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, dd, mm, yy] = dmy;
    const year = yy.length === 2 ? 2000 + +yy : +yy;
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
      const date = new Date(Date.UTC(year, +mm - 1, +dd));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // MM/DD/YYYY (US format) — only reached when first field > 12
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, mm, dd, yy] = mdy;
    if (+mm <= 12 && +dd >= 1 && +dd <= 31) {
      const date = new Date(Date.UTC(+yy, +mm - 1, +dd));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // "01 Jan 2024" or "01 January 2024"
  const dmyText = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmyText) {
    const month = MONTH_ABBR[dmyText[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const date = new Date(Date.UTC(+dmyText[3], month, +dmyText[1]));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // "Jan 01, 2024" or "January 01, 2024"
  const mdyText = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyText) {
    const month = MONTH_ABBR[mdyText[1].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const date = new Date(Date.UTC(+mdyText[3], month, +mdyText[2]));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function parseCsv(csvText: string, learnedRules?: LearnedRules, ownerName?: string): ProcessResult {
  // 1. Strip BOM
  const clean = stripBOM(csvText);

  // 2. Split into lines and find where the real header starts
  const allLines = clean.split(/\r?\n/);
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
    return { transactions: [], totalRows: 0, validRows: 0, skippedRows: 0, currencies: [], hasMixedCurrencies: false, parsedEarliest: null, parsedLatest: null };
  }

  const headers = Object.keys(rows[0]);
  const { dateCol, descCol, amountCol } = detectColumns(headers);
  const { debitCol, creditCol, drCrCol } = detectDebitCreditColumns(headers);

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
    const description = (descCol ? row[descCol] ?? "" : "").trim();
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
    const { transactionType, category, confidence, source } = categorizeTransaction(description, amount, learnedRules, ownerName);

    transactions.push({
      transactionDate: date,
      description,
      amount: Math.abs(amount),
      transactionType,
      category,
      categoryConfidence: confidence,
      categorySource: source,
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
  };
}
