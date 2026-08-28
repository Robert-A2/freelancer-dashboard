import { calculateFrenchMicroReserve } from "./tax/france/calculate-reserve";
import type { ReserveForPayment } from "./reserve-engine";
import type { MoneyBreakdown, MoneyBreakdownProjection } from "./money-breakdown";
import type { TodayFacts } from "./today-facts";
import type { UpcomingItem } from "./upcoming-item";

// ── Landing page product showcase — real data, real formula ─────────────────
// The "before" figures here are the real, live GET /api/today-facts response
// for the real Business (manual) account, fetched and copied verbatim —
// including "food" as a spending category, which genuinely is one of that
// account's real business-tagged categories right now (not sanitized into
// something that looks tidier; this demo must show what the real account
// actually has, not an idealized version of it). Current cash, money in/out,
// known commitments, spending categories, and the "Your money" reserve
// (€774 — the real account's actual URSSAF-outstanding balance, not a
// generic per-payment estimate) and runway (real €200/month business
// spending estimate) all come directly from that live response.
//
// The Camille Farm payment itself is a demo scenario layered on top (the
// real one is already marked received in the account, so there's no live
// "still expected" version of it to read back) — but its reserve breakdown
// (VAT/social/CFP) is not hand-typed either: it's the output of
// calculateFrenchMicroReserve(), the exact same pure function the real
// product calls, fed the real account's actual tax profile (micro-
// entrepreneur, bnc_liberal, VAT registered at 20%, versement libératoire
// explicitly declined). Only the welcome name ("Sophie", the existing
// public demo persona at /demo) is substituted for the real account
// holder's name, and the recurring expense is relabeled from the real
// "ChatGPT" per an explicit request not to name that specific product.
//
// Since VAT is registered, the €2,000 HT payment grosses up to €2,400
// actually received (the extra €400 is VAT collected on the state's
// behalf, not the freelancer's) — every downstream cash figure uses that
// €2,400 gross, matching how the real product treats a VAT-registered
// payment landing in the account. €2,000 matches the landing page's own
// hero headline ("Your client paid you €2,000") so the two don't disagree.

const DEMO_PROFILE = {
  businessLegalStatus: "micro_entrepreneur",
  activityType: "bnc_liberal",
  versementLiberatoireStatus: "no", // explicitly declined, not just unanswered — the real account's actual setting
  acreStatus: "no",
  activityStartDate: null,
  vatStatus: "registered",
  defaultVatRate: 20, // registered with a real rate set — the real account's actual setting
} as const;

const PAYMENT_HT = 2000;
const PAYMENT_GROSS = 2400; // 2000 HT + 400 VAT (20%)

// The real account's actual business spending estimate (Settings ->
// "About how much does your business cost each month?") — this, not an
// invented figure, is what the real Runway calculation divides cash by.
const MONTHLY_SPEND = 200;

// The real account's actual current reserve state, read live from
// GET /api/today-facts?accountId=<business> — a real URSSAF-outstanding
// balance (accrued from real recorded income), not a per-payment estimate.
const CURRENT_TAX_RESERVE = 774;
const CURRENT_PROTECTED_TOTAL = 794.99; // 774 + the 20.99 known commitment
const CURRENT_AVAILABLE = 4201.61; // 4996.6 - 794.99

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
      amount: PAYMENT_HT,
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
    // The real account's actual top spending categories this month, copied
    // verbatim from the live API response — "food" genuinely is one of
    // them right now, so it stays, rather than being swapped for something
    // that reads as more tidily "business."
    spendingByCategoryThisMonth: [
      { category: "software", amount: 20.99 },
      { category: "food", amount: 3.4 },
    ],
    upcoming,
  };
}

