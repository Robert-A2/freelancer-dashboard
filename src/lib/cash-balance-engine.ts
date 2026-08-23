import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { OWNER_PAY_OUT_CATEGORY, OWNER_PAY_IN_CATEGORY } from "./manual-accounts";

export interface CashPosition {
  amount: number;
  hasCheckpoint: boolean;
  asOfCheckpoint: Date | null;
  netSinceCheckpoint: number;
}

// The one place a Transaction's effect on cash-in-this-account is decided.
// Income adds, expense subtracts — same as always. A transfer only affects
// cash here when it's one of the two owner-pay categories (recordOwnerPay in
// manual-accounts.ts); any other transfer (e.g. from a CSV import — "moved
// to savings", "paid credit card") is left at 0 here exactly as before this
// function learned about owner-pay, so nothing already relying on transfers
// being cash-neutral changes underneath it.
function cashEffect(tx: { amount: unknown; transactionType: string; category: string }): number {
  const amt = Number(tx.amount);
  if (tx.transactionType === "income") return amt;
  if (tx.transactionType === "expense") return -amt;
  if (tx.transactionType === "transfer" && tx.category === OWNER_PAY_IN_CATEGORY) return amt;
  if (tx.transactionType === "transfer" && tx.category === OWNER_PAY_OUT_CATEGORY) return -amt;
  return 0;
}

async function computeFromCheckpoint(
  checkpoint: { amount: Decimal; effectiveDate: Date } | null,
  userId: string,
  accountId: string | null,
): Promise<CashPosition> {
  if (!checkpoint) {
    // Same figure the Dashboard's chartData.reduce((s,d)=>s+d.cashflow,0)
    // already produces for the no-account case — every MonthPoint's
    // cashflow is either a real MonthlyAnalytics.netCashflow or a filled
    // zero for a gap month, so summing the real rows directly is
    // mathematically identical. For a specific account with no checkpoint
    // (the Personal manual account — there is no "personal starting
    // balance" question, it honestly starts at zero) this sums that
    // account's own transactions instead, owner-pay transfers included.
    if (accountId) {
      const rows = await prisma.transaction.findMany({
        where: { userId, accountId },
        select: { amount: true, transactionType: true, category: true },
      });
      const amount = rows.reduce((sum, tx) => sum + cashEffect(tx), 0);
      return { amount, hasCheckpoint: false, asOfCheckpoint: null, netSinceCheckpoint: 0 };
    }
    const agg = await prisma.monthlyAnalytics.aggregate({ where: { userId }, _sum: { netCashflow: true } });
    const amount = Number(agg._sum.netCashflow ?? 0);
    return { amount, hasCheckpoint: false, asOfCheckpoint: null, netSinceCheckpoint: 0 };
  }

  // Compare by calendar day, not exact timestamp: a checkpoint set today
  // (effectiveDate carries the exact time it was created) must still count
  // today's own manually-entered expenses, whose transactionDate is stored
  // at UTC midnight per this app's date convention — an exact-timestamp
  // comparison would wrongly exclude same-day activity entered afterward.
  const checkpointDay = new Date(Date.UTC(
    checkpoint.effectiveDate.getUTCFullYear(),
    checkpoint.effectiveDate.getUTCMonth(),
    checkpoint.effectiveDate.getUTCDate(),
  ));

  const sinceTxs = await prisma.transaction.findMany({
    where: {
      userId,
      transactionDate: { gte: checkpointDay },
      ...(accountId ? { accountId } : {}),
    },
    select: { amount: true, transactionType: true, category: true },
  });

  const netSinceCheckpoint = sinceTxs.reduce((sum, tx) => sum + cashEffect(tx), 0);

  return {
    amount: Number(checkpoint.amount) + netSinceCheckpoint,
    hasCheckpoint: true,
    asOfCheckpoint: checkpoint.effectiveDate,
    netSinceCheckpoint,
  };
}

// Reads the user's current cash position.
//
// Shared-account users (accountsSeparated false, or never answered — the
// same behavior every existing user already has): exactly ONE checkpoint
// (accountId null in the DB), the same honest number in every filter view,
// because it genuinely is one pool of money.
//
// Separated-account users: Business has its own real checkpoint (the
// "Business cash available today" onboarding question). Personal has no
// starting-balance question — there is no honest "personal starting cash"
// to ask for — so it starts at zero and only ever moves via a recorded
// owner-pay transfer or a transaction someone explicitly tagged personal
// income, never by inheriting Business's balance or by receiving client
// money directly (an expected/received client payment always lands in
// Business — see today-facts.ts and money-breakdown.ts). "All accounts"
// sums Business + Personal, which self-corrects for any owner-pay transfer
// between them (it subtracts from one and adds to the other, netting to
// zero) — so it always equals the freelancer's true total, exactly as
// moving money between your own buckets should never change your net worth.
export async function getCurrentCashPosition(userId: string, accountId?: string | null): Promise<CashPosition> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountsSeparated: true } });
  const separated = user?.accountsSeparated === true;

  if (!separated) {
    const checkpoint = await prisma.cashBalanceCheckpoint.findFirst({ where: { userId, accountId: null }, orderBy: { effectiveDate: "desc" } });
    return computeFromCheckpoint(checkpoint, userId, null);
  }

  if (accountId) {
    const checkpoint = await prisma.cashBalanceCheckpoint.findFirst({ where: { userId, accountId }, orderBy: { effectiveDate: "desc" } });
    return computeFromCheckpoint(checkpoint, userId, accountId);
  }

  // "All accounts" while separated.
  const [businessAccount, personalAccount] = await Promise.all([
    prisma.account.findUnique({ where: { userId_name: { userId, name: "Business (manual)" } } }),
    prisma.account.findUnique({ where: { userId_name: { userId, name: "Personal (manual)" } } }),
  ]);
  const accounts = [businessAccount, personalAccount].filter((a): a is NonNullable<typeof a> => a != null);
  if (accounts.length === 0) {
    const checkpoint = await prisma.cashBalanceCheckpoint.findFirst({ where: { userId, accountId: null }, orderBy: { effectiveDate: "desc" } });
    return computeFromCheckpoint(checkpoint, userId, null);
  }
  const positions = await Promise.all(accounts.map(async (a) => {
    const checkpoint = await prisma.cashBalanceCheckpoint.findFirst({ where: { userId, accountId: a.id }, orderBy: { effectiveDate: "desc" } });
    return computeFromCheckpoint(checkpoint, userId, a.id);
  }));
  return {
    amount: positions.reduce((s, p) => s + p.amount, 0),
    hasCheckpoint: positions.some((p) => p.hasCheckpoint),
    asOfCheckpoint: positions.map((p) => p.asOfCheckpoint).filter((d): d is Date => d != null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    netSinceCheckpoint: positions.reduce((s, p) => s + p.netSinceCheckpoint, 0),
  };
}

// Append-only — never updates an existing row, so "Edit balance" is an
// honest adjustment on top of history, not a silent overwrite of it.
// accountId: pass a real Account id when the user keeps separate accounts
// (one checkpoint per account); omit/null for the shared-account case
// (spec: onboarding's money-separation question).
export async function recordBalanceCheckpoint(
  userId: string,
  amount: number,
  source: "manual-entry" | "user-correction",
  note?: string,
  accountId?: string | null,
) {
  return prisma.cashBalanceCheckpoint.create({
    data: { userId, accountId: accountId ?? null, amount: new Decimal(amount), source, note: note ?? null },
  });
}
