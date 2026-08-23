import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { recordBalanceCheckpoint } from "@/lib/cash-balance-engine";
import { setManualTaxReserve } from "@/lib/tax-reserve-engine";
import { getOrCreateManualAccount } from "@/lib/manual-accounts";
import { syncRecurringExpenses } from "@/lib/recurring-expense-engine";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { generateForecast } from "@/lib/forecast-engine";

interface RecurringInput {
  name: string;
  amount: number;
  category: string;
  frequency: "monthly"; // v1: monthly only, see route body for why
  dayOfMonth: number;
  // Which manual account this commitment belongs to — defaults to
  // "personal" (the old hardcoded behavior) when omitted, so a client that
  // hasn't been updated to send it still works exactly as before.
  tag?: "business" | "personal";
}

interface TaxProfileInput {
  country?: string | null;
  businessLegalStatus?: string | null;
  activityType?: string | null;
  versementLiberatoireStatus?: string | null;
  acreStatus?: string | null;
  activityStartDate?: string | null;
  vatStatus?: string | null;
  defaultVatRate?: number | null;
  urssafFrequency?: string | null;
}

interface OnboardingBody {
  // Whether the user keeps a genuinely separate account for their freelance
  // activity, or shares one account for business and personal money — the
  // question that decides whether "currentCash" below is scoped to the
  // Business manual account or applies to the whole shared pool. Required:
  // there is no honest default, and guessing is exactly the bug this
  // question exists to fix (Business/Personal/All used to show identical
  // numbers because nothing distinguished them).
  accountsSeparated: boolean;
  currentCash: number;
  taxReserve?: number | null;
  recurring?: RecurringInput[];
  // Replaces the old single "spendingEstimate" — a business's running costs
  // and the owner's personal living-expense draw are different numbers,
  // asked separately so the Dashboard's account filter can show each
  // correctly instead of the same figure copied into every view.
  businessSpendingEstimate?: number | null;
  personalSpendingEstimate?: number | null;
  expectedPayment?: { amount: number; clientName?: string | null; projectName?: string | null; expectedDate: string } | null;
  taxProfile?: TaxProfileInput | null;
}

