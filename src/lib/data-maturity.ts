import { prisma } from "./prisma";
import { getCurrentCashPosition } from "./cash-balance-engine";

// Nonodia must know how much reliable history it has before it's allowed to
// sound confident — this is the single source of truth every dashboard card,
// Analytics section, and the Forecast page checks before showing a computed
// insight vs. a "Learning"/"Estimated" placeholder (spec sections 15-16).
// Not a separate manual-only concept: it reads the same Transaction table
// every CSV row already lands in, so a CSV user with 18 months of history
// gets full maturity on day one, no different code path.

export interface DataMaturity {
  historyDays: number;
  completeMonths: number;
  transactionCount: number;
  hasCurrentCash: boolean;
  hasExpectedIncome: boolean;
  hasRecurringExpenses: boolean;
  hasSpendingEstimate: boolean;
  dataSources: Array<"manual" | "csv">;
  earliestTransactionDate: Date | null;
  latestTransactionDate: Date | null;
}

// Thresholds — deliberately conservative and named so every gate in the app
// reads the same bar instead of each page inventing its own number.
export const MATURITY_THRESHOLDS = {
  /** Minimum complete calendar months before Business Health / Cashflow Risk
   *  / Forecast are allowed to compute a real answer instead of "Learning". */
  MIN_COMPLETE_MONTHS_FOR_HEALTH: 1,
  /** Monthly Comparison needs two comparable complete months (spec §24). */
  MIN_COMPLETE_MONTHS_FOR_COMPARISON: 2,
  /** Analytics' deeper sections unlock progressively (spec §25). */
  MIN_COMPLETE_MONTHS_FOR_PATTERNS: 3,
} as const;

export async function getDataMaturity(userId: string): Promise<DataMaturity> {
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    coverage,
    checkpointCount,
    expectedPendingCount,
    recurringActiveCount,
    user,
    completeMonthRows,
    hasCsvTx,
    hasManualTx,
  ] = await Promise.all([
    // Deliberately not analytics-engine's getDataCoverage() — that also
    // computes a localized rangeLabel via next-intl's getLocale(), which
    // only works inside a real request context. Data maturity only ever
    // needs the raw count/earliest/latest, so query for exactly that.
    prisma.transaction.aggregate({
      where: { userId },
      _count: { id: true },
      _min: { transactionDate: true },
      _max: { transactionDate: true },
    }),
    prisma.cashBalanceCheckpoint.count({ where: { userId } }),
    prisma.expectedPayment.count({ where: { userId, status: "pending" } }),
    prisma.recurringExpense.count({ where: { userId, isActive: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { businessSpendingEstimate: true, personalSpendingEstimate: true } }),
    // "Complete" = every month strictly before the current one that has at
    // least one tracked transaction — the current calendar month is always
    // partial, no matter how much activity happened in it so far.
    prisma.monthlyAnalytics.count({
      where: {
        userId,
        OR: [
          { year: { lt: currentMonthStart.getUTCFullYear() } },
          {
            year: currentMonthStart.getUTCFullYear(),
            month: { lt: currentMonthStart.getUTCMonth() + 1 },
          },
        ],
      },
    }),
    prisma.transaction.findFirst({ where: { userId, csvImportId: { not: null } }, select: { id: true } }),
    prisma.transaction.findFirst({ where: { userId, csvImportId: null }, select: { id: true } }),
  ]);

  const dataSources: Array<"manual" | "csv"> = [
    ...(hasManualTx ? (["manual"] as const) : []),
    ...(hasCsvTx ? (["csv"] as const) : []),
  ];

  const earliest = coverage._min.transactionDate;
  const latest = coverage._max.transactionDate;

  return {
    historyDays: earliest
      ? Math.max(0, Math.round((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)))
      : 0,
    completeMonths: completeMonthRows,
    transactionCount: coverage._count.id,
    hasCurrentCash: checkpointCount > 0,
    hasExpectedIncome: expectedPendingCount > 0,
    hasRecurringExpenses: recurringActiveCount > 0,
    hasSpendingEstimate: user?.businessSpendingEstimate != null || user?.personalSpendingEstimate != null,
    dataSources,
    earliestTransactionDate: earliest,
    latestTransactionDate: latest,
  };
}

// The three states every insight in the app must be capable of rendering as
// (spec section 16). "known" = computed straight from factual data. "learning"
// = not enough reliable history for that specific insight yet — the caller
// decides which threshold applies (health/comparison/patterns all differ).
export type MaturityState = "known" | "estimated" | "learning";

export interface CashRunway {
  months: number | null; // null = no current cash set, or no burn figure available at all yet
  monthlySpend: number;
  source: "estimated" | "calculated" | null;
  basedOnMonths: number; // only meaningful when source === "calculated"
}

