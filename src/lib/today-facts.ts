import { prisma } from "./prisma";
import { getCurrentCashPosition } from "./cash-balance-engine";
import { getManualAccountKind, OWNER_PAY_IN_CATEGORY, OWNER_PAY_OUT_CATEGORY } from "./manual-accounts";
import type { UpcomingItem, CashWindowBucket } from "./upcoming-item";
import { expectedPaymentDisplayName, bucketUpcomingByWindow } from "./upcoming-item";

// Re-exported so existing server-side importers (dashboard/page.tsx,
// forecast/page.tsx, TodayLayer.tsx) don't need a second import line — but
// any CLIENT component must import these from "./upcoming-item" directly,
// never from this file (this file pulls in prisma at module scope, which
// breaks the browser bundle — see upcoming-item.ts's own comment).
export type { UpcomingItem } from "./upcoming-item";

// The single source of "what do I have and what happened" facts (spec
// sections 10-14, 30) — read by both the Dashboard's factual Today layer and
// Quick Add's post-save reward. Deliberately not a second analytics engine:
// money-in/out reuses the exact MonthlyAnalytics rows recalculateMonthlyAnalytics
// already maintains on every transaction write (CSV or manual), so this file
// only adds the pieces that genuinely don't exist yet — current cash,
// commitments, reserve, and upcoming money.

export interface TodayFacts {
  currentCash: number;
  hasCurrentCash: boolean;
  moneyInThisMonth: number;
  moneyOutThisMonth: number;
  knownCommitmentsMonthly: number;
  reserved: number | null;
  spendingByCategoryThisMonth: Array<{ category: string; amount: number }>;
  upcoming: UpcomingItem[];
}

// A RecurringExpense's next occurrence from today: this month's dayOfMonth if
// it hasn't passed yet, otherwise next month's — mirrors clampDayOfMonth's
// short-month handling in recurring-expense-engine.ts.
function nextOccurrence(dayOfMonth: number, now: Date): Date {
  const daysInCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const clampedThisMonth = Math.min(dayOfMonth, daysInCurrentMonth);
  const thisMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), clampedThisMonth));
  if (thisMonthDate.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    return thisMonthDate;
  }
  const daysInNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0)).getUTCDate();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, Math.min(dayOfMonth, daysInNextMonth)));
}

// Every occurrence of a recurring expense between `now` and `now + horizonDays`
// — unlike nextOccurrence() above (which getTodayFacts()'s "what's next" list
// intentionally wants capped at one), a 30/60/90-day cash window would
// silently understate a monthly expense's real impact past its first
// occurrence if it only ever projected one date.
function occurrencesWithin(dayOfMonth: number, now: Date, horizonDays: number): Date[] {
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const dates: Date[] = [];
  let cursor = nextOccurrence(dayOfMonth, now);
  while (cursor.getTime() <= horizon.getTime()) {
    dates.push(cursor);
    // Walk to the following month's clamped occurrence from just past this one.
    const dayAfter = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    cursor = nextOccurrence(dayOfMonth, dayAfter);
  }
  return dates;
}

