import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getTodayFacts } from "@/lib/today-facts";
import { getMoneyBreakdown } from "@/lib/money-breakdown";

// Client-side read of the same facts the Dashboard's Today layer renders —
// used by Quick Add's immediate-reward step (spec section 30) so a save from
// anywhere in the app can show "current cash / spent this month" without a
// full page reload. Also returns moneyBreakdown — the same protected/
// available-after-protections/runway figures the Dashboard's Money
// Breakdown card shows, so the reward screen can never disagree with it.
//
// accountsSeparated/isMixedActivity are also returned here (not just passed
// as a prop from the (dashboard) layout) because QuickAddDrawer refetches
// this endpoint the moment it opens — the layout that threads those two
// flags down as props is shared across every page in the app and, per
// Next.js App Router's own design, does not necessarily re-render on every
// client-side navigation between sibling pages, so a prop alone can go
// stale (e.g. "Pay yourself" staying hidden, or shown, based on whatever it
// was at the layout's last real render). A fresh fetch right before the
// menu is shown can't have that problem.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = request.nextUrl.searchParams.get("accountId");
    const [facts, moneyBreakdown, dbUser] = await Promise.all([
      getTodayFacts(user.id, accountId),
      getMoneyBreakdown(user.id, accountId),
      prisma.user.findUnique({ where: { id: user.id }, select: { accountsSeparated: true, activityType: true } }),
    ]);
    return NextResponse.json({
      facts,
      moneyBreakdown,
      accountsSeparated: dbUser?.accountsSeparated === true,
      isMixedActivity: dbUser?.activityType === "mixed",
    });
  } catch (error) {
    console.error("Today facts error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
