import { prisma } from "./prisma";
import { getMoneyBreakdown } from "./money-breakdown";
import { getDataMaturity, MATURITY_THRESHOLDS } from "./data-maturity";
import { getHistoricalData, getIncomeConcentration } from "./analytics-engine";
import { computeCashflowRisk } from "./intelligence-engine";
import { getClientRiskProfiles, getPaymentLatenessOverview } from "./client-risk-engine";
import type { Insight } from "./insight-types";

// ── Financial Stability Score ────────────────────────────────────────────────
// Answers one question the app didn't have a single number for: "how
// financially stable is my business right now" — composed entirely from
// signals other engines already compute (never a second calculation of any
// of them). See each factor below for its exact source.
//
// Every factor is independently gated on having real data; the overall score
// only appears once MATURITY_THRESHOLDS.MIN_FACTORS_FOR_STABILITY_SCORE of
// the 6 are available, renormalized over just those — never padded with an
// assumed zero for a factor that simply hasn't been measured yet.

const MAX_POINTS_PER_FACTOR = 20;

export type StabilityFactorKey =
  | "runway"
  | "cashflowConsistency"
  | "incomeDiversification"
  | "clientReliability"
  | "paymentTiming"
  | "taxReserveConfidence";

export interface StabilityFactor {
  key: StabilityFactorKey;
  available: boolean;
  points: number;
  maxPoints: typeof MAX_POINTS_PER_FACTOR;
  /** The real number behind this factor, for the explainable "why" list. Null when unavailable. */
  detail: Insight | null;
  /** Whether this factor's detail reads as reassuring or concerning — drives whether it's listed as a checkmark or a warning. Null when unavailable. */
  isPositive: boolean | null;
}

