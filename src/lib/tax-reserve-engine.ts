import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";

// A user-declared flat euro figure — deliberately separate from
// reserve-engine/ (which computes a *percentage* of income via country tax
// rules or manualReservePctOverride). This is just the manual-entry user's
// own number, shown as-is, never derived from or reconciled with that engine.

export async function getManualTaxReserve(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { manualTaxReserveAmount: true } });
  return user?.manualTaxReserveAmount != null ? Number(user.manualTaxReserveAmount) : null;
}

export async function setManualTaxReserve(userId: string, amount: number | null): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { manualTaxReserveAmount: amount === null ? null : new Decimal(amount) },
  });
}
