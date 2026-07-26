import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorization";
import type { NormalizedTransaction } from "@/lib/csv-processor";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { resolvePayers, recomputeVerifiedRevenue } from "@/lib/payer-engine";
import { matchMilestonesToTransactions } from "@/lib/milestone-engine";
import { loadMerchantIndex, reportUncategorizedMerchants } from "@/lib/merchant-reports";
import { detectCrossAccountTransfers } from "@/lib/transfer-detector";
import { Decimal } from "@prisma/client/runtime/library";

const BATCH_SIZE = 1000;

// Incoming transactions have transactionDate as an ISO string (JSON serialization)
type SerializedTransaction = Omit<NormalizedTransaction, "transactionDate"> & {
  transactionDate: string;
};

export async function POST(request: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure User record exists in our database
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
      },
    });

    // ── Load DB-backed merchant directory for server-side second pass ───────
    const merchantIndex = await loadMerchantIndex();

    // ── Read pre-parsed body ───────────────────────────────────────────────
    // The browser ran parseCsv() locally and sends structured rows, not the
    // raw file. transactionDate arrives as an ISO string from JSON.stringify.
    const {
      transactions: rawTransactions,
      fileName,
      totalRows,
      skippedRows,
      currencies,
      hasMixedCurrencies,
      parsedEarliest,
      parsedLatest,
      accountId,
    } = (await request.json()) as {
      transactions:       SerializedTransaction[];
      fileName:           string;
      totalRows:          number;
      skippedRows:        number;
      currencies:         string[];
      hasMixedCurrencies: boolean;
      parsedEarliest:     string | null;
      parsedLatest:       string | null;
      accountId?:         string;
    };

    if (!rawTransactions?.length) {
      return NextResponse.json({ error: "No transactions received" }, { status: 400 });
    }

    // If an accountId was supplied, verify it belongs to this user
    if (accountId) {
      const acc = await prisma.account.findUnique({
        where: { id: accountId },
        select: { userId: true },
      });
      if (!acc || acc.userId !== user.id) {
        return NextResponse.json({ error: "Invalid account" }, { status: 403 });
      }
    }

    // ── Re-hydrate dates ───────────────────────────────────────────────────
    const hydrated: NormalizedTransaction[] = rawTransactions.map((tx) => ({
      ...tx,
      transactionDate: new Date(tx.transactionDate),
    }));

    // ── Merchant second pass ───────────────────────────────────────────────
    const transactions: NormalizedTransaction[] = hydrated.map((tx) => {
      if (tx.categorySource === "learned") return tx;
      const result = categorizeTransaction(tx.description, tx.amount, new Map(), undefined, merchantIndex);
      if (result.source === "merchant-db") {
        return {
          ...tx,
          category:           result.category,
          categoryConfidence: result.confidence,
          categorySource:     result.source,
        };
      }
      return tx;
    });

    const validRows = transactions.length;

    // ── Application-level deduplication ───────────────────────────────────
    // Mirrors the two partial DB indexes:
    //   • accountId set   → dedup within (userId, accountId, date, description, amount)
    //   • accountId null  → dedup within (userId, date, description, amount)
    // We fetch existing rows for the date range being imported so we don't
    // need to send duplicate rows to createMany at all.
    let newTransactions = transactions;
    // Duplicates captured for visibility — returned to the client so users can
    // see exactly which transactions were skipped rather than a silent count.
    let droppedDuplicates: Array<{ date: string; description: string; amount: number; type: string }> = [];

    if (transactions.length > 0) {
      const dates = transactions.map(t => t.transactionDate.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      const existing = await prisma.transaction.findMany({
        where: {
          userId:          user.id,
          accountId:       accountId ?? null,
          transactionDate: { gte: minDate, lte: maxDate },
        },
        select: { transactionDate: true, description: true, amount: true },
      });

      const existingSet = new Set(
        existing.map(t =>
          `${t.transactionDate.toISOString()}|${t.description}|${Number(t.amount)}`
        )
      );

      const kept    = [] as typeof transactions;
      const dropped = [] as typeof transactions;
      for (const tx of transactions) {
        const key = `${tx.transactionDate.toISOString()}|${tx.description}|${tx.amount}`;
        if (existingSet.has(key)) dropped.push(tx); else kept.push(tx);
      }
      newTransactions = kept;

      // Only surface per-row details when the count is small — a large number
      // of duplicates almost certainly means a re-upload of the same CSV, which
      // doesn't need per-transaction review.
      if (dropped.length <= 30) {
        droppedDuplicates = dropped.slice(0, 20).map(tx => ({
          date:        tx.transactionDate.toISOString(),
          description: tx.description,
          amount:      tx.amount,
          type:        tx.transactionType,
        }));
      }
    }

    // ── Create import record ───────────────────────────────────────────────
    const csvImport = await prisma.csvImport.create({
      data: {
        userId:    user.id,
        accountId: accountId ?? null,
        fileName:  fileName ?? "import.csv",
        status:    "processing",
        totalRows,
      },
    });

    // ── Batch insert ───────────────────────────────────────────────────────
    let importedRows = 0;

    for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
      const batch = newTransactions.slice(i, i + BATCH_SIZE);

      const result = await prisma.transaction.createMany({
        data: batch.map((tx) => ({
          userId:             user.id,
          csvImportId:        csvImport.id,
          accountId:          accountId ?? null,
          transactionDate:    tx.transactionDate,
          description:        tx.description,
          amount:             new Decimal(tx.amount),
          transactionType:    tx.transactionType,
          category:           tx.category,
          categoryConfidence: tx.categoryConfidence,
          categorySource:     tx.categorySource,
          sourceFile:         fileName ?? null,
          intent:             tx.intent             ?? null,
          intentConfidence:   tx.intentConfidence   ?? null,
          intentSource:       tx.intentSource       ?? null,
          needsReview:        tx.needsReview,
        })),
      });

      importedRows += result.count;
    }

    const duplicateRows = validRows - importedRows;

    // ── Finalise import record ─────────────────────────────────────────────
    await prisma.csvImport.update({
      where: { id: csvImport.id },
      data: { status: "completed", importedRows, duplicateRows },
    });

    console.log(
      `[Upload] Import complete — ${importedRows} new rows, ${duplicateRows} duplicates. ` +
      `Account: ${accountId ?? "none"}. ` +
      `File range: ${parsedEarliest?.slice(0, 10) ?? "n/a"} to ${parsedLatest?.slice(0, 10) ?? "n/a"}`
    );

    // ── Post-import enrichment pipeline (deferred) ─────────────────────────
    // Runs after the response is sent so the user sees "Upload complete"
    // immediately. Each step is isolated — a failure here never affects the
    // already-saved import record.
    const importId  = csvImport.id;
    const userId    = user.id;
    const txsSnap   = transactions; // closure over parsed transactions

    after(async () => {
      let newTxIds: { id: string }[] = [];
      try {
        newTxIds = await prisma.transaction.findMany({
          where:  { csvImportId: importId },
          select: { id: true },
        });
        await resolvePayers(userId, newTxIds.map((t) => t.id));
      } catch (err) {
        console.error("[Upload/bg] resolvePayers failed:", err);
      }

      try {
        await matchMilestonesToTransactions(userId, newTxIds.map((t) => t.id));
      } catch (err) {
        console.error("[Upload/bg] milestone matching failed:", err);
      }

      try {
        await recalculateMonthlyAnalytics(userId);
        await recomputeVerifiedRevenue(userId);
      } catch (err) {
        console.error("[Upload/bg] analytics recalculation failed:", err);
      }

      try {
        await generateForecast(userId);
      } catch (err) {
        console.error("[Upload/bg] forecast generation failed:", err);
      }

      try {
        await reportUncategorizedMerchants(txsSnap);
      } catch (err) {
        console.error("[Upload/bg] merchant reporting failed:", err);
      }
    });

    // ── Detect potential cross-account transfers ───────────────────────────
    // Runs synchronously (before response) so the client gets results in one
    // round trip. Fast: only fires when user has ≥ 2 accounts.
    let suspectedTransfers: Awaited<ReturnType<typeof detectCrossAccountTransfers>> = [];
    if (accountId) {
      try {
        suspectedTransfers = await detectCrossAccountTransfers(user.id, csvImport.id);
      } catch (err) {
        console.error("[Upload] transfer detection failed:", err);
      }
    }

    // ── Build response ─────────────────────────────────────────────────────
    const categoryCounts: Record<string, number> = {};
    for (const tx of transactions) {
      categoryCounts[tx.category] = (categoryCounts[tx.category] ?? 0) + 1;
    }
    const categoriesDetected = Object.keys(categoryCounts).filter((c) => c !== "uncategorized").length;

    const typeBreakdown = {
      income:   transactions.filter((t) => t.transactionType === "income").length,
      expense:  transactions.filter((t) => t.transactionType === "expense").length,
      savings:  transactions.filter((t) => t.transactionType === "savings").length,
      transfer: transactions.filter((t) => t.transactionType === "transfer").length,
    };

    return NextResponse.json({
      success:            true,
      importId:           csvImport.id,
      totalRows,
      validRows,
      importedRows,
      duplicateRows,
      skippedRows,
      dateRangeFrom:      parsedEarliest ?? null,
      dateRangeTo:        parsedLatest   ?? null,
      categoriesDetected,
      currencies,
      hasMixedCurrencies,
      typeBreakdown,
      suspectedTransfers:  suspectedTransfers.length  > 0 ? suspectedTransfers  : undefined,
      skippedDuplicates:   droppedDuplicates.length   > 0 ? droppedDuplicates   : undefined,
    });
  } catch (error) {
    console.error("CSV processing error:", error);
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 });
  }
}
