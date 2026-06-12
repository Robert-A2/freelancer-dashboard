import { describe, it, expect } from "vitest";
import { categorizeTransaction } from "../engine";

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
