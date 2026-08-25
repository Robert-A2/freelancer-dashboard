import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { getOrCreateManualAccount } from "@/lib/manual-accounts";
import { getReserveForPayment } from "@/lib/reserve-engine";
import { classifyIntent } from "@/lib/intent-engine";

interface ManualTransactionInput {
  amount: number;
  merchantName: string;
  category: string;
  transactionType: "income" | "expense";
  tag: "business" | "personal";
  date?: string;
  // Only meaningful (and only ever sent) when the user's tax profile
  // activityType is "mixed" — identifies which activity THIS payment
  // belongs to (Tax & Contributions spec section 5).
  activityType?: string | null;
}

// The manual-entry counterpart to /api/uploads/process — a single row or a
// small batch (the Daily Expenses section, or the Dashboard's "+Add" quick
// action), csvImportId always null. Same "must finish before the response"
// synchronous analytics recalculation as the CSV route (fixed earlier this
// session) — the Dashboard reads MonthlyAnalytics/Forecast, not raw
// Transaction rows, so a page view right after submitting must already
// reflect it.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { transactions } = body as { transactions?: ManualTransactionInput[] };

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "At least one transaction is required." }, { status: 400 });
    }
    for (const t of transactions) {
      if (!Number.isFinite(t.amount) || t.amount <= 0) {
        return NextResponse.json({ error: "Each amount must be a positive number." }, { status: 400 });
      }
      if (!t.merchantName?.trim()) {
        return NextResponse.json({ error: "Each entry needs a merchant/description." }, { status: 400 });
      }
      if (!t.category?.trim()) {
        return NextResponse.json({ error: "Each entry needs a category." }, { status: 400 });
      }
      if (t.transactionType !== "income" && t.transactionType !== "expense") {
        return NextResponse.json({ error: "transactionType must be income or expense." }, { status: 400 });
      }
      if (t.tag !== "business" && t.tag !== "personal") {
        return NextResponse.json({ error: "tag must be business or personal." }, { status: 400 });
      }
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, fullName: user.user_metadata?.full_name ?? "", email: user.email ?? "" },
    });

    const businessAccount = await getOrCreateManualAccount(user.id, "business");
    const personalAccount = await getOrCreateManualAccount(user.id, "personal");

    // UTC midnight, matching parseDate()'s convention for every CSV-imported
    // transaction — not new Date() (which carries the current time-of-day
    // and would make every undated entry a unique millisecond, silently
    // defeating the dedup check below and the DB's own partial unique index).
    const now = new Date();
    const todayUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const rows = transactions.map((t) => ({
      accountId: t.tag === "business" ? businessAccount.id : personalAccount.id,
      transactionDate: t.date ? new Date(t.date) : todayUtcMidnight,
      description: t.merchantName.trim(),
      amount: t.amount,
      transactionType: t.transactionType,
      category: t.category,
      activityType: t.activityType ?? null,
    }));

    // Dedup against existing rows the same way the CSV route does — a
    // manual entry that exactly matches (account, date, description, amount)
    // an existing row is almost certainly an accidental double-submit, not
    // two genuinely distinct transactions. Also required to avoid the DB's
    // own partial unique index on (userId, accountId, transactionDate,
    // description, amount) throwing on a real collision.
    const dates = rows.map((r) => r.transactionDate.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const existing = await prisma.transaction.findMany({
      where: { userId: user.id, transactionDate: { gte: minDate, lte: maxDate } },
      select: { accountId: true, transactionDate: true, description: true, amount: true },
    });
    const existingSet = new Set(
      existing.map((t) => `${t.accountId}|${t.transactionDate.toISOString()}|${t.description}|${Number(t.amount)}`),
    );
    const newRows = rows.filter(
      (r) => !existingSet.has(`${r.accountId}|${r.transactionDate.toISOString()}|${r.description}|${r.amount}`),
    );

    // Money received should never be confirmed silently — tell the user
    // right away which part of it is actually theirs to spend and which
    // part the existing Financial Reserve Engine says to set aside (the
    // same VAT/social-contributions/income-tax calculation Settings shows,
    // never a second one). Expense-only submissions have nothing to reserve.
    // Computed before insert so a "calculated" France result's audit
    // snapshot (spec section 33) can be stored on the income row(s) below —
    // the rate/activity/ACRE status that applied AT THIS MOMENT, so a later
    // Settings change can never silently rewrite what this transaction's
    // reserve was (spec section 32).
    // Business-tagged income only — a "Money received" entry the user
    // explicitly tagged Personal (a gift, a refund, non-business income —
    // that's the entire point of the tag) is real income but generates no
    // business tax obligation, so it must never feed a reserve calculation
    // or the Urssaf-outstanding ledger (getUrssafPeriodStatus sums every
    // income row's taxReserveSnapshot regardless of account, so a snapshot
    // stored here would otherwise permanently inflate that ledger).
    const incomeRows = newRows.filter((r) => r.transactionType === "income" && r.accountId === businessAccount.id);
    const incomeJustAdded = incomeRows.reduce((s, r) => s + r.amount, 0);
    const reserve = incomeJustAdded > 0
      ? await getReserveForPayment(user.id, incomeJustAdded, { paymentActivityType: incomeRows.find((r) => r.activityType)?.activityType })
      : null;
    // The full result, not just the rate snapshot — the Urssaf reserved/paid
    // ledger (spec sections 26-27) needs the actual euro amount too, so it
    // can sum "how much has been reserved" without recomputing anything.
    const reserveResult = reserve?.engine === "france" && reserve.result.status === "calculated" ? reserve.result : null;

    if (newRows.length > 0) {
      await prisma.transaction.createMany({
        data: newRows.map((r) => {
          // Manually-entered transactions never ran through intent
          // classification before — CSV imports do (categorization +
          // intent-engine), manual entry didn't. Reusing the same
          // classifier here is what lets a "taxes"-category expense be
          // recognized as intent:"tax_payment" and offset the Urssaf
          // reserve ledger below, with zero new matching logic.
          const { intent, intentConfidence, intentSource, needsReview } = classifyIntent(
            r.description,
            { transactionType: r.transactionType, category: r.category, confidence: "high", source: "user-manual" },
          );
          return {
            userId: user.id,
            accountId: r.accountId,
            transactionDate: r.transactionDate,
            description: r.description,
            amount: new Decimal(r.amount),
            transactionType: r.transactionType,
            category: r.category,
            categoryConfidence: "high",
            categorySource: "user-manual",
            intent, intentConfidence, intentSource, needsReview,
            taxReserveSnapshot: r.transactionType === "income" && r.accountId === businessAccount.id && reserveResult ? (reserveResult as unknown as Prisma.InputJsonValue) : undefined,
          };
        }),
      });

      await recalculateMonthlyAnalytics(user.id);
      await generateForecast(user.id);
    }

    return NextResponse.json({ success: true, created: newRows.length, duplicates: rows.length - newRows.length, reserve });
  } catch (error) {
    console.error("Manual transaction error:", error);
    return NextResponse.json({ error: "Failed to save transaction(s)" }, { status: 500 });
  }
}
