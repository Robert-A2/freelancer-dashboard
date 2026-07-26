import type { CountryReserveRules, ReserveBucket, UserFinancialProfile, ReserveContext } from "../types";

// ── France — micro-entrepreneur (auto-entrepreneur) regime ─────────────────
// Rates below are the standard, published URSSAF cotisations sociales rates
// for the micro-entrepreneur regime — well-established and stable, but they
// are still reference rates, not tax advice, and can change with official
// updates. Only the "micro_entrepreneur" legal status is implemented; any
// other status (EURL, SASU, régime réel…) has fundamentally different tax
// mechanics this engine doesn't model yet, so it's reported as unavailable
// rather than guessed.

const MICRO_ENTREPRENEUR_RATES: Record<string, number> = {
  bnc_liberal: 24.6,   // Activités libérales (design, dev, consulting, writing…)
  bic_services: 21.2,  // Prestations de services commerciales ou artisanales
  bic_vente: 12.3,     // Vente de marchandises, restauration, hébergement
};

// Franchise en base de TVA — below these annual revenue thresholds, a
// micro-entrepreneur charges no VAT and reserves nothing for it.
const VAT_THRESHOLDS: Record<string, number> = {
  bnc_liberal: 37_500,
  bic_services: 37_500,
  bic_vente: 85_000,
};

export const franceRules: CountryReserveRules = {
  countryCode: "FR",

  isProfileComplete(profile: UserFinancialProfile): boolean {
    return profile.country === "FR" && !!profile.businessLegalStatus && !!profile.activityType;
  },

  computeTaxBuckets(profile: UserFinancialProfile, context: ReserveContext): ReserveBucket[] {
    const buckets: ReserveBucket[] = [];

    if (profile.businessLegalStatus === "micro_entrepreneur" && profile.activityType && MICRO_ENTREPRENEUR_RATES[profile.activityType]) {
      const pct = MICRO_ENTREPRENEUR_RATES[profile.activityType];
      buckets.push({
        key: "socialContributions",
        pct,
        amount: context.totalIncomeAllTime * (pct / 100),
        confidence: "known",
        noteKey: null,
      });
    } else {
      // A registered legal status other than micro-entrepreneur (company
      // structures, régime réel…) has genuinely different mechanics — profit-
      // based corporate tax rather than a flat % of revenue. Not modeled yet.
      buckets.push({ key: "socialContributions", pct: null, amount: 0, confidence: "unavailable", noteKey: "socialContributionsUnsupportedStatus" });
    }

    // Income tax: a micro-entrepreneur's income tax is normally assessed on
    // their annual return against their full household tax bracket — this
    // app has no way to know that bracket. (The optional "versement
    // libératoire" flat-rate scheme is a real alternative, but isn't
    // collected as a profile field yet, so it's never assumed.)
    buckets.push({ key: "incomeTax", pct: null, amount: 0, confidence: "unavailable", noteKey: "incomeTaxVariesByBracket" });

    // VAT: exempt below the franchise threshold for their activity type;
    // above it, or if explicitly registered, the actual rate (5.5%–20% in
    // France depending on goods/services) is too specific to guess.
    if (profile.vatStatus === "registered") {
      buckets.push({ key: "vat", pct: null, amount: 0, confidence: "unavailable", noteKey: "vatRegisteredRateVaries" });
    } else {
      const threshold = profile.activityType ? VAT_THRESHOLDS[profile.activityType] : undefined;
      const overThreshold = threshold != null && context.totalIncomeAllTime > threshold;
      buckets.push(
        overThreshold
          ? { key: "vat", pct: null, amount: 0, confidence: "unavailable", noteKey: "vatOverThreshold" }
          : { key: "vat", pct: 0, amount: 0, confidence: "known", noteKey: "vatBelowThreshold" }
      );
    }

    return buckets;
  },
};
