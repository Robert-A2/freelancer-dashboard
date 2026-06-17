import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIntentBreakdown } from "@/lib/analytics-engine";

// GET /api/analytics/intent-breakdown
// Query params:
//   year  (optional) — 4-digit year, e.g. 2025
//   month (optional) — 1-12; only used when year is also provided
//
// Returns the intent-aware financial breakdown for the requested period.
// When no params are given, returns all-time totals.
// `hasEnoughDataForDisplay: false` means intent coverage is below 80% —
// the UI should prompt the user to run recategorize-all before showing
// intent KPIs.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const yearParam  = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const year  = yearParam  ? parseInt(yearParam,  10) : undefined;
    const month = monthParam ? parseInt(monthParam, 10) : undefined;

    if (year !== undefined && isNaN(year)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (month !== undefined && (isNaN(month) || month < 1 || month > 12)) {
      return NextResponse.json({ error: "Invalid month (must be 1–12)" }, { status: 400 });
    }

    const breakdown = await getIntentBreakdown(user.id, year, month);
    return NextResponse.json(breakdown);
  } catch (error) {
    console.error("Intent breakdown error:", error);
    return NextResponse.json({ error: "Failed to compute intent breakdown" }, { status: 500 });
  }
}
