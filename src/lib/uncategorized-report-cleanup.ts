import { prisma } from "./prisma";

// UncategorizedMerchantReport (see schema.prisma) stores the raw, verbatim
// description text of any transaction the categorizer couldn't recognize —
// deliberately with no userId, so it can't be scoped or cleaned up by a
// user's own account deletion (that table is a cross-user maintainer
// worklist, not per-user data). That means a real transaction description —
// potentially containing a person's name, an unusual local business, a
// transfer memo — would otherwise sit there indefinitely with no path to
// removal. This bounds that retention instead of leaving it open-ended.
export const STALE_REPORT_DAYS = 90;

export interface PurgeResult {
  resolvedOrIgnored: number;
  staleUnresolved: number;
}

// Two independent triggers, run together on a schedule (see
// src/app/api/cron/purge-uncategorized-reports/route.ts):
//   1. "resolved"/"ignored" — a maintainer already acted on it; the raw
//      description has served its purpose and is deleted immediately, not
//      just marked. (If the same merchant shows up again in a future
//      upload, reportUncategorizedMerchants()'s upsert just recreates a
//      fresh "new" report — merchantKey is unique, so nothing is lost from
//      the categorization signal, only the now-redundant old text.)
//   2. "new"/"reviewed" but not seen again in 90+ days — a stale worklist
//      item nobody acted on and that stopped recurring. lastSeenAt (not
//      createdAt) is the cutoff so a merchant still actively appearing in
//      uploads keeps getting its clock reset and never gets purged out from
//      under an active worklist item.
export async function purgeStaleUncategorizedReports(): Promise<PurgeResult> {
  const cutoff = new Date(Date.now() - STALE_REPORT_DAYS * 24 * 60 * 60 * 1000);

  const [resolvedOrIgnored, staleUnresolved] = await Promise.all([
    prisma.uncategorizedMerchantReport.deleteMany({
      where: { status: { in: ["resolved", "ignored"] } },
    }),
    prisma.uncategorizedMerchantReport.deleteMany({
      where: { status: { in: ["new", "reviewed"] }, lastSeenAt: { lt: cutoff } },
    }),
  ]);

  return { resolvedOrIgnored: resolvedOrIgnored.count, staleUnresolved: staleUnresolved.count };
}
