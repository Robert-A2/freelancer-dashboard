import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { fullName?: string };
    const fullName = body.fullName?.trim();
    if (!fullName) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    if (fullName.length > 120) {
      return NextResponse.json({ error: "Name is too long." }, { status: 400 });
    }

    // Reachable before a user has ever uploaded a CSV or created a project,
    // so their User row may not exist yet — same defensive upsert used
    // throughout Settings/Profile ("day one" entry points).
    await prisma.user.upsert({
      where: { id: user.id },
      update: { fullName },
      create: { id: user.id, fullName, email: user.email ?? "" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
