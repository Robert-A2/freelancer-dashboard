import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { recomputeVerifiedRevenue } from "@/lib/payer-engine";
import { generateForecast } from "@/lib/forecast-engine";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transactionIds } = await request.json() as { transactionIds: string[] };

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json({ error: "No transaction IDs provided" }, { status: 400 });
  }

  // Verify ownership before updating
  const owned = await prisma.transaction.count({
    where: { id: { in: transactionIds }, userId: user.id },
  });
  if (owned !== transactionIds.length) {
    return NextResponse.json({ error: "Invalid transaction IDs" }, { status: 403 });
  }

  await prisma.transaction.updateMany({
    where: { id: { in: transactionIds }, userId: user.id },
    data:  { transactionType: "transfer" },
  });

  // Awaited (not fire-and-forget) — the client navigates straight to the
  // Dashboard after this responds, and the Dashboard reads the cached forecast
  // (getLatestForecast) rather than recomputing it. If this were fire-and-forget,
  // confirming a transfer could show no visible effect on the Dashboard at all
  // until something unrelated happened to regenerate the forecast later.
  try {
    await recalculateMonthlyAnalytics(user.id);
    await recomputeVerifiedRevenue(user.id);
  } catch (err) {
    console.error("[Transfers/confirm] analytics recalculation failed:", err);
  }

  try {
    await generateForecast(user.id);
  } catch (err) {
    console.error("[Transfers/confirm] forecast generation failed:", err);
  }

  return NextResponse.json({ success: true, updated: transactionIds.length });
}
