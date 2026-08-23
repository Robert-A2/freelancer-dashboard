import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { markReceived, cancelExpectedPayment } from "@/lib/expected-payment-engine";
import { getReserveForPayment } from "@/lib/reserve-engine";
import { getMoneyBreakdown, projectMoneyBreakdownWithPayment } from "@/lib/money-breakdown";

// The "before it arrives" breakdown + "if this arrives" scenario (spec
// sections 6, 32) — gross/reserve/after-reserve for this one payment, plus
// what the overall picture would look like once it lands, using the exact
// same engine the Dashboard and Money Received confirmation read. Never
// touches Current Cash; purely a projection.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.expectedPayment.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const amount = Number(existing.amount);
    const [reserve, current] = await Promise.all([
      getReserveForPayment(user.id, amount, { paymentActivityType: existing.activityType }),
      getMoneyBreakdown(user.id),
    ]);
    const scenario = projectMoneyBreakdownWithPayment(current, amount, reserve.engine === "france" ? reserve.asReserveForAmount : reserve.result);

    return NextResponse.json({ reserve, current, scenario });
  } catch (error) {
    console.error("Expected payment scenario error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.expectedPayment.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      markReceived: shouldMarkReceived,
      actualAmount,
      receivedDate,
      amount,
      clientName,
      projectName,
      expectedDate,
      activityType,
    } = body as {
      markReceived?: boolean;
      actualAmount?: number;
      receivedDate?: string;
      amount?: number;
      clientName?: string | null;
      projectName?: string | null;
      expectedDate?: string;
      activityType?: string | null;
    };

    // ── Self-reported "money received" — deliberately labeled as such
    // wherever it's shown, never implied to be Stripe/CSV-verified. ─────────
    if (shouldMarkReceived) {
      if (existing.status !== "pending") {
        return NextResponse.json({ error: "Already resolved." }, { status: 409 });
      }
      if (actualAmount !== undefined && (!Number.isFinite(actualAmount) || actualAmount <= 0)) {
        return NextResponse.json({ error: "Actual amount must be a positive number." }, { status: 400 });
      }
      const transaction = await markReceived(user.id, id, {
        actualAmount,
        receivedDate: receivedDate ? new Date(receivedDate) : undefined,
      });
      // Same "never confirm money silently" rule as the manual-transaction
      // route — reuses the one Financial Reserve Engine + Money Breakdown
      // calculation, never a second one. Uses the ACTUAL receipt date, not
      // the old expected date, so ACRE expiry and rate changes are honored
      // correctly (spec section 11).
      const [reserve, moneyBreakdown] = await Promise.all([
        getReserveForPayment(user.id, Number(transaction.amount), { paymentDate: transaction.transactionDate, paymentActivityType: existing.activityType }),
        getMoneyBreakdown(user.id),
      ]);
      // Audit snapshot (spec section 33) — the rate/activity/ACRE status
      // that actually applied at receipt, preserved so a later Settings
      // change can never silently rewrite this transaction's reserve
      // (spec section 32).
      if (reserve.engine === "france" && reserve.result.status === "calculated") {
        await prisma.transaction.update({ where: { id: transaction.id }, data: { taxReserveSnapshot: reserve.result as unknown as Prisma.InputJsonValue } });
      }
      return NextResponse.json({ transaction, reserve, moneyBreakdown });
    }

    // ── Field edits — only while still pending ──────────────────────────────
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Only a pending expected payment can be edited." }, { status: 409 });
    }

    const data: { amount?: Decimal; clientName?: string | null; projectName?: string | null; expectedDate?: Date; activityType?: string | null } = {};
    if (amount !== undefined) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
      }
      data.amount = new Decimal(amount);
    }
    // Both optional, per spec — either can be cleared to null via edit.
    if (clientName !== undefined) data.clientName = clientName?.trim() || null;
    if (projectName !== undefined) data.projectName = projectName?.trim() || null;
    if (expectedDate !== undefined) data.expectedDate = new Date(expectedDate);
    if (activityType !== undefined) data.activityType = activityType || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.expectedPayment.update({ where: { id }, data });
    return NextResponse.json({ expectedPayment: updated });
  } catch (error) {
    console.error("Update expected payment error:", error);
    return NextResponse.json({ error: "Failed to update expected payment" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.expectedPayment.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Already resolved." }, { status: 409 });
    }

    await cancelExpectedPayment(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel expected payment error:", error);
    return NextResponse.json({ error: "Failed to cancel expected payment" }, { status: 500 });
  }
}
