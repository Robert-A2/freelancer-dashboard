import { prisma } from "./prisma";
import { recalculateMonthlyAnalytics } from "./analytics-engine";
import { generateForecast } from "./forecast-engine";

// Clamps a declared day-of-month (RecurringExpense.dayOfMonth is constrained
// to 1-28 at the form level, so every month already has enough days — this
// is kept as an explicit named step so a future relaxation of that 1-28
// constraint doesn't silently produce an invalid date, e.g. day 30 in Feb).
export function clampDayOfMonth(year: number, monthIndex0: number, day: number): Date {
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const clamped = Math.min(Math.max(day, 1), daysInMonth);
  return new Date(Date.UTC(year, monthIndex0, clamped));
}

// Materializes every active RecurringExpense into real Transaction rows, one
// per elapsed month since it was declared — this is what makes a declared
// recurring expense indistinguishable to analytics-engine.ts/forecast-engine.ts/
// intelligence-engine.ts from a CSV-imported one: same table, same shape,
// same downstream queries. Idempotent — re-running never creates duplicates
// for a month already covered (checked via Transaction.recurringExpenseId).
export async function syncRecurringExpenses(userId: string): Promise<{ created: number }> {
  const active = await prisma.recurringExpense.findMany({ where: { userId, isActive: true } });
  if (active.length === 0) return { created: 0 };

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const toCreate: Array<{
    recurringExpenseId: string;
    accountId: string;
    merchantName: string;
    category: string;
    amount: import("@prisma/client/runtime/library").Decimal;
    date: Date;
  }> = [];

  for (const re of active) {
    const existing = await prisma.transaction.findMany({
      where: { userId, recurringExpenseId: re.id },
      select: { transactionDate: true },
    });
    const existingMonths = new Set(
      existing.map((t) => `${t.transactionDate.getUTCFullYear()}-${t.transactionDate.getUTCMonth()}`),
    );

    const cursor = new Date(Date.UTC(re.createdAt.getUTCFullYear(), re.createdAt.getUTCMonth(), 1));
    while (cursor <= currentMonthStart) {
      const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`;
      if (!existingMonths.has(key)) {
        toCreate.push({
          recurringExpenseId: re.id,
          accountId: re.accountId,
          merchantName: re.merchantName,
          category: re.category,
          amount: re.amount,
          date: clampDayOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth(), re.dayOfMonth),
        });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  if (toCreate.length === 0) return { created: 0 };

  await prisma.transaction.createMany({
    data: toCreate.map((t) => ({
      userId,
      accountId: t.accountId,
      recurringExpenseId: t.recurringExpenseId,
      transactionDate: t.date,
      description: t.merchantName,
      amount: t.amount,
      transactionType: "expense",
      category: t.category,
      categoryConfidence: "high",
      categorySource: "user-recurring",
    })),
  });

  await recalculateMonthlyAnalytics(userId);
  await generateForecast(userId);

  return { created: toCreate.length };
}
