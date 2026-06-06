import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyComparison } from "@/lib/analytics-engine";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await getMonthlyComparison(user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Monthly comparison error:", error);
    return NextResponse.json({ error: "Failed to load comparison" }, { status: 500 });
  }
}
