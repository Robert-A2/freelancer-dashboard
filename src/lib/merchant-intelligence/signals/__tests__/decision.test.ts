import { describe, it, expect } from "vitest";
import { computeDecisionScore } from "../index";
import type { SignalContext } from "../types";

function baseCtx(overrides: Partial<SignalContext> = {}): SignalContext {
  return {
    merchant: null,
    feedback: [],
    sameDescriptionCount: 0,
    amountConsistency: 0,
    ...overrides,
  };
}

describe("computeDecisionScore", () => {
  it("returns null when no merchant identity is present", () => {
    expect(computeDecisionScore(baseCtx())).toBeNull();
  });

  it("produces a high-tier decision for a popular, high-confidence, high-agreement merchant", () => {
    const result = computeDecisionScore(baseCtx({
      merchant: { id: "m1", category: "software", confidence: "high", popularity: 500, country: null, parentCompany: null },
      feedback: [{ category: "software", agreeCount: 20, disagreeCount: 1 }],
    }));
    expect(result).not.toBeNull();
    expect(result!.category).toBe("software");
    expect(result!.tier).toBe("high");
    expect(result!.confidence).toBeGreaterThanOrEqual(80);
    expect(result!.signalsUsed).toContain("identity");
    expect(result!.signalsUsed).toContain("popularity");
    expect(result!.signalsUsed).toContain("globalAgreement");
  });

  it("produces a low-tier decision for a brand-new, unpopular, unconfirmed merchant", () => {
    const result = computeDecisionScore(baseCtx({
      merchant: { id: "m2", category: "uncategorized", confidence: "low", popularity: 0, country: null, parentCompany: null },
    }));
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("low");
    expect(result!.signalsUsed).toEqual(["identity"]); // only the base signal fires
  });

  it("lets globalAgreement override the merchant's recorded category when disagreement is strong enough", () => {
    const result = computeDecisionScore(baseCtx({
      merchant: { id: "m3", category: "uncategorized", confidence: "low", popularity: 0, country: null, parentCompany: null },
      feedback: [
        { category: "uncategorized", agreeCount: 0, disagreeCount: 10 },
        { category: "business_expense", agreeCount: 10, disagreeCount: 0 },
      ],
    }));
    expect(result).not.toBeNull();
    // "business_expense" wins its own bucket (agreement +15) even though
    // "uncategorized" also gets the base identity weight — this proves
    // competing categories are scored independently, not just summed together.
    expect(result!.category).toBe("business_expense");
  });

  it("recognizes a brand-new merchant after just 2 clean corrections — regression test for a real bug found via end-to-end verification: a merchant's recorded category starts as \"uncategorized\" and is NEVER updated by the correction flow (only MerchantFeedback is), so without special-casing it, identity+popularity for the stale default permanently outweighed a couple of real corrections that needed 20+ data points under the general override formula", () => {
    const result = computeDecisionScore(baseCtx({
      merchant: { id: "m6", category: "uncategorized", confidence: "low", popularity: 30, country: null, parentCompany: null },
      feedback: [{ category: "office_supplies", agreeCount: 2, disagreeCount: 0 }],
    }));
    expect(result).not.toBeNull();
    expect(result!.category).toBe("office_supplies");
    expect(result!.tier === "medium" || result!.tier === "high").toBe(true);
  });

  it("ignores feedback with fewer than 2 total data points (gated, matches computeMerchantConfidence)", () => {
    const result = computeDecisionScore(baseCtx({
      merchant: { id: "m4", category: "food", confidence: "medium", popularity: 0, country: null, parentCompany: null },
      feedback: [{ category: "food", agreeCount: 1, disagreeCount: 0 }],
    }));
    expect(result!.signalsUsed).not.toContain("globalAgreement");
  });

  it("caps confidence at 100 even when signals overlap heavily", () => {
    const result = computeDecisionScore(baseCtx({
      merchant: { id: "m5", category: "software", confidence: "high", popularity: 1_000_000, country: "FR", parentCompany: "Google" },
      feedback: [{ category: "software", agreeCount: 100, disagreeCount: 0 }],
      sameDescriptionCount: 50,
      amountConsistency: 1,
    }));
    expect(result!.confidence).toBeLessThanOrEqual(100);
  });
});
