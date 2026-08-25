import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recalculateMonthlyAnalytics } from "./analytics-engine";
import { generateForecast } from "./forecast-engine";
import { expectedPaymentDisplayName } from "./upcoming-item";
import { getOrCreateManualAccount } from "./manual-accounts";

// "Money you expect to receive" — deliberately its own standalone model, not
// Project/Milestone. Self-reported from the start (never claims Stripe/CSV-
// grade verification), so marking one "received" doesn't compromise any
// existing trust boundary the way extending Milestone.status would have.

export async function getExpectedPayments(userId: string) {
  return prisma.expectedPayment.findMany({
    where: { userId, status: "pending" },
    orderBy: { expectedDate: "asc" },
  });
}

export async function markReceived(
  userId: string,
  expectedPaymentId: string,
  options?: { actualAmount?: number; receivedDate?: Date },
) {
  const expected = await prisma.expectedPayment.findFirst({ where: { id: expectedPaymentId, userId } });
  if (!expected) throw new Error("Expected payment not found");
  if (expected.status !== "pending") throw new Error("Expected payment is already resolved");

  const amount = options?.actualAmount ?? Number(expected.amount);
  // UTC midnight, matching parseDate()'s convention for every CSV-imported
  // transaction (not new Date(), which carries the current time-of-day).
  const now = new Date();
  const date = options?.receivedDate ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // A client payment always belongs to the business (see today-facts.ts's
  // own comment on this convention) — without a real accountId here, this
  // income is invisible to every scoped Current Cash view (Business,
  // Personal, and "All accounts" while separated all filter by accountId)
  // even though it's correctly counted in MonthlyAnalytics, so cash and
  // "money in this month" silently disagree the moment a payment lands.
  const businessAccount = await getOrCreateManualAccount(userId, "business");

  // Wrapped so a double-click or a client retry after a slow/timed-out first
  // response can't both pass the "still pending" check before either write
  // commits — the re-check happens against the transaction's own isolated
  // view, and the second caller's update simply affects 0 rows instead of
  // silently creating a second income transaction for the same payment.
  const tx = await prisma.$transaction(async (txClient) => {
    const current = await txClient.expectedPayment.findUniqueOrThrow({ where: { id: expectedPaymentId } });
    if (current.status !== "pending") throw new Error("Expected payment is already resolved");

    const created = await txClient.transaction.create({
      data: {
        userId,
        accountId: businessAccount.id,
        transactionDate: date,
        description: expectedPaymentDisplayName(expected.clientName, expected.projectName),
        amount: new Decimal(amount),
        transactionType: "income",
        category: "client payment",
        categoryConfidence: "high",
        categorySource: "user-manual",
      },
    });

    const updated = await txClient.expectedPayment.updateMany({
      where: { id: expectedPaymentId, status: "pending" },
      data: { status: "received", receivedTransactionId: created.id },
    });
    if (updated.count === 0) throw new Error("Expected payment is already resolved");

    return created;
  });

  await recalculateMonthlyAnalytics(userId);
  await generateForecast(userId);

  return tx;
}

export async function cancelExpectedPayment(userId: string, expectedPaymentId: string) {
  const expected = await prisma.expectedPayment.findFirst({ where: { id: expectedPaymentId, userId } });
  if (!expected) throw new Error("Expected payment not found");
  return prisma.expectedPayment.update({ where: { id: expectedPaymentId }, data: { status: "cancelled" } });
}
