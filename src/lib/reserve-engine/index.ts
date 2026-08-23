import { prisma } from "../prisma";
import { getCountryRules } from "./countries";
import { computeEmergencyBuffer } from "./emergency-buffer";
import type { ReserveBucket, UserFinancialProfile } from "./types";
import { calculateFrenchMicroReserve, type FranceMicroReserveResult } from "../tax/france/calculate-reserve";

export type { ReserveBucket, UserFinancialProfile, BucketKey, BucketConfidence } from "./types";
export { computeEmergencyBuffer } from "./emergency-buffer";

// A rough, deliberately round "typical freelancer" figure — used only when
// there's no country rule set to draw on AND no manual override. Never
// presented as a precise number; always paired with the disclaimer the
// product requires.
const GENERIC_ESTIMATE_PCT = 25;

export interface ReserveSummary {
  isProfileComplete: boolean;
  countryCode: string | null; // e.g. "FR", or null when no supported country rule set applies
  isManualOverride: boolean;
  estimatedReservePct: number;   // single headline % — precise when profile complete, otherwise the estimate/override
  buckets: ReserveBucket[];      // detailed breakdown — only populated when profile is complete
  emergencyBufferPct: number;
  emergencyBufferVolatility: "low" | "medium" | "high" | "unknown";
  totalIncomeAllTime: number;
  incomeThisMonth: number;
  availableToSpendThisMonth: number;
}

export interface ReserveForAmount {
  pct: number;
  reserveAmount: number;
  netAmount: number;
  /** true when estimatedReservePct is the generic fallback or a manual override — not a real per-country VAT/tax calculation. Mirrors the same distinction FinancialReserveCard already shows via isProfileComplete/isManualOverride. */
  isEstimate: boolean;
}

// The per-payment counterpart to getFinancialReserve's monthly view — "of
// this €2,500 that just arrived, how much should I set aside, how much is
// actually mine." Deliberately just applies the same headline
// estimatedReservePct to one amount rather than a second rate calculation,
// so a payment's reserve line can never disagree with the Settings page's
// reserve card.
export function computeReserveForAmount(summary: ReserveSummary, amount: number): ReserveForAmount {
  const reserveAmount = Math.round(amount * (summary.estimatedReservePct / 100) * 100) / 100;
  const netAmount = Math.round((amount - reserveAmount) * 100) / 100;
  return {
    pct: summary.estimatedReservePct,
    reserveAmount,
    netAmount,
    isEstimate: !summary.isProfileComplete,
  };
}

export interface FranceReserveForPayment {
  engine: "france";
  /** The full itemized breakdown (spec sections 21-25) — use this to render social/CFP/VFL/VAT as separate lines. */
  result: FranceMicroReserveResult;
  /** Flattened view for callers that only want one pct/amount pair (e.g. existing ReserveBreakdown fallback). */
  asReserveForAmount: ReserveForAmount;
}
export interface GenericReserveForPayment {
  engine: "generic";
  result: ReserveForAmount;
}
export type ReserveForPayment = FranceReserveForPayment | GenericReserveForPayment;

// The one entry point for "of this specific payment, how much is protected"
// (spec sections 21, 24-25, 27, 45) — routes France micro-entrepreneurs
// through calculateFrenchMicroReserve() for a real itemized answer, and
// falls back to the generic country-agnostic estimate (manual override, or
// the generic 25%) for everyone else, or for a France profile that can't be
// calculated yet (wrong legal status, activity not identified). Every
// caller that needs a payment-level reserve figure — Quick Add income,
// Expected Payment scenario/received, Money Breakdown — calls this instead
// of computing anything itself.
export async function getReserveForPayment(
  userId: string,
  amount: number,
  options?: { amountBasis?: "HT" | "TTC"; paymentDate?: Date; paymentActivityType?: string | null }
): Promise<ReserveForPayment> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      country: true, businessLegalStatus: true, activityType: true, vatStatus: true,
      versementLiberatoireStatus: true, acreStatus: true, activityStartDate: true, defaultVatRate: true,
    },
  });

  if (user?.country === "FR") {
    const result = calculateFrenchMicroReserve({
      amount,
      amountBasis: options?.amountBasis ?? "HT",
      paymentDate: options?.paymentDate ?? new Date(),
      taxProfile: {
        businessLegalStatus: user.businessLegalStatus,
        activityType: user.activityType,
        versementLiberatoireStatus: user.versementLiberatoireStatus,
        acreStatus: user.acreStatus,
        activityStartDate: user.activityStartDate,
        vatStatus: user.vatStatus,
        defaultVatRate: user.defaultVatRate != null ? Number(user.defaultVatRate) : null,
      },
      paymentActivityType: options?.paymentActivityType,
    });

    if (result.status === "calculated") {
      return {
        engine: "france",
        result,
        asReserveForAmount: {
          pct: result.grossReceived > 0 ? Math.round((result.knownMandatoryReserve / result.grossReceived) * 1000) / 10 : 0,
          reserveAmount: result.knownMandatoryReserve,
          netAmount: result.afterKnownStatutoryReserves,
          isEstimate: false, // a real deterministic calculation from official rates, not a guess
        },
      };
    }
    // "unsupported-status" or "needs-activity-type" — fall through to the
    // generic path below, which already treats an incomplete France profile
    // the same way (manual override, else the generic 25% estimate).
  }

  const summary = await getFinancialReserve(userId);
  return { engine: "generic", result: computeReserveForAmount(summary, amount) };
}

