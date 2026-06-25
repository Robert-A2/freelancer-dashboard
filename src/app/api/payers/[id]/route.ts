import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/payers/[id]
// Body: { displayName: string }
// Sets the user-corrected display name for a payer. Max 60 chars.
// Passing an empty string clears the override (reverts to canonicalName).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: payerId } = await params;
    const { displayName } = await request.json();

    if (typeof displayName !== "string") {
      return NextResponse.json({ error: "displayName must be a string" }, { status: 400 });
    }

    const trimmed = displayName.trim().slice(0, 60);

    const payer = await prisma.payer.findFirst({
      where: { id: payerId, userId: user.id },
      select: { id: true },
    });
    if (!payer) return NextResponse.json({ error: "Payer not found" }, { status: 404 });

    await prisma.payer.update({
      where: { id: payerId },
      data: { displayName: trimmed.length > 0 ? trimmed : null },
    });

    return NextResponse.json({ success: true, displayName: trimmed.length > 0 ? trimmed : null });
  } catch (error) {
    console.error("Rename payer error:", error);
    return NextResponse.json({ error: "Failed to rename payer" }, { status: 500 });
  }
}
