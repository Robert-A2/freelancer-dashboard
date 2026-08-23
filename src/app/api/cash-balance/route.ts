import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { recordBalanceCheckpoint, getCurrentCashPosition } from "@/lib/cash-balance-engine";

async function handle(request: NextRequest, source: "manual-entry" | "user-correction") {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount, note } = body as { amount?: number; note?: string };

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Amount must be a number." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, fullName: user.user_metadata?.full_name ?? "", email: user.email ?? "" },
    });

    await recordBalanceCheckpoint(user.id, amount as number, source, note);
    const position = await getCurrentCashPosition(user.id);

    return NextResponse.json({ position });
  } catch (error) {
    console.error("Cash balance error:", error);
    return NextResponse.json({ error: "Failed to save balance" }, { status: 500 });
  }
}

// "Cash available today" — the initial manual-entry submission.
export async function POST(request: NextRequest) {
  return handle(request, "manual-entry");
}

// "Edit balance" — a later correction on top of existing history, not an
// overwrite of it (recordBalanceCheckpoint is append-only).
export async function PATCH(request: NextRequest) {
  return handle(request, "user-correction");
}
