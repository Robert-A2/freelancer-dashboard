import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import type { AccountType } from "@prisma/client";

const MANUAL_ACCOUNTS: Record<"business" | "personal", { name: string; accountType: AccountType }> = {
  business: { name: "Business (manual)", accountType: "business_checking" },
  personal: { name: "Personal (manual)", accountType: "personal_checking" },
};

// Idempotently finds or creates the auto-provisioned Account a manually-
// entered transaction/recurring-expense belongs to — reuses the EXISTING
// Account/accountType mechanism for the Business/Personal split (the same
// one CsvUploader.tsx's account-selection step already uses), rather than a
// new flag on Transaction.
export async function getOrCreateManualAccount(userId: string, tag: "business" | "personal") {
  const { name, accountType } = MANUAL_ACCOUNTS[tag];
  const existing = await prisma.account.findUnique({ where: { userId_name: { userId, name } } });
  if (existing) return existing;
  return prisma.account.create({ data: { userId, name, accountType } });
}

// The one place any code asks "is this account the Business or Personal
// manual account" — used by cash-balance-engine, today-facts, data-maturity,
// and money-breakdown to decide what a selected Dashboard filter tab means,
// so that answer can never drift between them.
export async function getManualAccountKind(accountId: string | null | undefined): Promise<"business" | "personal" | null> {
  if (!accountId) return null;
  const acct = await prisma.account.findUnique({ where: { id: accountId }, select: { name: true } });
  if (acct?.name === MANUAL_ACCOUNTS.business.name) return "business";
  if (acct?.name === MANUAL_ACCOUNTS.personal.name) return "personal";
  return null;
}

// ── "Pay yourself" — a transfer between the freelancer's own two buckets,
// not a new business expense or new personal income in the economic sense.
// Recorded as transactionType "transfer" on both legs specifically because
// recalculateMonthlyAnalytics() already excludes that type from income/
// expense totals (see analytics-engine.ts) — so this can never distort
// Business Health, Cashflow Risk, or the Forecast just by existing. The
// category values below ("owner_pay_out"/"owner_pay_in") are how
// cash-balance-engine.ts recognizes which direction a transfer moves cash,
// scoped to only these two categories so no other transfer transaction
// (e.g. from a CSV import) is reinterpreted by accident. ──────────────────
const OWNER_PAY_OUT_CATEGORY = "owner_pay_out";
const OWNER_PAY_IN_CATEGORY = "owner_pay_in";

export { OWNER_PAY_OUT_CATEGORY, OWNER_PAY_IN_CATEGORY };

export async function recordOwnerPay(userId: string, amount: number, date?: Date) {
  const [businessAccount, personalAccount] = await Promise.all([
    getOrCreateManualAccount(userId, "business"),
    getOrCreateManualAccount(userId, "personal"),
  ]);
  const transactionDate = date ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  const [outTx, inTx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        accountId: businessAccount.id,
        transactionDate,
        // Both legs deliberately share the "Pay yourself" phrase (the exact
        // feature name from the +Add menu) so they read as one recognizable
        // action in History, not two unrelated "Transfer..." rows — see the
        // audit's own finding on this.
        description: "Pay yourself — to personal",
        amount: new Decimal(amount),
        transactionType: "transfer",
        category: OWNER_PAY_OUT_CATEGORY,
        categoryConfidence: "high",
        categorySource: "owner-pay",
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        accountId: personalAccount.id,
        transactionDate,
        description: "Pay yourself — from business",
        amount: new Decimal(amount),
        transactionType: "transfer",
        category: OWNER_PAY_IN_CATEGORY,
        categoryConfidence: "high",
        categorySource: "owner-pay",
      },
    }),
  ]);

  return { outTx, inTx };
}
