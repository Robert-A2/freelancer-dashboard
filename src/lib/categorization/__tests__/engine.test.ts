import { describe, it, expect } from "vitest";
import { categorizeTransaction } from "../engine";

// ── Finding 1: positive incoming client payments must never be silently
// classified as transfers ───────────────────────────────────────────────────

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

  it("a negative 'Transfer to <payee>' is still a transfer (money leaving the account)", () => {
    const result = categorizeTransaction("Transfer to Jane's Bistro Ltd", -100, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });

  it("a positive 'Transfer from <account owner>' is a genuine self-transfer", () => {
    const result = categorizeTransaction("TRANSFER FROM ROBERT ARTHUR", 300, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });

  it("a positive 'Transfer to <account owner>' is a genuine self-transfer", () => {
    const result = categorizeTransaction("Transfer to Robert Arthur", 300, undefined, "Robert Arthur");
    expect(result.transactionType).toBe("transfer");
  });
});

describe("categorizeTransaction — unambiguous transfer keywords (unaffected by Finding 1 fix)", () => {
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
