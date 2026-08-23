import { calculateFrenchMicroReserve } from "./tax/france/calculate-reserve";

// ── Landing page "financial position" calculator ────────────────────────────
// Anonymous visitors answer 5 quick questions (no signup, nothing ever
// persisted) and get an immediate estimate shaped exactly like the real
// product's Money Breakdown: protected total, available-after-protections,
// and runway with/without the expected payment. This reuses the ONE real
// France micro-entrepreneur tax formula (calculateFrenchMicroReserve, a pure
// function with no server/DB dependency) rather than inventing a second tax
// calculation — the only thing that's simplified is the ASSUMPTIONS behind
// it (a default micro-entrepreneur/BNC profile, no VAT/ACRE/versement
// libératoire, a flat 1-month safety buffer), since a 5-question teaser
// can't collect the visitor's full tax profile. Every result is labeled as
// an estimate for exactly this reason.

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
  safetyBuffer: number;
  safetyBufferMonths: number;
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

const DEFAULT_SAFETY_BUFFER_MONTHS = 1;

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
  const safetyBuffer = DEFAULT_SAFETY_BUFFER_MONTHS * monthlySpend;

  const protectedTotal = taxReserve + upcomingCommitments + safetyBuffer;
  const availableAfterProtections = currentCash - protectedTotal;

  const runwayMonths = monthlySpend > 0 ? currentCash / monthlySpend : null;
  const runwayWithPaymentMonths = monthlySpend > 0 ? (currentCash + upcomingPayment) / monthlySpend : null;

  return {
    currentCash,
    taxReserve,
    taxReserveRatePct,
    upcomingCommitments,
    safetyBuffer,
    safetyBufferMonths: DEFAULT_SAFETY_BUFFER_MONTHS,
    protectedTotal,
    availableAfterProtections,
    monthlySpend,
    runwayMonths,
    runwayWithPaymentMonths,
  };
}
