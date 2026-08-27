import { describe, it, expect } from "vitest";
import { calculateFrenchMicroReserve, type FranceTaxProfileInput } from "../calculate-reserve";

// Adversarial coverage beyond the one bnc_liberal/VAT-exempt/no-ACRE scenario
// the original product audit traced by hand — every other activity type,
// VAT-registered TTC math, and the ACRE reduced-rate path had never been
// verified against a hand-computed expected value before this file.

function profile(overrides: Partial<FranceTaxProfileInput> = {}): FranceTaxProfileInput {
  return {
    businessLegalStatus: "micro_entrepreneur",
    activityType: "bnc_liberal",
    versementLiberatoireStatus: "no",
    acreStatus: "no",
    activityStartDate: null,
    vatStatus: "exempt",
    defaultVatRate: null,
    ...overrides,
  };
}

describe("calculateFrenchMicroReserve — non-bnc_liberal activity types", () => {
  it("cipav_liberal: 4000 HT, VAT-exempt, VFL declined", () => {
    const r = calculateFrenchMicroReserve({
      amount: 4000,
      amountBasis: "HT",
      paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ activityType: "cipav_liberal" }),
    });
    expect(r.status).toBe("calculated");
    expect(r.socialContribution).toEqual({ rate: 0.232, amount: 928 });
    expect(r.cfp).toEqual({ rate: 0.002, amount: 8 });
    expect(r.vfl).toEqual({ rate: 0.022, amount: 0, included: false });
    expect(r.knownMandatoryReserve).toBe(936);
    expect(r.afterKnownStatutoryReserves).toBe(3064);
  });

  it("bic_sales: 10000 TTC, VAT-registered 20%, VFL enabled", () => {
    const r = calculateFrenchMicroReserve({
      amount: 10000,
      amountBasis: "TTC",
      paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ activityType: "bic_sales", versementLiberatoireStatus: "yes", vatStatus: "registered", defaultVatRate: 20 }),
    });
    expect(r.status).toBe("calculated");
    expect(r.revenueHT).toBe(8333.33);
    expect(r.vat).toEqual({ rate: 20, amount: 1666.67 });
    expect(r.socialContribution).toEqual({ rate: 0.123, amount: 1025 });
    expect(r.cfp).toEqual({ rate: 0.001, amount: 8.33 });
    expect(r.vfl).toEqual({ rate: 0.01, amount: 83.33, included: true });
    // 1025 + 8.33 + 83.33 + 1666.67
    expect(r.knownMandatoryReserve).toBe(2783.33);
    expect(r.grossReceived).toBe(10000);
    expect(r.afterKnownStatutoryReserves).toBe(7216.67);
  });

  it("bic_service_artisan and bic_service_commercial share the normal social rate but not CFP", () => {
    const commercial = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ activityType: "bic_service_commercial" }),
    });
    const artisan = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ activityType: "bic_service_artisan" }),
    });
    expect(commercial.socialContribution?.rate).toBe(0.212);
    expect(artisan.socialContribution?.rate).toBe(0.212);
    expect(commercial.cfp?.amount).toBe(1); // 1000 * 0.001
    expect(artisan.cfp?.amount).toBe(3);    // 1000 * 0.003 — genuinely different
  });
});

