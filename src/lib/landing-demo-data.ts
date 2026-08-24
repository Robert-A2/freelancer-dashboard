import { calculateFrenchMicroReserve } from "./tax/france/calculate-reserve";
import type { ReserveForPayment } from "./reserve-engine";
import type { MoneyBreakdown, MoneyBreakdownProjection } from "./money-breakdown";
import type { TodayFacts } from "./today-facts";
import type { UpcomingItem } from "./upcoming-item";

// ── Landing page product showcase — real data, real formula ─────────────────
// Every number here is the real screenshotted data from an actual Dashboard
// and Expected Payment screen (Camille Farm, €1,000 HT). The reserve
// breakdown below is not hand-typed — it's the output of
// calculateFrenchMicroReserve(), the exact same pure function the real
// product calls, fed the real account's actual tax profile (micro-
// entrepreneur, bnc_liberal, VAT registered at 20%, versement libératoire
// explicitly declined). Only the welcome name ("Sophie", the existing
// public demo persona at /demo) is substituted for the real account
// holder's name.
//
// Since VAT is registered, the €1,000 HT payment grosses up to €1,200
// actually received (the extra €200 is VAT collected on the state's
// behalf, not the freelancer's) — every downstream cash figure uses that
// €1,200 gross, matching how the real product treats a VAT-registered
// payment landing in the account.

const DEMO_PROFILE = {
  businessLegalStatus: "micro_entrepreneur",
  activityType: "bnc_liberal",
  versementLiberatoireStatus: "no", // explicitly declined, not just unanswered — the real account's actual setting
  acreStatus: "no",
  activityStartDate: null,
  vatStatus: "registered",
  defaultVatRate: 20, // registered with a real rate set — the real account's actual setting
} as const;

const PAYMENT_HT = 1000;
const PAYMENT_GROSS = 1200; // 1000 HT + 200 VAT (20%)
const MONTHLY_SPEND = 979.73; // this demo's own assumed monthly burn — currentCash/MONTHLY_SPEND = 5.1 months, matching the real screenshot's runway

export const DEMO_PAYMENT_ID = "landing-demo-camille-farm";

export function buildDemoTodayFacts(received: boolean): TodayFacts {
  const upcoming: UpcomingItem[] = [
    { kind: "recurring_expense", id: "landing-demo-canva", label: "Canva", amount: 20.99, date: new Date("2026-09-01T00:00:00Z") },
  ];
  if (!received) {
    upcoming.push({
      kind: "expected_income",
      id: DEMO_PAYMENT_ID,
      label: "Camille Farm",
      clientName: "Camille Farm",
      projectName: "Website development",
      amount: 1000,
      date: new Date("2026-09-30T00:00:00Z"),
    });
  }

  return {
    currentCash: received ? 4996.6 + PAYMENT_GROSS : 4996.6,
    hasCurrentCash: true,
    moneyInThisMonth: received ? 1000 + PAYMENT_GROSS : 1000,
    moneyOutThisMonth: 1024.39,
    knownCommitmentsMonthly: 20.99,
    reserved: null,
    // Both genuinely business categories — "food" (a personal category) was
    // here before, which is exactly the kind of mixed-account inconsistency
    // this demo must never show: the account pill says "Business (manual)",
    // so every figure on this card has to actually be business-scoped, not
    // quietly pulled from an "All accounts" combined view.
    spendingByCategoryThisMonth: [
      { category: "software", amount: 20.99 },
      { category: "banking fees", amount: 3.4 },
    ],
    upcoming,
  };
}

// The real reserve engine, fed the real (now fully-configured) tax profile —
// reproduces the exact real numbers: VAT (20%) €200, Social €256, CFP €2,
// Keep protected €458, Yours to keep €742 (of the €1,200 gross received).
function computeDemoResult() {
  return calculateFrenchMicroReserve({
    amount: PAYMENT_HT,
    amountBasis: "HT",
    paymentDate: new Date("2026-08-24T00:00:00Z"),
    taxProfile: DEMO_PROFILE,
  });
}

