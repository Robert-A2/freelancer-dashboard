// ── France micro-entrepreneur official rates — the ONE place these numbers
// live (Tax & Contributions spec section 20). Nothing outside this file may
// hard-code a French tax percentage. Rates are versioned by effective date
// so updates never require touching the Dashboard, onboarding, or Settings.
//
// These are the published URSSAF/impots.gouv.fr reference rates for the
// micro-entrepreneur regime — reference figures, not tax advice, and can
// change with official updates.

export type FranceActivityType =
  | "bnc_liberal"
  | "bic_service_commercial"
  | "bic_service_artisan"
  | "bic_sales"
  | "cipav_liberal";

export function isFranceActivityType(value: string | null | undefined): value is FranceActivityType {
  return value === "bnc_liberal" || value === "bic_service_commercial" || value === "bic_service_artisan" || value === "bic_sales" || value === "cipav_liberal";
}

interface NormalRateRow {
  activity: FranceActivityType;
  effectiveFrom: string; // ISO date, inclusive
  socialRate: number; // fraction of turnover HT, e.g. 0.256
  cfpRate: number;
  vflRate: number; // versement libératoire income-tax rate, only applied when the user has opted in
}

// Only one row per activity exists today (2026) — the shape is deliberately
// ready for a second row the day rates next change, without touching any
// caller.
const NORMAL_RATES: NormalRateRow[] = [
  { activity: "bnc_liberal", effectiveFrom: "2026-01-01", socialRate: 0.256, cfpRate: 0.002, vflRate: 0.022 },
  { activity: "bic_service_commercial", effectiveFrom: "2026-01-01", socialRate: 0.212, cfpRate: 0.001, vflRate: 0.017 },
  { activity: "bic_service_artisan", effectiveFrom: "2026-01-01", socialRate: 0.212, cfpRate: 0.003, vflRate: 0.017 },
  { activity: "bic_sales", effectiveFrom: "2026-01-01", socialRate: 0.123, cfpRate: 0.001, vflRate: 0.010 },
  { activity: "cipav_liberal", effectiveFrom: "2026-01-01", socialRate: 0.232, cfpRate: 0.002, vflRate: 0.022 },
];

// ACRE's reduced *social contribution* rate only — CFP and VFL are always
// the normal per-activity rates above, added separately (spec section 9:
// "CFP is still added separately. Versement libératoire is still added
// separately if selected."). Both BIC service categories share one ACRE
// rate even though their normal CFP rates differ.
type AcreGroup = "bnc_liberal" | "bic_service" | "bic_sales" | "cipav_liberal";

function acreGroupFor(activity: FranceActivityType): AcreGroup {
  if (activity === "bic_service_commercial" || activity === "bic_service_artisan") return "bic_service";
  return activity;
}

// The 2026 ACRE reform changed the reduced rate for businesses created from
// 1 July 2026 onward. Which table applies is fixed at activity CREATION —
// not at payment date — since a freelancer's ACRE terms don't retroactively
// change when the law updates after they've already started (spec section 10).
const ACRE_REFORM_CUTOVER = "2026-07-01";

const ACRE_RATES_FROM_JULY_2026: Record<AcreGroup, number> = {
  bic_sales: 0.093,
  bic_service: 0.159,
  bnc_liberal: 0.192,
  cipav_liberal: 0.174,
};

const ACRE_RATES_BEFORE_JULY_2026: Record<AcreGroup, number> = {
  bic_sales: 0.062,
  bic_service: 0.106,
  bnc_liberal: 0.128,
  cipav_liberal: 0.134,
};

function normalRateRow(activity: FranceActivityType, asOf: Date): NormalRateRow {
  // Most recent row with effectiveFrom <= asOf; NORMAL_RATES only has one
  // row per activity today, so this is future-proofing, not dead code.
  const candidates = NORMAL_RATES.filter((r) => r.activity === activity && new Date(r.effectiveFrom) <= asOf)
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
  const row = candidates[0] ?? NORMAL_RATES.find((r) => r.activity === activity)!;
  return row;
}

// ── ACRE expiry (spec section 11) ────────────────────────────────────────
// "ACRE reduced micro rates apply until the end of the third civil quarter
// following the declared activity-start date." Example: activity starts
// 21 September 2026 (Q3 2026) -> the quarters *following* it are Q4 2026,
// Q1 2027, Q2 2027 -> reduced period ends 30 June 2027.
export function getAcreExpiryDate(activityStartDate: Date): Date {
  const startQuarterIndex = Math.floor(activityStartDate.getUTCMonth() / 3); // 0-3
  const startGlobalQuarter = activityStartDate.getUTCFullYear() * 4 + startQuarterIndex;
  const endGlobalQuarter = startGlobalQuarter + 3; // next quarter, plus two more
  const endYear = Math.floor(endGlobalQuarter / 4);
  const endQuarterIndex = endGlobalQuarter % 4; // 0-3
  // Last day of that quarter = day 0 of the month right after it.
  const monthAfterQuarterEnd = endQuarterIndex * 3 + 3; // 0-indexed month right after the quarter
  return new Date(Date.UTC(endYear, monthAfterQuarterEnd, 0));
}

export function isAcreActive(activityStartDate: Date, asOf: Date): boolean {
  return asOf <= getAcreExpiryDate(activityStartDate);
}

export interface ResolvedFranceRates {
  socialRate: number;
  cfpRate: number;
  vflRate: number;
  acreApplied: boolean;
}

// The one place that turns (activity, dates, ACRE eligibility) into the
// three percentages that matter. Everything else — VAT split, the actual
// euro breakdown, labeling — lives in calculateFrenchMicroReserve().
export function resolveFranceRates(params: {
  activity: FranceActivityType;
  paymentDate: Date;
  acreStatus: "yes" | "no" | "unknown" | null;
  activityStartDate: Date | null;
}): ResolvedFranceRates {
  const { activity, paymentDate, acreStatus, activityStartDate } = params;
  const normal = normalRateRow(activity, paymentDate);

  const acreEligible = acreStatus === "yes" && activityStartDate != null && isAcreActive(activityStartDate, paymentDate);
  if (!acreEligible) {
    return { socialRate: normal.socialRate, cfpRate: normal.cfpRate, vflRate: normal.vflRate, acreApplied: false };
  }

  const group = acreGroupFor(activity);
  const table = activityStartDate! >= new Date(ACRE_REFORM_CUTOVER) ? ACRE_RATES_FROM_JULY_2026 : ACRE_RATES_BEFORE_JULY_2026;
  return { socialRate: table[group], cfpRate: normal.cfpRate, vflRate: normal.vflRate, acreApplied: true };
}
