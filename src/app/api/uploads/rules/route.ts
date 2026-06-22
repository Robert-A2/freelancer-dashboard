import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [categoryRules, intentRules] = await Promise.all([
      prisma.categoryRule.findMany({
        where: { userId: user.id },
        select: { merchantKey: true, category: true },
      }),
      prisma.userIntentRule.findMany({
        where: { userId: user.id },
        select: { merchantKey: true, intent: true },
      }),
    ]);

    return NextResponse.json({
      learnedRules:    categoryRules.map((r) => [r.merchantKey, r.category]),
      userIntentRules: intentRules.map((r)   => [r.merchantKey, r.intent]),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Rules route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
