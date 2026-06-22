import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { categorizeTransaction } from "@/lib/categorization";
import type { NormalizedTransaction } from "@/lib/csv-processor";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { loadMerchantIndex, reportUncategorizedMerchants } from "@/lib/merchant-reports";
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
    } = (await request.json()) as {
      transactions:       SerializedTransaction[];
      fileName:           string;
      totalRows:          number;
      skippedRows:        number;
      currencies:         string[];
      hasMixedCurrencies: boolean;
      parsedEarliest:     string | null;
      parsedLatest:       string | null;
    };

    if (!rawTransactions?.length) {
      return NextResponse.json({ error: "No transactions received" }, { status: 400 });
    }

    // ── Re-hydrate dates ───────────────────────────────────────────────────
    const hydrated: NormalizedTransaction[] = rawTransactions.map((tx) => ({
      ...tx,
      transactionDate: new Date(tx.transactionDate),
    }));

    // ── Merchant second pass ───────────────────────────────────────────────
    // The browser parsed with an empty merchantIndex (it has no DB access).
    // Re-run merchant lookup server-side — upgrades keyword/default categories
    // to merchant-db when a match exists. Never overrides user-taught rules.
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

    // ── Create import record ───────────────────────────────────────────────
    const csvImport = await prisma.csvImport.create({
      data: {
        userId:   user.id,
        fileName: fileName ?? "import.csv",
        status:   "processing",
        totalRows,
      },
    });

    // ── Batch insert with native duplicate skipping ────────────────────────
    let importedRows = 0;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);

      const result = await prisma.transaction.createMany({
        data: batch.map((tx) => ({
          userId:             user.id,
          csvImportId:        csvImport.id,
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
        skipDuplicates: true,
      });

      importedRows += result.count;
    }

    const duplicateRows = validRows - importedRows;

    // ── Finalise import record ─────────────────────────────────────────────
    await prisma.csvImport.update({
      where: { id: csvImport.id },
      data: { status: "completed", importedRows, duplicateRows },
    });

    // ── Update analytics + forecast ────────────────────────────────────────
    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    // ── Feed the global uncategorized-merchant worklist ────────────────────
    await reportUncategorizedMerchants(transactions);

    console.log(
      `[Upload] Import complete — ${importedRows} new rows, ${duplicateRows} duplicates. ` +
      `File range: ${parsedEarliest?.slice(0, 10) ?? "n/a"} to ${parsedLatest?.slice(0, 10) ?? "n/a"}`
    );

    // ── Build response ─────────────────────────────────────────────────────
    const dateRangeFrom = parsedEarliest ?? null;
    const dateRangeTo   = parsedLatest   ?? null;

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
      dateRangeFrom,
      dateRangeTo,
      categoriesDetected,
      currencies,
      hasMixedCurrencies,
      typeBreakdown,
    });
  } catch (error) {
    console.error("CSV processing error:", error);
    return NextResponse.json({ error: "Failed to process CSV" }, { status: 500 });
  }
}
