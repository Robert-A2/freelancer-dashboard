import { prisma } from "./prisma";

// Step 1 (current cash) is required, so completing onboarding always leaves
// behind a CashBalanceCheckpoint — that alone is what stops onboarding from
// being shown again, no separate "onboarding complete" flag needed. A user
// who abandons onboarding before finishing Step 1 correctly sees it again
// next visit (spec section 4: "no CSV history, no manual financial setup").
export async function needsOnboarding(userId: string): Promise<boolean> {
  const [txCount, checkpointCount] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.cashBalanceCheckpoint.count({ where: { userId } }),
  ]);
  return txCount === 0 && checkpointCount === 0;
}
