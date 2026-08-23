import { prisma } from "./prisma";
import { getCurrentCashPosition } from "./cash-balance-engine";
import { getFinancialReserve, computeReserveForAmount } from "./reserve-engine";
import type { ReserveForAmount } from "./reserve-engine";
import { getTodayFacts } from "./today-facts";
import { getCashRunway } from "./data-maturity";
import type { CashRunway } from "./data-maturity";
import { getUrssafPeriodStatus } from "./tax/france/urssaf-period";

// ── Nonodia Core Money Intelligence — the ONE shared calculation layer ──────
// Every surface that answers "what does this money mean" (Dashboard, the
// Money Received confirmation, an Expected Payment's detail, Forecast's
// Runway) must call getMoneyBreakdown() and render its fields — never
// recompute tax reserve, commitments, or runway independently. If the same
// €4,000 payment ever shows two different reserve numbers in two places,
// this file is where that bug would be, and only here.
//
// Deliberately reuses, never reimplements:
//   - current cash            → cash-balance-engine.getCurrentCashPosition()
//   - tax/cotisation rate     → reserve-engine.getFinancialReserve()
//   - per-amount reserve math → reserve-engine.computeReserveForAmount()
//   - commitments/spending    → today-facts.getTodayFacts()
//   - runway                  → data-maturity.getCashRunway()
// This file only adds the one thing that doesn't exist yet: combining them
// into the Layer 1-3 "what's protected, what's left" breakdown, plus the
// spending-estimate-vs-actual comparison spec section 13 calls out as a
// currently-silent contradiction.

export type ConfidenceLevel = "known" | "estimated" | "learning";

export interface TaxReserveBreakdown {
  amount: number;
  /** null when `amount` comes from a flat manually-declared figure or the Urssaf outstanding balance, rather than a rate applied to income. */
  rate: number | null;
  source: "manual-amount" | "urssaf-outstanding" | "manual-rate-override" | "profile" | "generic-estimate";
  confidence: ConfidenceLevel;
}

export interface SafetyBuffer {
  /** null = user has never configured a runway buffer — safeToUse stays null rather than silently picking a floor for them (spec section 11). */
  months: number | null;
  amount: number;
}

/** The "silent contradiction" fix (spec sections 13-18) — actual spending THIS month held up against the onboarding estimate, independent of whether Runway has switched to observed data yet. */
export interface SpendingPace {
  actualThisMonth: number;
  estimate: number;
  /** estimate - actualThisMonth; negative once exceeded. */
  remaining: number;
  exceeded: boolean;
}

/** Populated only during the one calendar month where Runway first switches from the onboarding estimate to real data (spec section 17) — the moment that switch must be explained, not silent. */
export interface FirstMonthTransition {
  estimate: number;
  actualFirstMonth: number;
  difference: number;
}

export type MoneyBreakdownWarning =
  | { key: "spending-exceeds-estimate"; overBy: number };

export interface MoneyBreakdown {
  currentCash: number;
  hasCurrentCash: boolean;

  taxReserve: TaxReserveBreakdown;
  recurringCommitmentsMonthly: number;
  safetyBuffer: SafetyBuffer;

  /** taxReserve.amount + recurringCommitmentsMonthly + safetyBuffer.amount */
  protectedTotal: number;
  /** currentCash - protectedTotal. Not floored at 0 — an over-committed position is real and should be visible, not hidden (spec: transparency over comfort). */
  availableAfterProtections: number;
  /** max(0, availableAfterProtections). Only non-null once safetyBuffer.months is configured — this IS the spec's "Safe to use" number, and it must not exist until a real floor has been defined. */
  safeToUse: number | null;

  /** The exact same Runway object Forecast already shows — one calculation, read here too. */
  runway: CashRunway;

  spendingPace: SpendingPace | null;
  firstMonthTransition: FirstMonthTransition | null;
  warnings: MoneyBreakdownWarning[];
}