export async function getFinancialReserve(userId: string): Promise<ReserveSummary> {
  const [user, latestRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        country: true, businessLegalStatus: true, activityType: true, vatStatus: true, manualReservePctOverride: true,
        versementLiberatoireStatus: true, acreStatus: true, activityStartDate: true, defaultVatRate: true,
      },
    }),
    // Anchor "this month" to the most recent month with actual data, not wall-clock
    // time — same convention as getDashboardSummary/getMonthlyComparison. A user
    // whose last upload doesn't reach today would otherwise always see €0 available
    // to spend and "not enough history" for the emergency buffer, no matter how
    // much real history they've actually uploaded.
    prisma.monthlyAnalytics.findFirst({
      where: { userId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  const profile: UserFinancialProfile = {
    country: user?.country ?? null,
    businessLegalStatus: user?.businessLegalStatus ?? null,
    activityType: user?.activityType ?? null,
    vatStatus: user?.vatStatus ?? null,
    versementLiberatoireStatus: user?.versementLiberatoireStatus ?? null,
    acreStatus: user?.acreStatus ?? null,
    activityStartDate: user?.activityStartDate ?? null,
    defaultVatRate: user?.defaultVatRate != null ? Number(user.defaultVatRate) : null,
  };

  const anchor = latestRecord ? new Date(Date.UTC(latestRecord.year, latestRecord.month - 1, 1)) : new Date();
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const sixMonthsAgo = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 6, 1));

  const [incomeAllTimeAgg, incomeThisMonthAgg, recentIncomeTxs] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, transactionType: "income" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, transactionType: "income", transactionDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { userId, transactionType: "income", transactionDate: { gte: sixMonthsAgo } },
      select: { amount: true, transactionDate: true },
    }),
  ]);

  const totalIncomeAllTime = Number(incomeAllTimeAgg._sum.amount ?? 0);
  const incomeThisMonth = Number(incomeThisMonthAgg._sum.amount ?? 0);

  const byMonth = new Map<string, number>();
  for (const tx of recentIncomeTxs) {
    const key = `${tx.transactionDate.getUTCFullYear()}-${tx.transactionDate.getUTCMonth()}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(tx.amount));
  }
  const monthlyIncomeSamples = [...byMonth.values()];

  const countryRules = getCountryRules(profile.country);
  const isProfileComplete = countryRules?.isProfileComplete(profile) ?? false;

  // Computed whenever a country rule set exists, even when the profile is
  // incomplete — an "unsupported status" / "needs activity type" bucket
  // still carries a specific, honest reason (spec sections 3, 5, 31, 36),
  // distinct from "never set up at all."
  const buckets: ReserveBucket[] = countryRules
    ? countryRules.computeTaxBuckets(profile, { totalIncomeAllTime, incomeThisMonth, monthlyIncomeSamples })
    : [];

  let estimatedReservePct: number;
  let isManualOverride = false;

  if (isProfileComplete && countryRules) {
    estimatedReservePct = buckets.reduce((sum, b) => sum + (b.pct ?? 0), 0);
  } else if (user?.manualReservePctOverride != null) {
    estimatedReservePct = Number(user.manualReservePctOverride);
    isManualOverride = true;
  } else {
    estimatedReservePct = GENERIC_ESTIMATE_PCT;
  }

  const { pct: emergencyBufferPct, volatility: emergencyBufferVolatility } = computeEmergencyBuffer(monthlyIncomeSamples);

  const totalReservePct = estimatedReservePct + emergencyBufferPct;
  const availableToSpendThisMonth = incomeThisMonth * (1 - totalReservePct / 100);

  return {
    isProfileComplete,
    countryCode: countryRules?.countryCode ?? null,
    isManualOverride,
    estimatedReservePct,
    buckets,
    emergencyBufferPct,
    emergencyBufferVolatility,
    totalIncomeAllTime,
    incomeThisMonth,
    availableToSpendThisMonth,
  };
}
