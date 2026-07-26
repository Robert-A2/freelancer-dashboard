import { prisma } from "./prisma";
import { getFinancialReserve } from "./reserve-engine";

// ── Cash Runway ─────────────────────────────────────────────────────────────
// "If every client I'm waiting on pays on schedule, how many months of my
// spending does that cover?" Not the classic "cash-in-bank ÷ burn" runway —
// this app only ever sees transaction flows, never an actual bank balance,
// and no amount of CSV or Project data can reconstruct one (a freelancer
// could have €50k in paid projects already spent, or €20k saved with zero
// active work — the two numbers are unrelated). This answers a narrower,
// fully-automatic question instead: of the income already confirmed or
// requested through Projects, how many months of real spending does that
// cover — after the tax you'll owe on it, not the gross amount, since gross
// was never actually yours to spend.

export interface RunwaySummary {
  grossPipelineValue: number;
  netPipelineValue: number;
  taxReservePct: number;
  pipelineCount: number;
  avgMonthlyBurn: number;
  coverageMonths: number | null; // null = not enough expense history yet to compare against
}

export async function getRunway(userId: string): Promise<RunwaySummary | null> {
  const hasAnyProject = (await prisma.project.count({ where: { userId } })) > 0;
  if (!hasAnyProject) return null; // never used the milestone tracker — empty state, not a fabricated "0 months"

  const [outstanding, reserve] = await Promise.all([
    prisma.milestone.aggregate({
      where: { userId, status: { in: ["pending", "sent"] } },
      _sum: { amount: true },
      _count: true,
    }),
    getFinancialReserve(userId),
  ]);

  const grossPipelineValue = Number(outstanding._sum.amount ?? 0);
  const pipelineCount = outstanding._count;
  const taxReservePct = reserve.estimatedReservePct;
  const netPipelineValue = grossPipelineValue * (1 - taxReservePct / 100);

  // Burn rate: average of the last 3 calendar months' expenses (tax payments
  // included — this is real cash leaving the account regardless of what it
  // was for).
  const now = new Date();
  const threeMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const recentExpenses = await prisma.transaction.findMany({
    where: { userId, transactionType: "expense", transactionDate: { gte: threeMonthsAgo } },
    select: { amount: true, transactionDate: true },
  });

  const byMonth = new Map<string, number>();
  for (const tx of recentExpenses) {
    const key = `${tx.transactionDate.getUTCFullYear()}-${tx.transactionDate.getUTCMonth()}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(tx.amount));
  }
  const monthTotals = [...byMonth.values()];
  const avgMonthlyBurn = monthTotals.length > 0 ? monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length : 0;

  const coverageMonths = avgMonthlyBurn > 0 ? netPipelineValue / avgMonthlyBurn : null;

  return { grossPipelineValue, netPipelineValue, taxReservePct, pipelineCount, avgMonthlyBurn, coverageMonths };
}