// Deliberately distinct from src/lib/runway-engine.ts's getRunway(), which
// answers a different question ("how many months does my Project pipeline
// cover") and is gated on having used the milestone tracker at all. This one
// only exists because a manual-entry user now has a real declared cash
// figure (spec section 3) — "how many months does what I actually have
// cover, at my actual spending rate." Two different questions, two
// different cards, never merged (spec section 27: "never silently switch
// between assumptions without explaining the source").
//
// Account-aware (fixes the Business/Personal/All filter tabs used to show
// the exact same runway everywhere): the spend basis used to be one global
// manualSpendingEstimate, and the observed-history branch always read the
// all-accounts MonthlyAnalytics table no matter which account was
// selected. Now: pass a real Account id to get that one account's own
// history/estimate; omit it for "All accounts" (or for a user who shares
// one account for everything, where a split would be fictional).
export async function getCashRunway(userId: string, accountId?: string | null): Promise<CashRunway> {
  const [position, user, maturity, account] = await Promise.all([
    getCurrentCashPosition(userId, accountId),
    prisma.user.findUnique({ where: { id: userId }, select: { businessSpendingEstimate: true, personalSpendingEstimate: true } }),
    getDataMaturity(userId),
    accountId ? prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }) : null,
  ]);

  // Gates on whether the user has set up cash tracking AT ALL (a checkpoint
  // exists somewhere), not whether THIS specific account has its own
  // checkpoint — the Personal manual account deliberately never gets one
  // (there's no "personal starting balance" question), so gating on
  // position.hasCheckpoint here would silently zero out Personal's runway
  // even for a user who's fully set up and has a real personal cash figure
  // (0 + owner-pay transfers - personal spending) to divide by.
  if (!maturity.hasCurrentCash) {
    return { months: null, monthlySpend: 0, source: null, basedOnMonths: 0 };
  }

  const accountKind: "business" | "personal" | null =
    account?.name === "Business (manual)" ? "business" : account?.name === "Personal (manual)" ? "personal" : null;

  if (maturity.completeMonths >= 1) {
    const lookback = Math.min(maturity.completeMonths, 3);
    const now = new Date();

    if (accountId) {
      // One account's own observed spend — mirrors analytics-engine.ts's
      // computeByMonthForAccount pattern (per-account monthly aggregation
      // computed directly from Transaction rows, since MonthlyAnalytics
      // itself has no accountId column to filter by).
      const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (lookback + 1), 1));
      const txs = await prisma.transaction.findMany({
        where: { userId, accountId, transactionType: "expense", transactionDate: { gte: rangeStart } },
        select: { transactionDate: true, amount: true },
      });
      const byMonth = new Map<string, number>();
      for (const tx of txs) {
        const key = `${tx.transactionDate.getUTCFullYear()}-${tx.transactionDate.getUTCMonth()}`;
        byMonth.set(key, (byMonth.get(key) ?? 0) + Number(tx.amount));
      }
      const currentKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
      const complete = [...byMonth.entries()]
        .filter(([key]) => key !== currentKey)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, lookback);
      const monthlySpend = complete.length > 0 ? complete.reduce((s, [, v]) => s + v, 0) / complete.length : 0;
      return {
        months: monthlySpend > 0 ? position.amount / monthlySpend : null,
        monthlySpend,
        source: "calculated",
        basedOnMonths: complete.length,
      };
    }

    // "All accounts" — the original all-transactions MonthlyAnalytics path,
    // unchanged, and still correct: it already covers every account.
    const rows = await prisma.monthlyAnalytics.findMany({
      where: { userId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: lookback + 1,
    });
    const complete = rows.filter((r) => !(r.year === now.getUTCFullYear() && r.month === now.getUTCMonth() + 1)).slice(0, lookback);
    const monthlySpend = complete.length > 0 ? complete.reduce((s, r) => s + Number(r.totalExpenses), 0) / complete.length : 0;
    return {
      months: monthlySpend > 0 ? position.amount / monthlySpend : null,
      monthlySpend,
      source: "calculated",
      basedOnMonths: complete.length,
    };
  }

  const business = user?.businessSpendingEstimate != null ? Number(user.businessSpendingEstimate) : null;
  const personal = user?.personalSpendingEstimate != null ? Number(user.personalSpendingEstimate) : null;
  const combined = (business ?? 0) + (personal ?? 0);
  const estimate = accountKind === "business" ? business : accountKind === "personal" ? personal : (combined > 0 ? combined : null);

  if (estimate && estimate > 0) {
    return { months: position.amount / estimate, monthlySpend: estimate, source: "estimated", basedOnMonths: 0 };
  }

  return { months: null, monthlySpend: 0, source: null, basedOnMonths: 0 };
}