export interface StabilityScore {
  status: "known" | "not-enough-data";
  score: number | null;
  band: "stable" | "watch" | "at-risk" | null;
  factors: StabilityFactor[];
  positiveFactors: Insight[];
  warningFactors: Insight[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Linear 0..maxPoints between a "worst" and "best" real-world value —
// documented per factor below rather than a single opaque helper signature.
function scaleLinear(value: number, worst: number, best: number): number {
  if (best === worst) return 0;
  const t = clamp((value - worst) / (best - worst), 0, 1);
  return Math.round(t * MAX_POINTS_PER_FACTOR);
}

export async function getStabilityScore(userId: string, accountId?: string | null): Promise<StabilityScore> {
  const [maturity, breakdown, history, concentration, clientData, taxPaymentTxRows, latenessOverview] = await Promise.all([
    getDataMaturity(userId),
    getMoneyBreakdown(userId, accountId),
    getHistoricalData(userId, 999, accountId),
    getIncomeConcentration(userId, accountId),
    getClientRiskProfiles(userId, accountId),
    prisma.transaction.findMany({
      where: { userId, intent: "tax_payment", transactionType: "expense", ...(accountId ? { accountId } : {}) },
      select: { transactionDate: true, amount: true },
    }),
    // Expected Payments carry no accountId (see prisma/schema.prisma) — a
    // client payment is always Business's regardless of manual account
    // separation, same convention today-facts.ts already uses.
    getPaymentLatenessOverview(userId),
  ]);
  const taxPaymentTxs = taxPaymentTxRows.map((t) => ({ transactionDate: t.transactionDate, amount: Number(t.amount) }));

  const factors: StabilityFactor[] = [
    buildRunwayFactor(breakdown.runway.months),
    buildCashflowConsistencyFactor(history, taxPaymentTxs, maturity.completeMonths),
    buildDiversificationFactor(concentration),
    buildClientReliabilityFactor(clientData),
    buildPaymentTimingFactor(latenessOverview, clientData.clients),
    buildTaxReserveFactor(breakdown.taxReserve.confidence),
  ];

  const baseGateMet = maturity.hasCurrentCash && maturity.completeMonths >= MATURITY_THRESHOLDS.MIN_COMPLETE_MONTHS_FOR_HEALTH;
  return computeScoreFromFactors(factors, baseGateMet);
}

// Pure — takes already-built factors and decides status/score/band. Split
// out from getStabilityScore so the renormalization math is testable without
// mocking prisma (see __tests__/stability-score-engine.test.ts).
export function computeScoreFromFactors(factors: StabilityFactor[], baseGateMet: boolean): StabilityScore {
  const availableFactors = factors.filter((f) => f.available);

  if (!baseGateMet || availableFactors.length < MATURITY_THRESHOLDS.MIN_FACTORS_FOR_STABILITY_SCORE) {
    return { status: "not-enough-data", score: null, band: null, factors, positiveFactors: [], warningFactors: [] };
  }

  const earnedPoints = availableFactors.reduce((s, f) => s + f.points, 0);
  const maxPoints = availableFactors.length * MAX_POINTS_PER_FACTOR;
  const score = Math.round((100 * earnedPoints) / maxPoints);
  const band: StabilityScore["band"] = score >= 75 ? "stable" : score >= 50 ? "watch" : "at-risk";

  const positiveFactors = availableFactors.filter((f) => f.isPositive === true && f.detail).map((f) => f.detail!);
  const warningFactors = availableFactors.filter((f) => f.isPositive === false && f.detail).map((f) => f.detail!);

  return { status: "known", score, band, factors, positiveFactors, warningFactors };
}

// ── Factor 1: Runway / buffer coverage ───────────────────────────────────────
// Source: getMoneyBreakdown().runway.months (data-maturity's getCashRunway,
// reused verbatim — never recomputed). 0 months -> 0pts, >=6 months -> 20pts,
// linear between. 6 months is the same ceiling this app's own safety-buffer
// UX already treats as "well covered" — not a new invented number. A
// negative runway (already behind the spend basis) scores 0.
function buildRunwayFactor(months: number | null): StabilityFactor {
  if (months === null) {
    return { key: "runway", available: false, points: 0, maxPoints: MAX_POINTS_PER_FACTOR, detail: null, isPositive: null };
  }
  const points = months < 0 ? 0 : scaleLinear(months, 0, 6);
  const rounded = Math.round(months * 10) / 10;
  const isPositive = points >= MAX_POINTS_PER_FACTOR * 0.6;
  return {
    key: "runway",
    available: true,
    points,
    maxPoints: MAX_POINTS_PER_FACTOR,
    isPositive,
    detail: { key: isPositive ? "insights.stability.runwayGood" : "insights.stability.runwayLow", values: { months: rounded } },
  };
}

// ── Factor 2: Cashflow consistency ───────────────────────────────────────────
// Source: computeCashflowRisk() — the exact same function the Dashboard and
// Forecast pages already use for the Cashflow Risk signal, applied here as a
// score input instead of a bucket. Gated on the same MIN_COMPLETE_MONTHS_FOR_HEALTH
// bar Business Health already requires.
function buildCashflowConsistencyFactor(
  history: Parameters<typeof computeCashflowRisk>[0],
  taxPaymentTxs: Parameters<typeof computeCashflowRisk>[1],
  completeMonths: number,
): StabilityFactor {
  if (completeMonths < MATURITY_THRESHOLDS.MIN_COMPLETE_MONTHS_FOR_HEALTH) {
    return { key: "cashflowConsistency", available: false, points: 0, maxPoints: MAX_POINTS_PER_FACTOR, detail: null, isPositive: null };
  }
  const risk = computeCashflowRisk(history, taxPaymentTxs);
  if (risk.totalMonths === 0) {
    return { key: "cashflowConsistency", available: false, points: 0, maxPoints: MAX_POINTS_PER_FACTOR, detail: null, isPositive: null };
  }
  const posRatio = risk.positiveCount / risk.totalMonths;
  const points = Math.round(posRatio * MAX_POINTS_PER_FACTOR);
  const pct = Math.round(posRatio * 100);
  const isPositive = points >= MAX_POINTS_PER_FACTOR * 0.6;
  return {
    key: "cashflowConsistency",
    available: true,
    points,
    maxPoints: MAX_POINTS_PER_FACTOR,
    isPositive,
    detail: { key: isPositive ? "insights.stability.cashflowConsistent" : "insights.stability.cashflowInconsistent", values: { pct } },
  };
}

// ── Factor 3: Income diversification ─────────────────────────────────────────
// Source: getIncomeConcentration() — reuses its own existing >=3-transaction
// gate. 100% from one source -> 0pts, <=40% -> 20pts, linear between.
function buildDiversificationFactor(concentration: Awaited<ReturnType<typeof getIncomeConcentration>>): StabilityFactor {
  if (concentration.totalSources === 0) {
    return { key: "incomeDiversification", available: false, points: 0, maxPoints: MAX_POINTS_PER_FACTOR, detail: null, isPositive: null };
  }
  const points = scaleLinear(100 - concentration.topSourcePct, 0, 60);
  const isPositive = !concentration.isHighConcentration;
  return {
    key: "incomeDiversification",
    available: true,
    points,
    maxPoints: MAX_POINTS_PER_FACTOR,
    isPositive,
    detail: {
      key: isPositive ? "insights.stability.diversificationGood" : "insights.stability.diversificationConcentrated",
      values: { pct: concentration.topSourcePct },
    },
  };
}

// ── Factor 4: Client reliability ─────────────────────────────────────────────
// Source: getClientRiskProfiles() — share of active clients (with a proven
// >=3-payment cadence, same bar that file uses everywhere) whose
// reliabilityScore is excellent/good.
function buildClientReliabilityFactor(clientData: Awaited<ReturnType<typeof getClientRiskProfiles>>): StabilityFactor {
  const establishedActiveClients = clientData.clients.filter((c) => c.lifecycle === "current" && c.paymentCount >= 3);
  if (establishedActiveClients.length === 0) {
    return { key: "clientReliability", available: false, points: 0, maxPoints: MAX_POINTS_PER_FACTOR, detail: null, isPositive: null };
  }
  const reliableCount = establishedActiveClients.filter((c) => c.reliabilityScore === "excellent" || c.reliabilityScore === "good").length;
  const ratio = reliableCount / establishedActiveClients.length;
  const points = Math.round(ratio * MAX_POINTS_PER_FACTOR);
  const isPositive = points >= MAX_POINTS_PER_FACTOR * 0.6;
  return {
    key: "clientReliability",
    available: true,
    points,
    maxPoints: MAX_POINTS_PER_FACTOR,
    isPositive,
    detail: {
      key: isPositive ? "insights.stability.clientsReliable" : "insights.stability.clientsUnreliable",
      values: { reliable: reliableCount, total: establishedActiveClients.length },
    },
  };
}

// ── Factor 5b: Payment timing ────────────────────────────────────────────────
// Source: getPaymentLatenessOverview() (client-risk-engine.ts) — real
// (receivedTransaction.transactionDate - expectedDate) averages, only from
// actual paired data, gated at its own >=5-sample bar. Distinct from
// clientReliability above: reliability measures whether a client pays at a
// consistent interval relative to their OWN history; this measures whether
// they pay by the date Nonodia was actually told to expect — the two can
// disagree (a client can be perfectly regular and still always 10 days late).
// 0 or early -> 20pts, >=14 days late -> 0pts, linear between.
//
// When one specific client is clearly the outlier (>3 days late on their own
// real average, from the same per-client figures shown on their own detail
// page), name them directly — "Client B averages 16 days late" is a more
// useful, more honest warning than a bare account-wide number, and it's
// still real data, never a guess.
function buildPaymentTimingFactor(
  overview: Awaited<ReturnType<typeof getPaymentLatenessOverview>>,
  clients: Awaited<ReturnType<typeof getClientRiskProfiles>>["clients"],
): StabilityFactor {
  if (!overview) {
    return { key: "paymentTiming", available: false, points: 0, maxPoints: MAX_POINTS_PER_FACTOR, detail: null, isPositive: null };
  }
  const points = scaleLinear(-overview.avgDaysLate, -14, 0);
  const isPositiveOverall = points >= MAX_POINTS_PER_FACTOR * 0.6;

  const worstClient = clients
    .filter((c) => c.avgDaysLate !== null && c.avgDaysLate > 3)
    .sort((a, b) => (b.avgDaysLate ?? 0) - (a.avgDaysLate ?? 0))[0];

  if (worstClient) {
    return {
      key: "paymentTiming",
      available: true,
      points,
      maxPoints: MAX_POINTS_PER_FACTOR,
      isPositive: false,
      detail: { key: "insights.stability.clientPaysLate", values: { name: worstClient.name, days: Math.round(worstClient.avgDaysLate!) } },
    };
  }

  return {
    key: "paymentTiming",
    available: true,
    points,
    maxPoints: MAX_POINTS_PER_FACTOR,
    isPositive: isPositiveOverall,
    detail: {
      key: isPositiveOverall ? "insights.stability.paymentsOnTime" : "insights.stability.paymentsLate",
      values: { days: Math.round(Math.abs(overview.avgDaysLate)) },
    },
  };
}

// ── Factor 5: Tax reserve confidence ─────────────────────────────────────────
// Source: MoneyBreakdown.taxReserve.confidence — always available, since
// computeTaxReserve() in money-breakdown.ts always returns a value.
function buildTaxReserveFactor(confidence: "known" | "estimated" | "learning"): StabilityFactor {
  const points = confidence === "known" ? MAX_POINTS_PER_FACTOR : confidence === "estimated" ? 12 : 6;
  const isPositive = confidence === "known";
  return {
    key: "taxReserveConfidence",
    available: true,
    points,
    maxPoints: MAX_POINTS_PER_FACTOR,
    isPositive,
    detail: { key: isPositive ? "insights.stability.taxReserveKnown" : "insights.stability.taxReserveEstimated" },
  };
}
