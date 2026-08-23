import { NextRequest, NextResponse } from "next/server";
import { purgeStaleUncategorizedReports } from "@/lib/uncategorized-report-cleanup";

// Triggered daily by Vercel Cron (see vercel.json). Vercel signs cron
// requests with this same secret as a Bearer token — checking it stops
// anyone else from hitting this route and forcing an off-schedule purge.
// Also accepts a manually-triggered run (e.g. `vercel cron trigger`, or a
// maintainer curling it directly) as long as they have the secret.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Cron] purge-uncategorized-reports: CRON_SECRET is not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeStaleUncategorizedReports();
    console.log(
      `[Cron] purge-uncategorized-reports — deleted ${result.resolvedOrIgnored} resolved/ignored, ` +
      `${result.staleUnresolved} stale (90+ days untouched)`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] purge-uncategorized-reports failed:", error);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}