describe("calculateFrenchMicroReserve — ACRE reduced rate", () => {
  it("applies the post-reform ACRE rate for an activity started after the 2026-07-01 cutover", () => {
    const r = calculateFrenchMicroReserve({
      amount: 4000,
      amountBasis: "HT",
      paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ acreStatus: "yes", activityStartDate: new Date("2026-08-01") }),
    });
    expect(r.acreApplied).toBe(true);
    expect(r.socialContribution).toEqual({ rate: 0.192, amount: 768 });
    // CFP is never affected by ACRE — normal rate still applies.
    expect(r.cfp).toEqual({ rate: 0.002, amount: 8 });
    expect(r.knownMandatoryReserve).toBe(776);
  });

  it("applies the pre-reform ACRE rate for an activity started before the 2026-07-01 cutover", () => {
    const r = calculateFrenchMicroReserve({
      amount: 4000,
      amountBasis: "HT",
      paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ acreStatus: "yes", activityStartDate: new Date("2026-03-01") }),
    });
    expect(r.acreApplied).toBe(true);
    expect(r.socialContribution).toEqual({ rate: 0.128, amount: 512 });
  });

  it("does not apply ACRE once the activity's reduced period has expired", () => {
    // Activity started 2026-01-15 (Q1) -> reduced period covers Q2, Q3, Q4 2026, expires 2026-12-31.
    const r = calculateFrenchMicroReserve({
      amount: 4000,
      amountBasis: "HT",
      paymentDate: new Date("2027-02-01"),
      taxProfile: profile({ acreStatus: "yes", activityStartDate: new Date("2026-01-15") }),
    });
    expect(r.acreApplied).toBe(false);
    expect(r.socialContribution).toEqual({ rate: 0.256, amount: 1024 });
  });

  it("does not apply ACRE when acreStatus is 'unknown', even with a valid start date", () => {
    const r = calculateFrenchMicroReserve({
      amount: 4000,
      amountBasis: "HT",
      paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ acreStatus: "unknown", activityStartDate: new Date("2026-08-01") }),
    });
    expect(r.acreApplied).toBe(false);
    expect(r.socialContribution?.rate).toBe(0.256);
  });
});

describe("calculateFrenchMicroReserve — status gating, never guesses", () => {
  it("returns 'needs-activity-type' for a 'mixed' profile with no per-payment activity given", () => {
    const r = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ activityType: "mixed" }),
      paymentActivityType: null,
    });
    expect(r.status).toBe("needs-activity-type");
    expect(r.socialContribution).toBeNull();
    // VAT can still be computed even when the activity is unknown.
    expect(r.knownMandatoryReserve).toBe(0);
  });

  it("resolves a 'mixed' profile correctly once the per-payment activity is given", () => {
    const r = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ activityType: "mixed" }),
      paymentActivityType: "bic_sales",
    });
    expect(r.status).toBe("calculated");
    expect(r.socialContribution?.rate).toBe(0.123);
  });

  it("returns 'unsupported-status' for a non-micro-entrepreneur legal status, regardless of activity", () => {
    const r = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ businessLegalStatus: "other" }),
    });
    expect(r.status).toBe("unsupported-status");
    expect(r.socialContribution).toBeNull();
  });

  it("flags vatRegisteredRateMissing distinctly from not being VAT-registered at all", () => {
    const registeredNoRate = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ vatStatus: "registered", defaultVatRate: null }),
    });
    expect(registeredNoRate.vat).toBeNull();
    expect(registeredNoRate.vatRegisteredRateMissing).toBe(true);

    const exempt = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ vatStatus: "exempt" }),
    });
    expect(exempt.vat).toBeNull();
    expect(exempt.vatRegisteredRateMissing).toBe(false);
  });

  it("distinguishes a skipped VFL question from an explicit 'no' and an explicit 'unknown'", () => {
    const skipped = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ versementLiberatoireStatus: null }),
    });
    expect(skipped.incomeTaxExcludedReason).toBe("vfl-not-set");

    const declined = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ versementLiberatoireStatus: "no" }),
    });
    expect(declined.incomeTaxExcludedReason).toBe("vfl-not-enabled");

    const unsure = calculateFrenchMicroReserve({
      amount: 1000, amountBasis: "HT", paymentDate: new Date("2026-08-25"),
      taxProfile: profile({ versementLiberatoireStatus: "unknown" }),
    });
    expect(unsure.incomeTaxExcludedReason).toBe("vfl-unknown");
    // "unknown" must not silently add the VFL percentage.
    expect(unsure.vfl?.included).toBe(false);
  });
});
