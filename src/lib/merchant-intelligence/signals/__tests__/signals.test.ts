import { describe, it, expect } from "vitest";
import { identitySignal } from "../identity";
import { popularitySignal } from "../popularity";
import { frequencySignal } from "../frequency";
import { amountPatternSignal } from "../amountPattern";
import { countrySignal } from "../country";
import { parentCompanySignal } from "../parentCompany";
import {
  industrySignal, businessTypeSignal, websiteSignal,
  taxBehaviourSignal, businessFunctionSignal, merchantCategoryCodeSignal,
} from "../dormant";
import type { SignalContext } from "../types";

function ctx(overrides: Partial<SignalContext> = {}): SignalContext {
  return { merchant: null, feedback: [], sameDescriptionCount: 0, amountConsistency: 0, ...overrides };
}

describe("individual signals", () => {
  it("identitySignal is absent with no merchant, tier-based weight otherwise", () => {
    expect(identitySignal(ctx()).present).toBe(false);
    expect(identitySignal(ctx({ merchant: { id: "1", category: "food", confidence: "medium", popularity: 0, country: null, parentCompany: null } })).weight).toBe(65);
  });

  it("popularitySignal is absent at zero popularity, present and log-scaled above it", () => {
    const merchant = { id: "1", category: "food", confidence: "high" as const, popularity: 0, country: null, parentCompany: null };
    expect(popularitySignal(ctx({ merchant })).present).toBe(false);
    const result = popularitySignal(ctx({ merchant: { ...merchant, popularity: 3 } }));
    expect(result.present).toBe(true);
    expect(result.weight).toBeGreaterThan(0);
  });

  it("frequencySignal requires at least 2 prior occurrences", () => {
    const merchant = { id: "1", category: "food", confidence: "high" as const, popularity: 0, country: null, parentCompany: null };
    expect(frequencySignal(ctx({ merchant, sameDescriptionCount: 1 })).present).toBe(false);
    expect(frequencySignal(ctx({ merchant, sameDescriptionCount: 2 })).present).toBe(true);
    expect(frequencySignal(ctx({ merchant, sameDescriptionCount: 999 })).weight).toBeLessThanOrEqual(8);
  });

  it("amountPatternSignal requires positive consistency", () => {
    const merchant = { id: "1", category: "food", confidence: "high" as const, popularity: 0, country: null, parentCompany: null };
    expect(amountPatternSignal(ctx({ merchant, amountConsistency: 0 })).present).toBe(false);
    expect(amountPatternSignal(ctx({ merchant, amountConsistency: 1 })).present).toBe(true);
  });

  it("countrySignal only fires when Merchant.country is set", () => {
    const merchant = { id: "1", category: "food", confidence: "high" as const, popularity: 0, country: null, parentCompany: null };
    expect(countrySignal(ctx({ merchant })).present).toBe(false);
    expect(countrySignal(ctx({ merchant: { ...merchant, country: "FR" } })).present).toBe(true);
  });

  it("parentCompanySignal only fires when Merchant.parentCompany is set (activated Phase 4)", () => {
    const merchant = { id: "1", category: "software", confidence: "high" as const, popularity: 0, country: null, parentCompany: null };
    expect(parentCompanySignal(ctx({ merchant })).present).toBe(false);
    const result = parentCompanySignal(ctx({ merchant: { ...merchant, parentCompany: "Google" } }));
    expect(result.present).toBe(true);
    expect(result.category).toBe("software");
    expect(result.reason).toContain("Google");
  });

  it("all remaining dormant signals are always absent, regardless of input", () => {
    const merchant = { id: "1", category: "food", confidence: "high" as const, popularity: 999, country: "FR", parentCompany: "Google" };
    const populatedCtx = ctx({ merchant, feedback: [{ category: "food", agreeCount: 50, disagreeCount: 0 }], sameDescriptionCount: 50, amountConsistency: 1 });
    for (const signal of [industrySignal, businessTypeSignal, websiteSignal, taxBehaviourSignal, businessFunctionSignal, merchantCategoryCodeSignal]) {
      expect(signal(populatedCtx).present).toBe(false);
      expect(signal(populatedCtx).weight).toBe(0);
    }
  });
});
