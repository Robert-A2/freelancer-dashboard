import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { recomputeVerifiedRevenue } from "@/lib/payer-engine";

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

  void recalculateMonthlyAnalytics(user.id).catch(() => {});
  void recomputeVerifiedRevenue(user.id).catch(() => {});

  return NextResponse.json({ success: true, updated: transactionIds.length });
}
