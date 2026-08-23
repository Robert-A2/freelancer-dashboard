import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordOwnerPay } from "@/lib/manual-accounts";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";

// "Pay yourself" — records a transfer from the Business bucket to the
// Personal bucket. Deliberately not a new business expense or new personal
// income in the economic sense (spec: "It's a transfer between the
// freelancer's two money buckets") — recordOwnerPay() writes both legs as
// transactionType "transfer", which recalculateMonthlyAnalytics already
// excludes from income/expense totals, so this can never distort Business
// Health, Cashflow Risk, or the Forecast just by existing. Only meaningful
// for a user who keeps separate accounts — the API allows it either way,
// since the manual accounts get created lazily regardless, but a
// shared-account user has no reason to see this in the UI (QuickAddDrawer
// only offers it when accountsSeparated is true).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount, date } = body as { amount?: number; date?: string };

    if (!Number.isFinite(amount) || (amount as number) <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }

    const { outTx, inTx } = await recordOwnerPay(user.id, amount as number, date ? new Date(date) : undefined);

    // Both legs are real Transaction rows, so MonthlyAnalytics must reflect
    // them for the accounts they belong to even though they net out of
    // business P&L — otherwise Current Cash and this month's activity list
    // would disagree with what MonthlyAnalytics-derived figures show.
    await recalculateMonthlyAnalytics(user.id);

    return NextResponse.json({ success: true, businessTransactionId: outTx.id, personalTransactionId: inTx.id });
  } catch (error) {
    console.error("Owner pay error:", error);
    return NextResponse.json({ error: "Failed to record the transfer" }, { status: 500 });
  }
}
