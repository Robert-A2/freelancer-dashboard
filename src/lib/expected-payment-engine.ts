import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recalculateMonthlyAnalytics } from "./analytics-engine";
import { generateForecast } from "./forecast-engine";
import { expectedPaymentDisplayName } from "./upcoming-item";

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

  const tx = await prisma.transaction.create({
    data: {
      userId,
      transactionDate: date,
      description: expectedPaymentDisplayName(expected.clientName, expected.projectName),
      amount: new Decimal(amount),
      transactionType: "income",
      category: "client payment",
      categoryConfidence: "high",
      categorySource: "user-manual",
    },
  });

  await prisma.expectedPayment.update({
    where: { id: expectedPaymentId },
    data: { status: "received", receivedTransactionId: tx.id },
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