// One combined submit for the whole first-login wizard (spec section 4) —
// deliberately calls the exact same engines the standalone Cash/Recurring/
// Expected-payment/Tax-reserve API routes call, so onboarding never becomes
// a second, divergent way of writing this data. Every step past Step 1 is
// optional and independently skippable, matching the spec's "Allow Skip" on
// steps 2-5; only currentCash is required.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as OnboardingBody;
    const { accountsSeparated, currentCash, taxReserve, recurring, businessSpendingEstimate, personalSpendingEstimate, expectedPayment, taxProfile } = body;

    if (!Number.isFinite(currentCash)) {
      return NextResponse.json({ error: "Current cash is required." }, { status: 400 });
    }
    if (typeof accountsSeparated !== "boolean") {
      return NextResponse.json({ error: "How you manage your business is required." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: { accountsSeparated },
      create: { id: user.id, fullName: user.user_metadata?.full_name ?? "", email: user.email ?? "", accountsSeparated },
    });

    // Step 1 — required. Separate accounts -> the checkpoint is scoped to
    // the Business manual account, so the Dashboard's Business/Personal/All
    // filter can show a real, different balance per tab instead of the same
    // global number everywhere. Shared account -> one unscoped checkpoint,
    // honestly applying to every view since it really is one pool of money.
    const businessAccountForCheckpoint = accountsSeparated ? await getOrCreateManualAccount(user.id, "business") : null;
    await recordBalanceCheckpoint(user.id, currentCash, "manual-entry", undefined, businessAccountForCheckpoint?.id ?? null);

    // Step 2 — reserved for tax/contributions (optional, €0 allowed)
    if (taxReserve !== undefined && taxReserve !== null) {
      await setManualTaxReserve(user.id, taxReserve);
    }

    // Step 3 — fixed/recurring commitments (optional, zero or more).
    // Onboarding only offers "monthly" (the spec's own worked examples —
    // rent, Adobe, insurance — are all monthly); weekly/quarterly/yearly
    // stay reachable from the full Recurring Expense form post-onboarding.
    // Each row is filed under its own business/personal account instead of
    // being silently forced into "Personal (manual)" regardless of what the
    // user actually meant.
    if (recurring && recurring.length > 0) {
      const valid = recurring.filter((r) => r.name?.trim() && Number.isFinite(r.amount) && r.amount > 0);
      const [businessAccount, personalAccount] = await Promise.all([
        valid.some((r) => r.tag === "business") ? getOrCreateManualAccount(user.id, "business") : null,
        valid.some((r) => (r.tag ?? "personal") === "personal") ? getOrCreateManualAccount(user.id, "personal") : null,
      ]);
      await prisma.recurringExpense.createMany({
        data: valid.map((r) => ({
          userId: user.id,
          accountId: (r.tag === "business" ? businessAccount : personalAccount)!.id,
          merchantName: r.name.trim(),
          category: r.category || "uncategorized",
          amount: new Decimal(r.amount),
          dayOfMonth: Math.min(Math.max(Math.trunc(r.dayOfMonth) || 1, 1), 28),
        })),
      });
      await syncRecurringExpenses(user.id);
    }

    // Step 4 — business running costs and personal living-expense draw,
    // asked and saved separately (not one vague "average expense" copied
    // into both). Explicitly NOT observed history — only ever surfaced
    // later as "Estimated Runway ... you told us this" (spec section 28).
    const spendingData: Record<string, Decimal> = {};
    if (businessSpendingEstimate !== undefined && businessSpendingEstimate !== null) {
      spendingData.businessSpendingEstimate = new Decimal(businessSpendingEstimate);
    }
    if (personalSpendingEstimate !== undefined && personalSpendingEstimate !== null) {
      spendingData.personalSpendingEstimate = new Decimal(personalSpendingEstimate);
    }
    if (Object.keys(spendingData).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: spendingData });
    }

    // Step 5 — upcoming money (optional). Only amount + expectedDate are
    // actually required — clientName/projectName are both optional per spec.
    if (expectedPayment && Number.isFinite(expectedPayment.amount) && expectedPayment.amount > 0 && expectedPayment.expectedDate) {
      await prisma.expectedPayment.create({
        data: {
          userId: user.id,
          amount: new Decimal(expectedPayment.amount),
          clientName: expectedPayment.clientName?.trim() || null,
          projectName: expectedPayment.projectName?.trim() || null,
          expectedDate: new Date(expectedPayment.expectedDate),
        },
      });
    }

    // Step 6 — Tax & contributions (optional, every field independently
    // skippable via "I'm not sure"). Writes the exact same User fields
    // Settings later edits via /api/financial-profile — one tax profile,
    // never a second copy (spec section 17).
    if (taxProfile) {
      const isMicro = taxProfile.businessLegalStatus === "micro_entrepreneur";
      const data: Record<string, string | null | Decimal | Date> = {};
      if (taxProfile.country !== undefined) data.country = taxProfile.country;
      if (taxProfile.businessLegalStatus !== undefined) data.businessLegalStatus = taxProfile.businessLegalStatus;
      if (taxProfile.vatStatus !== undefined) data.vatStatus = taxProfile.vatStatus;
      if (taxProfile.defaultVatRate !== undefined && taxProfile.defaultVatRate !== null) data.defaultVatRate = new Decimal(taxProfile.defaultVatRate);
      // Activity/VFL/ACRE/Urssaf-frequency only make sense for a declared
      // micro-entrepreneur — never saved otherwise, same gating the
      // calculation engine itself applies.
      if (isMicro) {
        if (taxProfile.activityType !== undefined) data.activityType = taxProfile.activityType;
        if (taxProfile.versementLiberatoireStatus !== undefined) data.versementLiberatoireStatus = taxProfile.versementLiberatoireStatus;
        if (taxProfile.acreStatus !== undefined) data.acreStatus = taxProfile.acreStatus;
        if (taxProfile.urssafFrequency !== undefined) data.urssafFrequency = taxProfile.urssafFrequency;
        if (taxProfile.acreStatus === "yes" && taxProfile.activityStartDate) data.activityStartDate = new Date(taxProfile.activityStartDate);
      }
      if (Object.keys(data).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data });
      }
    }

    // recurring commitments may have already materialized transactions —
    // keep MonthlyAnalytics/Forecast consistent before the user lands on
    // the real dashboard, same as every other write path in this app.
    await recalculateMonthlyAnalytics(user.id);
    await generateForecast(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Failed to save your setup" }, { status: 500 });
  }
}
