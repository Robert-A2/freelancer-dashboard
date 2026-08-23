import { prisma } from "./prisma";
import { normalizeMerchantKey } from "./categorization/engine";

// A manual user who later uploads a CSV may find transactions they already
// entered by hand (spec section 32). The DB's exact-match dedup (partial
// unique index on userId+accountId+date+description+amount) never catches
// this case: the manual entry lives on the auto-provisioned "Business/
// Personal (manual)" account while the CSV row lands on a different real
// bank account, so accountId never matches even when it's the same real
// payment. This is a SEPARATE, additional layer for likely (not exact)
// matches — never auto-deletes anything, only surfaces candidates for the
// user to review (spec: "Never silently delete uncertain financial data").

export interface LikelyDuplicatePair {
  manualTransactionId: string;
  manualDescription: string;
  manualDate: string;
  manualAmount: number;
  csvTransactionId: string;
  csvDescription: string;
  csvDate: string;
  csvAmount: number;
  confidence: "high" | "medium";
}

const NEAR_DATE_WINDOW_DAYS = 3;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

// Same normalization the categorization engine already uses for merchant
// keys — reused here rather than inventing a second string-matching scheme.
// "Adobe" -> "adobe"; "ADOBE CREATIVE CLOUD" -> "adobe creative cloud".
function descriptionsLikelyMatch(a: string, b: string): boolean {
  const na = normalizeMerchantKey(a);
  const nb = normalizeMerchantKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Share a first significant word (e.g. "adobe" in both "adobe" and
  // "adobe creative cloud") — the common case of a manual user's short
  // name vs. the bank's fuller merchant string.
  const firstA = na.split(" ")[0];
  const firstB = nb.split(" ")[0];
  return firstA.length >= 3 && firstA === firstB;
}

// Called synchronously right after a CSV import finishes inserting rows —
// cheap because it only ever looks at the user's own manual-origin rows
// (csvImportId null), a small set for any real user.
export async function findLikelyManualDuplicates(
  userId: string,
  csvImportId: string,
): Promise<LikelyDuplicatePair[]> {
  const [csvRows, manualRows] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, csvImportId },
      select: { id: true, description: true, transactionDate: true, amount: true, transactionType: true },
    }),
    prisma.transaction.findMany({
      where: { userId, csvImportId: null },
      select: { id: true, description: true, transactionDate: true, amount: true, transactionType: true },
    }),
  ]);

  if (csvRows.length === 0 || manualRows.length === 0) return [];

  const pairs: LikelyDuplicatePair[] = [];
  const claimedManualIds = new Set<string>();

  for (const csvTx of csvRows) {
    let best: { manual: (typeof manualRows)[number]; confidence: "high" | "medium" } | null = null;

    for (const manualTx of manualRows) {
      if (claimedManualIds.has(manualTx.id)) continue;
      if (manualTx.transactionType !== csvTx.transactionType) continue;
      if (Number(manualTx.amount) !== Number(csvTx.amount)) continue;

      const dayDiff = daysBetween(manualTx.transactionDate, csvTx.transactionDate);
      if (dayDiff > NEAR_DATE_WINDOW_DAYS) continue;
      if (!descriptionsLikelyMatch(manualTx.description, csvTx.description)) continue;

      // High confidence: same day, description overlap. Medium: within the
      // ±3 day window. Amount+type match is already required for either.
      const confidence: "high" | "medium" = dayDiff <= 1 ? "high" : "medium";
      if (!best || (confidence === "high" && best.confidence === "medium")) {
        best = { manual: manualTx, confidence };
      }
    }

    if (best) {
      claimedManualIds.add(best.manual.id);
      pairs.push({
        manualTransactionId: best.manual.id,
        manualDescription: best.manual.description,
        manualDate: best.manual.transactionDate.toISOString(),
        manualAmount: Number(best.manual.amount),
        csvTransactionId: csvTx.id,
        csvDescription: csvTx.description,
        csvDate: csvTx.transactionDate.toISOString(),
        csvAmount: Number(csvTx.amount),
        confidence: best.confidence,
      });
    }
  }

  return pairs;
}
