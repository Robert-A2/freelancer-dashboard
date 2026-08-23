import { isFranceActivityType, resolveFranceRates, type FranceActivityType } from "./micro-rates";

// ── calculateFrenchMicroReserve() — the ONE France tax calculation function
// (Tax & Contributions spec section 21). Every surface that needs to know
// "how much of this payment is protected" — received income, an expected
// payment's scenario, the Dashboard's Money Breakdown card — calls this and
// renders its output. Nothing recalculates independently.
//
// Solves exactly: "A client just paid me. How much of this should I treat
// as protected, and how much is actually available?" Never invents a rate:
// every excluded line says why (unsupported legal status, activity not
// identified, versement libératoire not enabled, ...).

export type FranceReserveStatus = "calculated" | "unsupported-status" | "needs-activity-type";

export interface FranceRatePart {
  rate: number; // fraction, e.g. 0.256
  amount: number;
}

export interface FranceMicroReserveResult {
  status: FranceReserveStatus;
  grossReceived: number;
  amountBasis: "HT" | "TTC";
  revenueHT: number;
  vat: FranceRatePart | null; // null when not VAT-registered for this payment, OR registered with no rate set yet — see vatRegisteredRateMissing to tell those two apart
  /** True when the user said they're VAT-registered but never set a rate (Settings or a per-payment override) — `vat` is null in this case too, but for a DIFFERENT reason than genuinely not being registered, and callers must say so rather than silently omitting VAT. */
  vatRegisteredRateMissing: boolean;
  socialContribution: FranceRatePart | null; // null unless status === "calculated"
  cfp: FranceRatePart | null;
  /** null when VFL isn't part of this calculation at all (status !== "calculated"); otherwise always present, with `included` telling the caller whether it counts toward the reserve total. */
  vfl: (FranceRatePart & { included: boolean }) | null;
  /** Why income tax beyond VFL is excluded — never fabricated (spec section 7, 23, 34). "vfl-not-set" is distinct from "vfl-unknown": the former means the question was never answered (e.g. skipped during onboarding), the latter means the user explicitly chose "I'm not sure" — conflating the two would misrepresent a skipped question as a considered "no." */
  incomeTaxExcludedReason: "vfl-not-enabled" | "vfl-unknown" | "vfl-not-set";
  acreApplied: boolean;
  /** social + cfp + (vfl if included) + (vat if registered) — the "Keep protected" figure. */
  knownMandatoryReserve: number;
  /** grossReceived - knownMandatoryReserve. */
  afterKnownStatutoryReserves: number;
  /** Audit snapshot (spec section 33) — store this alongside the transaction so the reserve stays explainable even after Settings change later. */
  snapshot: {
    activityTypeUsed: FranceActivityType | null;
    socialRateUsed: number | null;
    cfpRateUsed: number | null;
    vflRateUsed: number | null;
    vatRateUsed: number | null;
    acreApplied: boolean;
    calculationDate: string;
  };
}

export interface FranceTaxProfileInput {
  businessLegalStatus: string | null; // "micro_entrepreneur" | "other" | "unsure"
  activityType: string | null; // FranceActivityType | "mixed" | "unsure"
  versementLiberatoireStatus: string | null; // "yes" | "no" | "unknown"
  acreStatus: string | null; // "yes" | "no" | "unknown"
  activityStartDate: Date | null;
  vatStatus: string | null; // "exempt" | "registered" | "unknown"
  defaultVatRate: number | null; // percentage, e.g. 20
}

