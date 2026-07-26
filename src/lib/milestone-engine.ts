import { prisma } from "./prisma";
import { isPastDueDate } from "@/utils/dueDate";
import { getFinancialReserve } from "./reserve-engine";

// ── Expected Income ────────────────────────────────────────────────────────
// This is deliberately a SEPARATE read path from analytics-engine.ts /
// forecast-engine.ts — it never touches MonthlyAnalytics or the Forecast
// table, and it never counts a milestone that is "paid"/"cleared" (that money
// already exists as a real Transaction and is already inside cashflow via the
// normal pipeline — counting it here too would double it). This function only
// answers "how much money have I asked for that I don't have yet."

export interface UpcomingMilestone {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  label: string;
  amount: number;
  status: "pending" | "sent";
  dueDate: Date | null;
  isOverdue: boolean;
}

export interface ExpectedIncomeSummary {
  expectedThisMonth: number;
  // Same figure after the estimated tax reserve % (see reserve-engine.ts) is
  // subtracted — what you'll actually keep, not what a client owes you.
  // Deliberately additive: expectedThisMonth stays gross so existing callers
  // (Projects overdue banner, Forecast's ExpectedFromProjectsCard) are unaffected.
  expectedThisMonthNet: number;
  taxReservePct: number;
  expectedCount: number;
  overdueAmount: number;
  overdueCount: number;
  upcoming: UpcomingMilestone[];
}

export async function getExpectedIncome(userId: string): Promise<ExpectedIncomeSummary> {
  const now = new Date();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [milestones, reserve] = await Promise.all([
    prisma.milestone.findMany({
      where: { userId, status: { in: ["pending", "sent"] } },
      include: { project: { select: { id: true, projectName: true, clientName: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    getFinancialReserve(userId),
  ]);

  let expectedThisMonth = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  const upcoming: UpcomingMilestone[] = [];

  for (const m of milestones) {
    const amount = Number(m.amount);
    // "Overdue" is only meaningful once a link has actually been sent — a
    // milestone that was never sent can't be late on a request that was
    // never made.
    const isOverdue = m.status === "sent" && m.dueDate != null && isPastDueDate(m.dueDate, now);
    // An undated milestone has no future date to defer it to, so it always
    // counts as currently expected. A dated milestone counts once its due
    // date arrives (this month) and keeps counting every month after until
    // it's paid — it doesn't quietly drop out of "expected" once its month passes.
    const countsThisMonth = m.dueDate == null || m.dueDate < monthEnd;

    if (isOverdue) {
      overdueAmount += amount;
      overdueCount++;
    }
    if (countsThisMonth) {
      expectedThisMonth += amount;
    }

    upcoming.push({
      id: m.id,
      projectId: m.project.id,
      projectName: m.project.projectName,
      clientName: m.project.clientName,
      label: m.label,
      amount,
      status: m.status as "pending" | "sent",
      dueDate: m.dueDate,
      isOverdue,
    });
  }

  const taxReservePct = reserve.estimatedReservePct;

  return {
    expectedThisMonth,
    expectedThisMonthNet: expectedThisMonth * (1 - taxReservePct / 100),
    taxReservePct,
    expectedCount: milestones.length,
    overdueAmount,
    overdueCount,
    upcoming: upcoming.slice(0, 6),
  };
}

// ── Recently paid ──────────────────────────────────────────────────────────
// The concrete "your client paid" signal — surfaced on the Dashboard so
// getting paid feels like an event, not a silent number change. Covers both
// payment sources (Stripe webhook = "paid", CSV match = "cleared") equally.

export interface RecentPayment {
  milestoneId: string;
  projectName: string;
  clientName: string;
  label: string;
  amount: number;
  paidAt: Date;
  source: "stripe" | "bank";
}

export async function getRecentlyPaidMilestones(userId: string, sinceDays = 7): Promise<RecentPayment[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const milestones = await prisma.milestone.findMany({
    where: { userId, status: { in: ["paid", "cleared"] }, paidAt: { gte: since } },
    include: { project: { select: { projectName: true, clientName: true } } },
    orderBy: { paidAt: "desc" },
  });

  return milestones.map((m) => ({
    milestoneId: m.id,
    projectName: m.project.projectName,
    clientName: m.project.clientName,
    label: m.label,
    amount: Number(m.amount),
    paidAt: m.paidAt as Date,
    source: m.status === "cleared" ? "bank" : "stripe",
  }));
}

// ── CSV → Milestone matching ──────────────────────────────────────────────
// "The invoice builds the future, the CSV confirms the past." When a bank
// statement is imported, any newly-inserted income transaction that exactly
// matches an open milestone's amount gets LINKED to it (never a new
// Transaction created here — the CSV pipeline already created the real row;
// this only recognizes a match and marks the milestone "cleared"). This is
// what makes a milestone paid outside Stripe (a client who paid by bank
// transfer directly) still show up as confirmed once the freelancer uploads
// their statement.
export async function matchMilestonesToTransactions(userId: string, newTransactionIds: string[]): Promise<void> {
  if (newTransactionIds.length === 0) return;

  const openMilestones = await prisma.milestone.findMany({
    where: { userId, status: { in: ["pending", "sent"] }, transactionId: null },
  });
  if (openMilestones.length === 0) return;

  const candidateTxs = await prisma.transaction.findMany({
    where: { id: { in: newTransactionIds }, transactionType: "income" },
    select: { id: true, amount: true, transactionDate: true },
  });
  if (candidateTxs.length === 0) return;

  const pool = [...candidateTxs];
  const matchedProjectIds = new Set<string>();

  for (const milestone of openMilestones) {
    // Exact amount match, and the transaction can't predate the milestone's
    // own creation — a coincidental historical payment from before this
    // milestone existed is not this milestone being paid.
    const matchIdx = pool.findIndex(
      (tx) => Number(tx.amount) === Number(milestone.amount) && tx.transactionDate >= milestone.createdAt
    );
    if (matchIdx === -1) continue;
    const match = pool[matchIdx];
    pool.splice(matchIdx, 1); // one transaction can only clear one milestone

    const project = await prisma.project.findUniqueOrThrow({ where: { id: milestone.projectId } });

    // Same identity resolution the Stripe webhook uses — an exact match on
    // the freelancer-typed client name, so bank-transfer and Stripe payments
    // from the same client end up under the same Payer either way.
    const payer = await prisma.payer.upsert({
      where: { userId_canonicalName: { userId, canonicalName: project.clientName } },
      update: {},
      create: { userId, canonicalName: project.clientName, payerType: "client" },
    });

    const currentTx = await prisma.transaction.findUnique({ where: { id: match.id }, select: { payerId: true } });
    if (currentTx?.payerId !== payer.id) {
      await prisma.transaction.update({ where: { id: match.id }, data: { payerId: payer.id } });
    }

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: "cleared", paidAt: match.transactionDate, transactionId: match.id },
    });

    matchedProjectIds.add(milestone.projectId);
    if (pool.length === 0) break;
  }

  for (const projectId of matchedProjectIds) {
    const remaining = await prisma.milestone.count({ where: { projectId, status: { notIn: ["paid", "cleared"] } } });
    if (remaining === 0) {
      await prisma.project.update({ where: { id: projectId }, data: { status: "completed" } });
    }
  }
}
