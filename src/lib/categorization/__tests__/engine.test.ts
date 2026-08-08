import { describe, it, expect } from "vitest";
import { categorizeTransaction } from "../engine";
import { buildMerchantIndex, buildDecisionIndex } from "../merchant-db";
import type { DbMerchantRow } from "../types";

// ── Findings 1 & 2: positive incoming client payments must never be silently
// classified as transfers, and negative third-party payments must never be
// silently excluded from expenses ───────────────────────────────────────────

describe("categorizeTransaction — ambiguous 'transfer to/from' phrases", () => {
  it("a positive 'TRANSFER FROM <client>' is treated as income, not a transfer", () => {
    const result = categorizeTransaction("TRANSFER FROM ACME CONSULTING LTD", 1500, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("income");
    expect(result.category).not.toBe("transfer");
  });

  it("a positive 'Transfer to <client>' (refund/reversal) is treated as income, not a transfer", () => {
    const result = categorizeTransaction("Transfer to Big Client Co", 250, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("income");
  });

  it("a negative 'Transfer to <third-party vendor>' falls through to expense, not an excluded transfer", () => {
    const result = categorizeTransaction("Transfer to Jane's Bistro Ltd", -100, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("expense");
    expect(result.category).toBe("uncategorized");
  });

  it("a positive 'Transfer from <account owner>' is a genuine self-transfer", () => {
    const result = categorizeTransaction("TRANSFER FROM ROBERT ARTHUR", 300, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });

  it("a positive 'Transfer to <account owner>' is a genuine self-transfer", () => {
    const result = categorizeTransaction("Transfer to Robert Arthur", 300, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });

  it("a self-transfer with a trailing reference number is still recognized", () => {
    const result = categorizeTransaction("Transfer from Robert Arthur Ref 88213764", 300, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });

  it("a client whose name contains the owner's first+last name is income, not a self-transfer", () => {
    const result = categorizeTransaction("TRANSFER FROM PAUL MARTIN CONSULTING LTD", 1200, undefined, "Paul Martin");
    expect(result.transactionType).toBe("income");
    expect(result.category).not.toBe("transfer");
  });
});

describe("categorizeTransaction — unambiguous transfer keywords (unaffected by the transfer-to/from rewrite)", () => {
  it("'internal transfer' is always a transfer, even with a positive amount", () => {
    const result = categorizeTransaction("Internal transfer between accounts", 500, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });

  it("a savings-pot transfer remains classified as savings", () => {
    const result = categorizeTransaction("Transfer to savings account", -200, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("savings");
  });
});

describe("categorizeTransaction — income fallback", () => {
  it("any unrecognized positive amount falls back to income, never uncategorized/transfer", () => {
    const result = categorizeTransaction("Generic Client Payment XYZ123", 750, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("income");
  });
});

// ── Finding 3: diacritic-insensitive matching ─────────────────────────────────

describe("categorizeTransaction — diacritic-insensitive matching", () => {
  it("an accented 'Virement épargne' matches the unaccented savings keyword", () => {
    const result = categorizeTransaction("Virement épargne", -150, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("savings");
  });
});

// ── Finding 4: UK tax authority's full name ───────────────────────────────────

describe("categorizeTransaction — UK tax authority", () => {
  it("'HM Revenue & Customs' (full name) is recognized as a tax payment", () => {
    const result = categorizeTransaction("HM REVENUE & CUSTOMS", -450, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("expense");
    expect(result.category).toBe("taxes");
  });
});

// ── Match-noise stripping: real bank/processor exports glue words together
// with "*" (e.g. Stripe/card-network rendering "Google Ads" as "GOOGLE*ADS")
// — categorizeTransaction() must strip that noise before matching so the
// specific keyword wins instead of a weaker/wrong generic one. Also guards
// the two near-miss regressions a broader normalization (digit-stripping,
// "#" stripping) was found to introduce during design review.

describe("categorizeTransaction — processor-glued punctuation ('*')", () => {
  it("'GOOGLE*ADS' matches the specific 'google ads' -> marketing keyword, not the generic 'google' -> software one", () => {
    const result = categorizeTransaction("GOOGLE*ADS", -50, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("expense");
    expect(result.category).toBe("marketing");
    expect(result.confidence).toBe("high");
  });

  it("a Square-style processor prefix ('SQ *...') still resolves via the keyword in the tail", () => {
    const result = categorizeTransaction("SQ *ACME COFFEE SHOP", -12.5, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("expense");
    expect(result.category).toBe("food");
  });

  it("a seeded DB merchant ('google ads') also matches 'GOOGLE*ADS' via the Decision Engine, not just the static packs", () => {
    const rows: DbMerchantRow[] = [{
      id: "merchant-google-ads",
      keyword: "google ads",
      transactionType: "expense",
      category: "marketing",
      confidence: "high",
      aliases: [],
      popularity: 500,
      country: null,
      parentCompany: null,
      feedback: [{ category: "marketing", agreeCount: 20, disagreeCount: 1 }],
    }];
    const merchantIndex = buildMerchantIndex(rows);
    const decisionIndex = buildDecisionIndex(rows);

    const result = categorizeTransaction("GOOGLE*ADS", -50, undefined, "Robert Arthur", merchantIndex, decisionIndex);
    expect(result.transactionType).toBe("expense");
    expect(result.category).toBe("marketing");
    expect(result.source).toBe("intelligence");
    expect(result.matchedMerchantId).toBe("merchant-google-ads");
  });
});

describe("categorizeTransaction — match-noise stripping does not regress digit/hash-dependent keywords", () => {
  it("'Invoice #1234' still resolves to the specific invoice-payment subcategory, not the generic income fallback", () => {
    const result = categorizeTransaction("Invoice #1234", 800, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("income");
    expect(result.category).toBe("invoice payment");
  });

  it("'SPORT 2000 LEVALLOIS' still resolves via the brand keyword that depends on the literal '2000'", () => {
    const result = categorizeTransaction("SPORT 2000 LEVALLOIS", -45, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("expense");
    expect(result.category).toBe("sports");
    expect(result.confidence).toBe("high");
  });
});
