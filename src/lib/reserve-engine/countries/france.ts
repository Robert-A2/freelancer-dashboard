import type { CountryReserveRules, ReserveBucket, UserFinancialProfile, ReserveContext } from "../types";
import { calculateFrenchMicroReserve, type FranceTaxProfileInput } from "../../tax/france/calculate-reserve";

// ── France — micro-entrepreneur (auto-entrepreneur) regime ─────────────────
// This is a thin adapter over calculateFrenchMicroReserve() (spec section 21)
// — the ONE France calculation function, also used directly for per-payment
// breakdowns (Quick Add income, Expected Payment). This file only turns its
// output into the generic ReserveBucket[] shape the Settings/Dashboard
// aggregate reserve card already knows how to render. No rates live here.

function toTaxProfileInput(profile: UserFinancialProfile): FranceTaxProfileInput {
  return {
    businessLegalStatus: profile.businessLegalStatus,
    activityType: profile.activityType,
    versementLiberatoireStatus: profile.versementLiberatoireStatus ?? null,
    acreStatus: profile.acreStatus ?? null,
    activityStartDate: profile.activityStartDate ?? null,
    vatStatus: profile.vatStatus,
    defaultVatRate: profile.defaultVatRate ?? null,
  };
}

export const franceRules: CountryReserveRules = {
  countryCode: "FR",

  // "Complete" means Nonodia can show a real calculated answer, not a
  // fabricated one — matches calculateFrenchMicroReserve()'s own gating so
  // this can never disagree with the actual calculation (spec section 31).
  isProfileComplete(profile: UserFinancialProfile): boolean {
    const result = calculateFrenchMicroReserve({
      amount: 1,
      amountBasis: "HT",
      paymentDate: new Date(),
      taxProfile: toTaxProfileInput(profile),
    });
    return result.status === "calculated";
  },

  computeTaxBuckets(profile: UserFinancialProfile, context: ReserveContext): ReserveBucket[] {
    // Aggregate view uses this month's income as the representative payment
    // — transactions in this app aren't recorded with a separate VAT split,
    // so "HT" is the correct basis for the amounts already on file.
    const result = calculateFrenchMicroReserve({
      amount: context.incomeThisMonth,
      amountBasis: "HT",
      paymentDate: new Date(),
      taxProfile: toTaxProfileInput(profile),
    });

    const buckets: ReserveBucket[] = [];

    if (result.status === "unsupported-status") {
      buckets.push({ key: "socialContributions", pct: null, amount: 0, confidence: "unavailable", noteKey: "socialContributionsUnsupportedStatus" });
      return buckets;
    }
    if (result.status === "needs-activity-type") {
      buckets.push({ key: "socialContributions", pct: null, amount: 0, confidence: "unavailable", noteKey: "needsActivityType" });
      return buckets;
    }

    buckets.push({
      key: "socialContributions",
      pct: round1(result.socialContribution!.rate * 100),
      amount: result.socialContribution!.amount,
      confidence: "known",
      noteKey: result.acreApplied ? "acreApplied" : null,
    });

    buckets.push({
      key: "cfp",
      pct: round1(result.cfp!.rate * 100),
      amount: result.cfp!.amount,
      confidence: "known",
      noteKey: null,
    });

    // Income tax: only ever shown as a real number when versement
    // libératoire is actually enabled — otherwise explicitly "not included",
    // never a generic income-tax guess (spec sections 7, 23, 34). Three
    // distinct reasons, never collapsed into one: explicitly declined,
    // explicitly unsure, or never answered at all.
    if (result.vfl!.included) {
      buckets.push({ key: "incomeTax", pct: round1(result.vfl!.rate * 100), amount: result.vfl!.amount, confidence: "known", noteKey: "versementLiberatoire" });
    } else {
      const noteKey =
        result.incomeTaxExcludedReason === "vfl-unknown" ? "incomeTaxVflUnknown" :
        result.incomeTaxExcludedReason === "vfl-not-set" ? "incomeTaxVflNotSet" :
        "incomeTaxVariesByBracket";
      buckets.push({ key: "incomeTax", pct: null, amount: 0, confidence: "unavailable", noteKey });
    }

    // vatRegisteredRateMissing comes straight from the one calculation
    // above rather than re-deriving "registered but no rate" here — the
    // Settings card and the per-payment breakdown must never disagree
    // about whether a rate is actually missing.
    if (result.vat) {
      buckets.push({ key: "vat", pct: result.vat.rate, amount: result.vat.amount, confidence: "known", noteKey: "vatCollectedNote" });
    } else if (result.vatRegisteredRateMissing) {
      buckets.push({ key: "vat", pct: null, amount: 0, confidence: "unavailable", noteKey: "vatRateMissing" });
    } else {
      buckets.push({ key: "vat", pct: 0, amount: 0, confidence: "known", noteKey: "vatBelowThreshold" });
    }

    return buckets;
  },
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