// The real reserve engine, fed the real (now fully-configured) tax profile —
// reproduces the exact real numbers: VAT (20%) €400, Social €512, CFP €4,
// Keep protected €916, Yours to keep €1,484 (of the €2,400 gross received).
// This is deliberately a DIFFERENT number from CURRENT_TAX_RESERVE above —
// the real product itself computes these two differently: the "Your money"
// card shows the accumulated URSSAF-outstanding balance, while an
// individual Expected Payment's own detail shows that one payment's own
// VAT/social/CFP split. They're not supposed to match each other.
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
    taxReserve: { amount: CURRENT_TAX_RESERVE, rate: null, source: "urssaf-outstanding", confidence: "known" },
    recurringCommitmentsMonthly: 20.99,
    safetyBuffer: { months: null, amount: 0 },
    protectedTotal: CURRENT_PROTECTED_TOTAL,
    availableAfterProtections: CURRENT_AVAILABLE,
    safeToUse: null, // no safety-buffer months configured for this demo profile, same as the real account
    safeMonthlyPay: null, // depends on safetyBuffer.months, also unconfigured
    runway: { months: Math.round((4996.6 / MONTHLY_SPEND) * 10) / 10, monthlySpend: MONTHLY_SPEND, source: "estimated", basedOnMonths: 0 },
    spendingPace: null,
    firstMonthTransition: null,
    warnings: [],
  };
  const demoResult = computeDemoResult();
  const paymentReserve = demoResult.status === "calculated" ? demoResult.knownMandatoryReserve : 0;
  const paymentNet = demoResult.status === "calculated" ? demoResult.afterKnownStatutoryReserves : 0;
  const projectedCash = 4996.6 + PAYMENT_GROSS;
  const projectedAvailable = CURRENT_AVAILABLE + paymentNet;
  const scenario: MoneyBreakdownProjection = {
    projectedCash,
    projectedProtectedTotal: CURRENT_PROTECTED_TOTAL + paymentReserve,
    projectedAvailableAfterProtections: projectedAvailable,
    projectedRunwayMonths: Math.round((projectedCash / MONTHLY_SPEND) * 10) / 10,
  };
  return { reserve, current, scenario };
}

export function buildDemoAfter(): { currentCash: number; moneyInThisMonth: number } {
  return { currentCash: 4996.6 + PAYMENT_GROSS, moneyInThisMonth: 1000 + PAYMENT_GROSS };
}

// The real account's actual "Your money" card figures (Protected €794.99 /
// Available after protections €4,201.61), and the same figures updated by
// the Camille Farm payment actually landing: Protected grows by this
// payment's own reserve (€916), Available grows by what's genuinely left
// over (€1,484) — Protected+Available still sums to Current cash exactly as
// it does before.
export function buildDemoMoneyBreakdown(received: boolean): MoneyBreakdown {
  const demoResult = computeDemoResult();
  const paymentReserve = demoResult.status === "calculated" ? demoResult.knownMandatoryReserve : 0;
  const paymentNet = demoResult.status === "calculated" ? demoResult.afterKnownStatutoryReserves : 0;
  const currentCash = received ? 4996.6 + PAYMENT_GROSS : 4996.6;
  const protectedTotal = received ? CURRENT_PROTECTED_TOTAL + paymentReserve : CURRENT_PROTECTED_TOTAL;
  const availableAfterProtections = received ? CURRENT_AVAILABLE + paymentNet : CURRENT_AVAILABLE;
  return {
    currentCash,
    hasCurrentCash: true,
    taxReserve: { amount: received ? CURRENT_TAX_RESERVE + paymentReserve : CURRENT_TAX_RESERVE, rate: null, source: "urssaf-outstanding", confidence: "known" },
    recurringCommitmentsMonthly: 20.99,
    safetyBuffer: { months: null, amount: 0 },
    protectedTotal,
    availableAfterProtections,
    safeToUse: null,
    safeMonthlyPay: null, // depends on safetyBuffer.months, also unconfigured
    runway: { months: Math.round((currentCash / MONTHLY_SPEND) * 10) / 10, monthlySpend: MONTHLY_SPEND, source: "estimated", basedOnMonths: 0 },
    spendingPace: null,
    firstMonthTransition: null,
    warnings: [],
  };
}