// The real, un-truncated feed behind the 30/60/90-day cash view (spec: don't
// crowd the Dashboard's Today layer with this — it's a Forecast-page card).
// Reuses the exact same expected-payment/recurring-expense sources as
// getTodayFacts(), just without that function's `take: 5` / single-occurrence
// limits, which exist for a different job (a short "what's next" list).
export async function getUpcomingCashWindow(userId: string, accountId?: string | null): Promise<CashWindowBucket[]> {
  const now = new Date();
  const horizonDays = 90;
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const accountKind = await getManualAccountKind(accountId);
  const showExpectedPayments = accountKind !== "personal";

  const [recurringExpenses, expectedPending] = await Promise.all([
    prisma.recurringExpense.findMany({ where: { userId, isActive: true, ...(accountId ? { accountId } : {}) } }),
    showExpectedPayments
      ? prisma.expectedPayment.findMany({
          where: { userId, status: "pending", expectedDate: { lte: horizon } },
          orderBy: { expectedDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const items: UpcomingItem[] = [
    ...expectedPending.map((e) => ({
      kind: "expected_income" as const,
      id: e.id,
      label: expectedPaymentDisplayName(e.clientName, e.projectName),
      clientName: e.clientName,
      projectName: e.projectName,
      amount: Number(e.amount),
      date: e.expectedDate,
    })),
    ...recurringExpenses.flatMap((r) =>
      occurrencesWithin(r.dayOfMonth, now, horizonDays).map((date, i) => ({
        kind: "recurring_expense" as const,
        id: `${r.id}-${i}`,
        label: r.merchantName,
        amount: Number(r.amount),
        date,
      }))
    ),
  ];

  return bucketUpcomingByWindow(items, now);
}

export async function getTodayFacts(userId: string, accountId?: string | null): Promise<TodayFacts> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthStart = new Date(Date.UTC(year, now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(year, now.getUTCMonth() + 1, 1));

  // A client payment — expected or already received — always belongs to
  // the business. Before it arrives it's Business's "Coming Up"; once
  // received it's Business cash, never Personal, unless and until the
  // freelancer explicitly records an owner-pay transfer to move some of it
  // across. So the Personal view's upcoming list never includes expected
  // client payments — only its own recurring commitments.
  const accountKind = await getManualAccountKind(accountId);
  const showExpectedPayments = accountKind !== "personal";

  const [position, monthRow, recurringExpenses, taxReserveUser, expensesThisMonth, expectedPending] = await Promise.all([
    getCurrentCashPosition(userId, accountId),
    accountId ? null : prisma.monthlyAnalytics.findUnique({ where: { userId_month_year: { userId, month, year } } }),
    prisma.recurringExpense.findMany({ where: { userId, isActive: true, ...(accountId ? { accountId } : {}) } }),
    prisma.user.findUnique({ where: { id: userId }, select: { manualTaxReserveAmount: true } }),
    prisma.transaction.findMany({
      where: {
        userId,
        transactionType: "expense",
        transactionDate: { gte: monthStart, lt: monthEnd },
        ...(accountId ? { accountId } : {}),
      },
      select: { category: true, amount: true },
    }),
    showExpectedPayments
      ? prisma.expectedPayment.findMany({ where: { userId, status: "pending" }, orderBy: { expectedDate: "asc" }, take: 5 })
      : Promise.resolve([]),
  ]);

  // When filtering by account, MonthlyAnalytics has no per-account rollup —
  // sum the current month's transactions for that account directly instead.
  // Owner-pay transfers count as real money in/out for THIS account's own
  // month-to-date view (an owner-pay is genuinely money that arrived in
  // Personal, or genuinely left Business, this month) even though they're
  // excluded from business P&L (analytics-engine.ts never counts transfers).
  let moneyInThisMonth = 0;
  let moneyOutThisMonth = 0;
  if (accountId) {
    const txs = await prisma.transaction.findMany({
      where: { userId, accountId, transactionDate: { gte: monthStart, lt: monthEnd } },
      select: { amount: true, transactionType: true, category: true },
    });
    for (const tx of txs) {
      const amt = Number(tx.amount);
      if (tx.transactionType === "income") moneyInThisMonth += amt;
      else if (tx.transactionType === "expense") moneyOutThisMonth += amt;
      else if (tx.transactionType === "transfer" && tx.category === OWNER_PAY_IN_CATEGORY) moneyInThisMonth += amt;
      else if (tx.transactionType === "transfer" && tx.category === OWNER_PAY_OUT_CATEGORY) moneyOutThisMonth += amt;
    }
  } else {
    moneyInThisMonth = Number(monthRow?.totalIncome ?? 0);
    moneyOutThisMonth = Number(monthRow?.totalExpenses ?? 0);
  }

  const categoryTotals = new Map<string, number>();
  for (const tx of expensesThisMonth) {
    categoryTotals.set(tx.category, (categoryTotals.get(tx.category) ?? 0) + Number(tx.amount));
  }
  const spendingByCategoryThisMonth = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const upcoming: UpcomingItem[] = [
    ...expectedPending.map((e) => ({
      kind: "expected_income" as const,
      id: e.id,
      label: expectedPaymentDisplayName(e.clientName, e.projectName),
      clientName: e.clientName,
      projectName: e.projectName,
      amount: Number(e.amount),
      date: e.expectedDate,
    })),
    ...recurringExpenses.map((r) => ({
      kind: "recurring_expense" as const,
      id: r.id,
      label: r.merchantName,
      amount: Number(r.amount),
      date: nextOccurrence(r.dayOfMonth, now),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    currentCash: position.amount,
    hasCurrentCash: position.hasCheckpoint,
    moneyInThisMonth,
    moneyOutThisMonth,
    knownCommitmentsMonthly: recurringExpenses.reduce((s, r) => s + Number(r.amount), 0),
    reserved: taxReserveUser?.manualTaxReserveAmount != null ? Number(taxReserveUser.manualTaxReserveAmount) : null,
    spendingByCategoryThisMonth,
    upcoming,
  };
}