export function buildDemoReserve(): ReserveForPayment {
  const result = computeDemoResult();
  return {
    engine: "france",
    result,
    asReserveForAmount: {
      pct: result.status === "calculated" ? Math.round((result.knownMandatoryReserve / PAYMENT_HT) * 1000) / 10 : 0,
      reserveAmount: result.knownMandatoryReserve,
      netAmount: result.afterKnownStatutoryReserves,
      isEstimate: false,
    },
  };
}

export function buildDemoScenario(): { reserve: ReserveForPayment; current: MoneyBreakdown; scenario: MoneyBreakdownProjection } {
  const reserve = buildDemoReserve();
  const current: MoneyBreakdown = {
    currentCash: 4996.6,
    hasCurrentCash: true,
    taxReserve: { amount: 536.99, rate: null, source: "profile", confidence: "known" },
    recurringCommitmentsMonthly: 20.99,
    safetyBuffer: { months: null, amount: 0 },
    protectedTotal: 536.99,
    availableAfterProtections: 4459.61,
    safeToUse: null, // no safety-buffer months configured for this demo profile, same as the real screenshot
    runway: { months: Math.round((4996.6 / MONTHLY_SPEND) * 10) / 10, monthlySpend: MONTHLY_SPEND, source: "estimated", basedOnMonths: 0 },
    spendingPace: null,
    firstMonthTransition: null,
    warnings: [],
  };
  const demoResult = computeDemoResult();
  const projectedCash = 4996.6 + PAYMENT_GROSS;
  const projectedAvailable = 4459.61 + (demoResult.status === "calculated" ? demoResult.afterKnownStatutoryReserves : 0);
  const scenario: MoneyBreakdownProjection = {
    projectedCash,
    projectedProtectedTotal: projectedCash - projectedAvailable,
    projectedAvailableAfterProtections: projectedAvailable,
    projectedRunwayMonths: Math.round((projectedCash / MONTHLY_SPEND) * 10) / 10,
  };
  return { reserve, current, scenario };
}

export function buildDemoAfter(): { currentCash: number; moneyInThisMonth: number } {
  return { currentCash: 4996.6 + PAYMENT_GROSS, moneyInThisMonth: 1000 + PAYMENT_GROSS };
}

// The real screenshotted "Your money" card figures (Protected €536.99 /
// Available after protections €4,459.61), and the same figures updated by
// the Camille Farm payment actually landing: Protected grows by this
// payment's own reserve (€458), Available grows by what's genuinely left
// over (€742) — Protected+Available still sums to Current cash exactly as
// it does before.
export function buildDemoMoneyBreakdown(received: boolean): MoneyBreakdown {
  const demoResult = computeDemoResult();
  const paymentReserve = demoResult.status === "calculated" ? demoResult.knownMandatoryReserve : 0;
  const paymentNet = demoResult.status === "calculated" ? demoResult.afterKnownStatutoryReserves : 0;
  const currentCash = received ? 4996.6 + PAYMENT_GROSS : 4996.6;
  const protectedTotal = received ? 536.99 + paymentReserve : 536.99;
  const availableAfterProtections = received ? 4459.61 + paymentNet : 4459.61;
  return {
    currentCash,
    hasCurrentCash: true,
    taxReserve: { amount: protectedTotal, rate: null, source: "profile", confidence: "known" },
    recurringCommitmentsMonthly: 20.99,
    safetyBuffer: { months: null, amount: 0 },
    protectedTotal,
    availableAfterProtections,
    safeToUse: null,
    runway: { months: Math.round((currentCash / MONTHLY_SPEND) * 10) / 10, monthlySpend: MONTHLY_SPEND, source: "estimated", basedOnMonths: 0 },
    spendingPace: null,
    firstMonthTransition: null,
    warnings: [],
  };
}
