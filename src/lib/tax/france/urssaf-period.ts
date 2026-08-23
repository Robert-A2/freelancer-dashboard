import { prisma } from "../../prisma";
import { Prisma } from "@prisma/client";
import type { FranceMicroReserveResult } from "./calculate-reserve";

// ── Urssaf reserved / paid / outstanding (Tax & Contributions spec sections
// 26-27) ─────────────────────────────────────────────────────────────────
// "A reserve represents obligations that have not yet been paid. When the
// freelancer eventually pays Urssaf, Nonodia must not continue protecting
// that same amount forever."
//
// Deliberately a simple running balance, not a period-by-period ledger:
//   outstanding = (everything ever reserved) − (everything ever paid)
// Every income transaction's own taxReserveSnapshot already records exactly
// what was reserved for it at the time (spec section 33) — this just sums
// those, and subtracts every expense the user has tagged intent:"tax_payment"
// (reused as-is from the existing Intent Layer, spec section 27's "reuse the
// existing Expense system" — no new matching logic). Simpler than tracking
// period boundaries, and mathematically equivalent for what the spec's own
// worked example needs: reserve grows with new income, drops when paid,
// never silently keeps growing forever.

export interface UrssafPeriodStatus {
  frequency: "monthly" | "quarterly";
  reserved: number;
  paid: number;
  outstanding: number;
}

// Only meaningful once the user has told us how often they declare — never
// shown, never computed, until urssafFrequency is actually set (spec: "Do
// not make this required if the user does not know").
export async function getUrssafPeriodStatus(userId: string): Promise<UrssafPeriodStatus | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { urssafFrequency: true } });
  if (user?.urssafFrequency !== "monthly" && user?.urssafFrequency !== "quarterly") return null;
  const frequency = user.urssafFrequency;

  const [reservedRows, paidAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, transactionType: "income", taxReserveSnapshot: { not: Prisma.DbNull } },
      select: { taxReserveSnapshot: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, transactionType: "expense", intent: "tax_payment" },
      _sum: { amount: true },
    }),
  ]);

  const reserved = reservedRows.reduce((sum, row) => {
    const snapshot = row.taxReserveSnapshot as unknown as FranceMicroReserveResult | null;
    return sum + (snapshot?.knownMandatoryReserve ?? 0);
  }, 0);
  const paid = Number(paidAgg._sum.amount ?? 0);
  const outstanding = Math.round((reserved - paid) * 100) / 100;

  return {
    frequency,
    reserved: Math.round(reserved * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    outstanding,
  };
}