export interface CalculateFrenchMicroReserveInput {
  amount: number;
  amountBasis: "HT" | "TTC";
  paymentDate: Date;
  taxProfile: FranceTaxProfileInput;
  /** Only meaningful when taxProfile.activityType === "mixed" — which of the user's configured activities generated THIS payment (spec section 5). */
  paymentActivityType?: string | null;
  /** Per-payment VAT rate override (percentage, e.g. 20) — falls back to taxProfile.defaultVatRate (spec section 13). */
  vatRateOverride?: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Distinguishes three genuinely different situations that must never be
// collapsed into one message: the user explicitly declined VFL ("no"),
// explicitly said they don't know ("unknown"), or simply never answered the
// question at all (null — e.g. skipped it during onboarding). Treating a
// skipped question the same as an explicit "no" is exactly the kind of
// silent-default that makes a calculation look more informed than it is.
function resolveIncomeTaxExcludedReason(versementLiberatoireStatus: string | null): "vfl-not-enabled" | "vfl-unknown" | "vfl-not-set" {
  if (versementLiberatoireStatus == null) return "vfl-not-set";
  if (versementLiberatoireStatus === "unknown") return "vfl-unknown";
  return "vfl-not-enabled";
}

export function calculateFrenchMicroReserve(input: CalculateFrenchMicroReserveInput): FranceMicroReserveResult {
  const { amount, amountBasis, paymentDate, taxProfile, paymentActivityType, vatRateOverride } = input;

  // ── Resolve which activity this specific payment belongs to ────────────
  const effectiveActivityRaw = taxProfile.activityType === "mixed" ? (paymentActivityType ?? null) : taxProfile.activityType;
  const activity = isFranceActivityType(effectiveActivityRaw) ? effectiveActivityRaw : null;

  // ── VAT split — independent of legal status/activity, applies whenever the
  // user is actually VAT-registered (spec section 14). ────────────────────
  const vatRatePct = vatRateOverride ?? taxProfile.defaultVatRate;
  const isVatRegistered = taxProfile.vatStatus === "registered" && vatRatePct != null && vatRatePct > 0;
  // Registered but no usable rate found (Settings' default, or a per-payment
  // override, never set) — genuinely different from not being registered at
  // all, and callers must say so instead of silently dropping VAT with no
  // explanation (spec section 27's "one shared source of truth" applies to
  // explaining an omission just as much as to a number).
  const vatRegisteredRateMissing = taxProfile.vatStatus === "registered" && !isVatRegistered;
  let revenueHT: number;
  let vat: FranceRatePart | null = null;
  if (isVatRegistered) {
    const rate = vatRatePct! / 100;
    if (amountBasis === "TTC") {
      revenueHT = round2(amount / (1 + rate));
      const vatAmount = round2(amount - revenueHT);
      vat = { rate: vatRatePct!, amount: vatAmount };
    } else {
      revenueHT = amount;
      vat = { rate: vatRatePct!, amount: round2(amount * rate) };
    }
  } else {
    revenueHT = amount;
  }

  const grossReceived = amountBasis === "TTC" ? amount : (vat ? round2(revenueHT + vat.amount) : amount);

  // ── Status gating — never apply a micro-entrepreneur percentage to a
  // structure it doesn't fit, and never guess an unidentified activity
  // (spec sections 3, 5). ──────────────────────────────────────────────────
  let status: FranceReserveStatus;
  if (taxProfile.businessLegalStatus !== "micro_entrepreneur") {
    status = "unsupported-status";
  } else if (activity === null) {
    status = "needs-activity-type";
  } else {
    status = "calculated";
  }

  if (status !== "calculated") {
    const knownMandatoryReserve = vat ? vat.amount : 0;
    return {
      status,
      grossReceived,
      amountBasis,
      revenueHT,
      vat,
      vatRegisteredRateMissing,
      socialContribution: null,
      cfp: null,
      vfl: null,
      incomeTaxExcludedReason: resolveIncomeTaxExcludedReason(taxProfile.versementLiberatoireStatus), // moot at this status, kept for shape consistency
      acreApplied: false,
      knownMandatoryReserve,
      afterKnownStatutoryReserves: round2(grossReceived - knownMandatoryReserve),
      snapshot: {
        activityTypeUsed: activity,
        socialRateUsed: null,
        cfpRateUsed: null,
        vflRateUsed: null,
        vatRateUsed: vat?.rate ?? null,
        acreApplied: false,
        calculationDate: paymentDate.toISOString(),
      },
    };
  }

  // ── The actual micro-entrepreneur calculation ───────────────────────────
  const rates = resolveFranceRates({
    activity: activity!,
    paymentDate,
    acreStatus: taxProfile.acreStatus as "yes" | "no" | "unknown" | null,
    activityStartDate: taxProfile.activityStartDate,
  });

  const socialContribution: FranceRatePart = { rate: rates.socialRate, amount: round2(revenueHT * rates.socialRate) };
  const cfp: FranceRatePart = { rate: rates.cfpRate, amount: round2(revenueHT * rates.cfpRate) };

  // Versement libératoire: only ever applied when explicitly opted in — "no"
  // and "unknown" behave identically, per spec section 7's explicit rule
  // that "I'm not sure" must not add the VFL percentage either.
  const vflEnabled = taxProfile.versementLiberatoireStatus === "yes";
  const vfl: FranceRatePart & { included: boolean } = {
    rate: rates.vflRate,
    amount: vflEnabled ? round2(revenueHT * rates.vflRate) : 0,
    included: vflEnabled,
  };

  const knownMandatoryReserve = round2(socialContribution.amount + cfp.amount + (vflEnabled ? vfl.amount : 0) + (vat?.amount ?? 0));

  return {
    status: "calculated",
    grossReceived,
    amountBasis,
    revenueHT,
    vat,
    vatRegisteredRateMissing,
    socialContribution,
    cfp,
    vfl,
    incomeTaxExcludedReason: resolveIncomeTaxExcludedReason(taxProfile.versementLiberatoireStatus), // only rendered by the UI when vfl.included === false
    acreApplied: rates.acreApplied,
    knownMandatoryReserve,
    afterKnownStatutoryReserves: round2(grossReceived - knownMandatoryReserve),
    snapshot: {
      activityTypeUsed: activity,
      socialRateUsed: rates.socialRate,
      cfpRateUsed: rates.cfpRate,
      vflRateUsed: vflEnabled ? rates.vflRate : null,
      vatRateUsed: vat?.rate ?? null,
      acreApplied: rates.acreApplied,
      calculationDate: paymentDate.toISOString(),
    },
  };
}
