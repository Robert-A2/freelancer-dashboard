import { prisma } from "@/lib/prisma";

export interface SuspectedTransferPair {
  incomeId:    string;
  expenseId:   string;
  amount:      number;
  date:        string;
  incomeDesc:  string;
  expenseDesc: string;
  incomeAcct:  string;
  expenseAcct: string;
}

const WINDOW_MS  = 5 * 86_400_000; // 5-day window — covers same-day and 2-3 day bank processing delays
const AMOUNT_TOL = 0.02;            // ±2% for FX rounding

/**
 * After a CSV import, scan for inter-account transfer pairs:
 * a positive entry in one account that matches a negative entry of the same
 * amount in another account within 5 days. When found the freelancer moved
 * money between their own accounts — not real income or expense.
 *
 * Checks both directions:
 *   A) New import income  ↔ existing other-account expenses  (e.g. upload BNP after Revolut)
 *   B) New import expenses ↔ existing other-account income   (e.g. upload Revolut after BNP)
 *
 * Returns up to 20 pairs. Returns [] when user has fewer than 2 accounts.
 */
export async function detectCrossAccountTransfers(
  userId:   string,
  importId: string,
): Promise<SuspectedTransferPair[]> {
  const accountsWithTx = await prisma.account.count({
    where: { userId, transactions: { some: {} } },
  });
  if (accountsWithTx < 2) return [];

  // Fetch all new-import transactions that belong to a specific account
  const newTxs = await prisma.transaction.findMany({
    where: {
      csvImportId: importId,
      accountId:   { not: null },
      amount:      { gte: 10 },
      transactionType: { in: ["income", "expense"] },
    },
    select: {
      id: true, amount: true, transactionDate: true,
      description: true, accountId: true, transactionType: true,
      account: { select: { name: true } },
    },
    take: 400,
  });

  if (newTxs.length === 0) return [];

  // All new transactions share the same account (first import per run)
  const importedAccountId = newTxs[0].accountId as string;

  const times   = newTxs.map(t => t.transactionDate.getTime());
  const minDate = new Date(Math.min(...times) - WINDOW_MS);
  const maxDate = new Date(Math.max(...times) + WINDOW_MS);

  // Fetch ALL transactions from OTHER accounts in the date window
  const otherTxs = await prisma.transaction.findMany({
    where: {
      userId,
      transactionType: { in: ["income", "expense"] },
      AND: [
        { accountId: { not: null } },
        { accountId: { not: importedAccountId } },
      ],
      transactionDate: { gte: minDate, lte: maxDate },
      amount:          { gte: 10 },
    },
    select: {
      id: true, amount: true, transactionDate: true,
      description: true, accountId: true, transactionType: true,
      account: { select: { name: true } },
    },
  });

  if (otherTxs.length === 0) return [];

  const usedOtherIds = new Set<string>();
  const pairs: SuspectedTransferPair[] = [];

  for (const tx of newTxs) {
    if (pairs.length >= 20) break;
    const txAmt  = Number(tx.amount);
    const txTime = tx.transactionDate.getTime();

    // A transfer pair is: one income + one expense of the same amount across accounts
    const oppositeType = tx.transactionType === "income" ? "expense" : "income";

    const match = otherTxs.find(other => {
      if (usedOtherIds.has(other.id)) return false;
      if (other.transactionType !== oppositeType) return false;
      const diff    = Math.abs(txAmt - Number(other.amount)) / Math.max(txAmt, 0.01);
      const timeDiff = Math.abs(other.transactionDate.getTime() - txTime);
      return diff < AMOUNT_TOL && timeDiff <= WINDOW_MS;
    });

    if (match) {
      usedOtherIds.add(match.id);
      // Normalise: incomeId always = the income transaction, expenseId = the expense
      const [incTx, expTx] = tx.transactionType === "income"
        ? [tx, match]
        : [match, tx];

      pairs.push({
        incomeId:    incTx.id,
        expenseId:   expTx.id,
        amount:      txAmt,
        date:        tx.transactionDate.toISOString(),
        incomeDesc:  incTx.description,
        expenseDesc: expTx.description,
        incomeAcct:  incTx.account?.name  ?? "Account",
        expenseAcct: expTx.account?.name ?? "Account",
      });
    }
  }

  return pairs;
}
