import { prisma } from "../prisma";
import { getCountryRules } from "./countries";
import { computeEmergencyBuffer } from "./emergency-buffer";
import type { ReserveBucket, UserFinancialProfile } from "./types";

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

export async function getFinancialReserve(userId: string): Promise<ReserveSummary> {
  const [user, latestRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { country: true, businessLegalStatus: true, activityType: true, vatStatus: true, manualReservePctOverride: true },
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

  let buckets: ReserveBucket[] = [];
  let estimatedReservePct: number;
  let isManualOverride = false;

  if (isProfileComplete && countryRules) {
    buckets = countryRules.computeTaxBuckets(profile, { totalIncomeAllTime, incomeThisMonth, monthlyIncomeSamples });
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
