import { calculateFrenchMicroReserve } from "./tax/france/calculate-reserve";

// ── Landing page "financial position" calculator ────────────────────────────
// Anonymous visitors answer 5 quick questions (no signup, nothing ever
// persisted) and get an immediate estimate shaped exactly like the real
// product's Money Breakdown: protected total, available-after-protections,
// and runway with/without the expected payment. This reuses the ONE real
// France micro-entrepreneur tax formula (calculateFrenchMicroReserve, a pure
// function with no server/DB dependency) rather than inventing a second tax
// calculation.
//
// Nothing here is ever assumed or defaulted on the visitor's behalf — every
// figure below is either a number they typed, or a real derivation of one.
// The only simplification is which tax PROFILE the formula assumes (a
// default micro-entrepreneur/BNC status, no VAT/ACRE/versement libératoire),
// since a 5-question teaser can't collect the visitor's full tax profile the
// way onboarding does — that's clearly labeled as an estimate in the UI. A
// safety buffer is deliberately NOT included here: the real product only
// ever shows one because the user explicitly configured a number of months
// in Settings, and this teaser never asks that question — inventing a
// default for it would be exactly the kind of silent assumption the rest of
// this product refuses to make.

export interface LandingCalculatorInput {
  currentCash: number;
  monthlyBusinessCost: number;
  personalMonthlyNeed: number;
  upcomingPayment: number;
}

export interface LandingCalculatorResult {
  currentCash: number;
  taxReserve: number;
  taxReserveRatePct: number;
  upcomingCommitments: number;
  protectedTotal: number;
  availableAfterProtections: number;
  monthlySpend: number;
  runwayMonths: number | null;
  runwayWithPaymentMonths: number | null;
}

// Default assumptions used only because the landing page can't ask the full
// onboarding tax profile — same shape the real product uses once a user
// actually configures theirs (src/lib/tax/france/calculate-reserve.ts).
const DEFAULT_TAX_PROFILE = {
  businessLegalStatus: "micro_entrepreneur",
  activityType: "bnc_liberal",
  versementLiberatoireStatus: null,
  acreStatus: null,
  activityStartDate: null,
  vatStatus: null,
  defaultVatRate: null,
} as const;

export function calculateLandingFinancialPosition(input: LandingCalculatorInput): LandingCalculatorResult {
  const { currentCash, monthlyBusinessCost, personalMonthlyNeed, upcomingPayment } = input;

  const taxResult = calculateFrenchMicroReserve({
    amount: upcomingPayment,
    amountBasis: "HT",
    paymentDate: new Date(),
    taxProfile: DEFAULT_TAX_PROFILE,
  });
  const taxReserve = taxResult.status === "calculated" ? taxResult.knownMandatoryReserve : 0;
  const taxReserveRatePct = upcomingPayment > 0 ? (taxReserve / upcomingPayment) * 100 : 0;

  const monthlySpend = monthlyBusinessCost + personalMonthlyNeed;
  const upcomingCommitments = monthlyBusinessCost;

  const protectedTotal = taxReserve + upcomingCommitments;
  const availableAfterProtections = currentCash - protectedTotal;

  const runwayMonths = monthlySpend > 0 ? currentCash / monthlySpend : null;
  const runwayWithPaymentMonths = monthlySpend > 0 ? (currentCash + upcomingPayment) / monthlySpend : null;

  return {
    currentCash,
    taxReserve,
    taxReserveRatePct,
    upcomingCommitments,
    protectedTotal,
    availableAfterProtections,
    monthlySpend,
    runwayMonths,
    runwayWithPaymentMonths,
  };
}