export async function getMoneyBreakdown(userId: string, accountId?: string | null): Promise<MoneyBreakdown> {
  const [position, facts, reserve, runway, user, urssafStatus, account] = await Promise.all([
    getCurrentCashPosition(userId, accountId),
    getTodayFacts(userId, accountId),
    getFinancialReserve(userId),
    getCashRunway(userId, accountId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { manualTaxReserveAmount: true, businessSpendingEstimate: true, personalSpendingEstimate: true, safetyBufferMonths: true },
    }),
    getUrssafPeriodStatus(userId),
    accountId ? prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }) : null,
  ]);

  // Which of the two spending estimates applies to the account currently
  // being viewed — same "Business (manual)"/"Personal (manual)" name
  // convention getCashRunway() itself keys off, so this can never disagree
  // with the runway figure already computed above for the same view.
  const accountKind: "business" | "personal" | null =
    account?.name === "Business (manual)" ? "business" : account?.name === "Personal (manual)" ? "personal" : null;
  const business = user?.businessSpendingEstimate != null ? Number(user.businessSpendingEstimate) : null;
  const personal = user?.personalSpendingEstimate != null ? Number(user.personalSpendingEstimate) : null;
  const combined = (business ?? 0) + (personal ?? 0);
  const viewEstimate = accountKind === "business" ? business : accountKind === "personal" ? personal : (combined > 0 ? combined : null);

  const taxReserve = computeTaxReserve(user?.manualTaxReserveAmount, reserve, facts.moneyInThisMonth, urssafStatus);

  const safetyBufferMonths = user?.safetyBufferMonths != null ? Number(user.safetyBufferMonths) : null;
  const safetyBufferAmount = safetyBufferMonths != null ? safetyBufferMonths * runway.monthlySpend : 0;
  const safetyBuffer: SafetyBuffer = { months: safetyBufferMonths, amount: safetyBufferAmount };

  const protectedTotal = taxReserve.amount + facts.knownCommitmentsMonthly + safetyBufferAmount;
  const availableAfterProtections = position.amount - protectedTotal;
  const safeToUse = safetyBufferMonths != null ? Math.max(0, availableAfterProtections) : null;

  const spendingPace: SpendingPace | null = viewEstimate != null
    ? {
        actualThisMonth: facts.moneyOutThisMonth,
        estimate: viewEstimate,
        remaining: viewEstimate - facts.moneyOutThisMonth,
        exceeded: facts.moneyOutThisMonth > viewEstimate,
      }
    : null;

  // The one-time (well — one-month-long) transition callout: Runway just
  // started using real observed data for the first time this account has
  // ever had a complete month. basedOnMonths stays 1 for the entire second
  // calendar month, so this naturally shows for exactly that window without
  // needing separate "have I shown this already" tracking.
  const firstMonthTransition: FirstMonthTransition | null =
    viewEstimate != null && runway.source === "calculated" && runway.basedOnMonths === 1
      ? { estimate: viewEstimate, actualFirstMonth: runway.monthlySpend, difference: runway.monthlySpend - viewEstimate }
      : null;

  const warnings: MoneyBreakdownWarning[] = [];
  if (spendingPace?.exceeded) {
    warnings.push({ key: "spending-exceeds-estimate", overBy: spendingPace.actualThisMonth - spendingPace.estimate });
  }

  return {
    currentCash: position.amount,
    hasCurrentCash: position.hasCheckpoint,
    taxReserve,
    recurringCommitmentsMonthly: facts.knownCommitmentsMonthly,
    safetyBuffer,
    protectedTotal,
    availableAfterProtections,
    safeToUse,
    runway,
    spendingPace,
    firstMonthTransition,
    warnings,
  };
}

// A flat manually-declared reserve (money already physically set aside)
// always wins when present — it's a directly-stated fact, not an estimate.
// Next, if the user has told Nonodia how often they declare to Urssaf, use
// the real reserved-minus-paid running balance (spec section 26: "a reserve
// must not grow forever" — this is what actually prevents that, since it
// drops back down every time a tax_payment expense is recorded). Otherwise
// fall back to the this-month-income estimate, same as before.
function computeTaxReserve(
  manualTaxReserveAmount: unknown,
  reserve: Awaited<ReturnType<typeof getFinancialReserve>>,
  incomeThisMonth: number,
  urssafStatus: Awaited<ReturnType<typeof getUrssafPeriodStatus>>,
): TaxReserveBreakdown {
  if (manualTaxReserveAmount != null) {
    return { amount: Number(manualTaxReserveAmount), rate: null, source: "manual-amount", confidence: "known" };
  }
  if (urssafStatus != null) {
    return { amount: urssafStatus.outstanding, rate: null, source: "urssaf-outstanding", confidence: "known" };
  }
  const computed: ReserveForAmount = computeReserveForAmount(reserve, incomeThisMonth);
  return {
    amount: computed.reserveAmount,
    rate: computed.pct,
    source: reserve.isManualOverride ? "manual-rate-override" : reserve.isProfileComplete ? "profile" : "generic-estimate",
    confidence: reserve.isProfileComplete ? "known" : "estimated",
  };
}

export interface MoneyBreakdownProjection {
  projectedCash: number;
  projectedProtectedTotal: number;
  /** = current.availableAfterProtections + reserveForPayment.netAmount — only the after-reserve portion of an incoming payment ever becomes available, since the reserve portion is protected the moment it lands. */
  projectedAvailableAfterProtections: number;
  /** null when the current runway itself has no basis to project from (no checkpoint, no estimate, no history). */
  projectedRunwayMonths: number | null;
}

// The "if this arrives" scenario (spec sections 6, 23-24, 32) — never
// written to Current Cash before the payment is actually marked received;
// purely a read-only projection layered on top of the current breakdown
// using the exact same reserve/runway math, so it can never contradict what
// the dashboard is showing right now.
export function projectMoneyBreakdownWithPayment(
  current: MoneyBreakdown,
  paymentAmount: number,
  reserveForPayment: ReserveForAmount,
): MoneyBreakdownProjection {
  const projectedCash = current.currentCash + paymentAmount;
  const projectedProtectedTotal = current.protectedTotal + reserveForPayment.reserveAmount;
  const projectedAvailableAfterProtections = current.availableAfterProtections + reserveForPayment.netAmount;
  const projectedRunwayMonths = current.runway.monthlySpend > 0 ? projectedCash / current.runway.monthlySpend : current.runway.months;
  return { projectedCash, projectedProtectedTotal, projectedAvailableAfterProtections, projectedRunwayMonths };
}
