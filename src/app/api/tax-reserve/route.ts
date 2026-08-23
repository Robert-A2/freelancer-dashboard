import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { setManualTaxReserve } from "@/lib/tax-reserve-engine";

// Sets or clears the user's own flat tax-reserve figure. Deliberately
// separate from the percentage-based Reserve Engine (src/lib/reserve-engine/)
// — this is the manual-entry user's own number, never derived from it.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount } = body as { amount?: number | null };

    if (amount !== null && amount !== undefined && !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Amount must be a number or null." }, { status: 400 });
    }
    if (amount !== null && amount !== undefined && amount < 0) {
      return NextResponse.json({ error: "Amount cannot be negative." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, fullName: user.user_metadata?.full_name ?? "", email: user.email ?? "" },
    });

    await setManualTaxReserve(user.id, amount ?? null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tax reserve error:", error);
    return NextResponse.json({ error: "Failed to update tax reserve" }, { status: 500 });
  }
}
