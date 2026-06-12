import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv-processor";
import type { LearnedRules } from "@/lib/categorization";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { loadMerchantIndex, reportUncategorizedMerchants } from "@/lib/merchant-reports";
import { Decimal } from "@prisma/client/runtime/library";

const BUCKET = "csv-imports";
const BATCH_SIZE = 1000;

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
    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
      },
    });

    // ── Load this user's learned categorization rules ──────────────────────
    // Built from past manual recategorizations — checked before any hardcoded
    // rule so corrections keep applying automatically to future imports.
    const rules = await prisma.categoryRule.findMany({
      where: { userId: user.id },
      select: { merchantKey: true, category: true },
    });
    const learnedRules: LearnedRules = new Map(rules.map((r) => [r.merchantKey, r.category]));
    const ownerName = dbUser.fullName || undefined;

    // ── Load DB-backed merchant directory ───────────────────────────────────
    // Supplements the static packs with merchants added via prisma/seed.ts or
    // future updates, without requiring a code deploy.
    const merchantIndex = await loadMerchantIndex();

    // ── Read request body ──────────────────────────────────────────────────
    const { storagePath, fileName } = await request.json();

    if (!storagePath) {
      return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
    }

    // Verify the storagePath belongs to this user (security check)
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Download file from Supabase Storage ────────────────────────────────
    const admin = createAdminClient();
    const { data: blob, error: downloadError } = await admin.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !blob) {
      console.error("Storage download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to download file from storage" },
        { status: 500 }
      );
    }

    const csvText = await blob.text();

    if (!csvText.trim()) {
      await cleanupStorage(admin, storagePath);
      return NextResponse.json({ error: "File is empty" }, { status: 422 });
    }

    // ── Parse CSV ──────────────────────────────────────────────────────────
    const { transactions, totalRows, validRows, skippedRows, currencies, hasMixedCurrencies, parsedEarliest, parsedLatest } = parseCsv(csvText, learnedRules, ownerName, merchantIndex);

    if (transactions.length === 0) {
      await cleanupStorage(admin, storagePath);
      return NextResponse.json(
        {
          error:
            "No valid transactions found. Check your CSV has Date, Description, and Amount columns.",
        },
        { status: 422 }
      );
    }

    // ── Create import record ───────────────────────────────────────────────
    const csvImport = await prisma.csvImport.create({
      data: {
        userId: user.id,
        fileName: fileName ?? storagePath.split("/").pop() ?? "import.csv",
        status: "processing",
        totalRows,
      },
    });

    // ── Batch insert with native duplicate skipping ────────────────────────
    // createMany with skipDuplicates uses INSERT ... ON CONFLICT DO NOTHING
    // One SQL statement per batch of 1000 — handles 50,000+ rows efficiently.
    let importedRows = 0;
    let duplicateRows = 0;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);

      const result = await prisma.transaction.createMany({
        data: batch.map((tx) => ({
          userId: user.id,
          csvImportId: csvImport.id,
          transactionDate: tx.transactionDate,
          description: tx.description,
          amount: new Decimal(tx.amount),
          transactionType: tx.transactionType,
          category: tx.category,
          categoryConfidence: tx.categoryConfidence,
          categorySource: tx.categorySource,
          sourceFile: fileName ?? null,
        })),
        skipDuplicates: true,
      });

      importedRows += result.count;
    }

    // Duplicates = valid transactions that were already in the database
    duplicateRows = validRows - importedRows;

    // ── Finalise import record ─────────────────────────────────────────────
    await prisma.csvImport.update({
      where: { id: csvImport.id },
      data: {
        status: "completed",
        importedRows,
        duplicateRows,
      },
    });

    // ── Update analytics + forecast ────────────────────────────────────────
    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    // ── Feed the global uncategorized-merchant worklist ────────────────────
    await reportUncategorizedMerchants(transactions);

    // ── Clean up the file from storage ─────────────────────────────────────
    await cleanupStorage(admin, storagePath);

    console.log(
      `[Upload] Import complete — ${importedRows} new rows, ${duplicateRows} duplicates. ` +
      `File range: ${parsedEarliest?.toISOString().slice(0, 10) ?? "n/a"} to ${parsedLatest?.toISOString().slice(0, 10) ?? "n/a"}`
    );

    // Date range derived from parsedEarliest/Latest (computed by csv-processor from actual parsed dates)
    const dateRangeFrom = parsedEarliest?.toISOString() ?? null;
    const dateRangeTo   = parsedLatest?.toISOString()   ?? null;

    const categoryCounts: Record<string, number> = {};
    for (const tx of transactions) {
      categoryCounts[tx.category] = (categoryCounts[tx.category] ?? 0) + 1;
    }
    const categoriesDetected = Object.keys(categoryCounts).filter((c) => c !== "uncategorized").length;

    // Transaction type breakdown — shown in the upload success screen so users
    // can verify the categorisation looks correct before trusting the dashboard.
    const typeBreakdown = {
      income:   transactions.filter(t => t.transactionType === "income").length,
      expense:  transactions.filter(t => t.transactionType === "expense").length,
      savings:  transactions.filter(t => t.transactionType === "savings").length,
      transfer: transactions.filter(t => t.transactionType === "transfer").length,
    };

    return NextResponse.json({
      success: true,
      importId: csvImport.id,
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

async function cleanupStorage(
  admin: ReturnType<typeof createAdminClient>,
  path: string
) {
  try {
    await admin.storage.from(BUCKET).remove([path]);
  } catch {
    // Non-fatal — the file will just sit in storage until next cleanup
  }
}
