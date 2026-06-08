import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

const BUCKET = "csv-imports";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.id;
    const admin = createAdminClient();

    // Remove uploaded CSV files from storage (stored under "<userId>/...")
    const { data: files } = await admin.storage.from(BUCKET).list(userId);
    if (files && files.length > 0) {
      await admin.storage.from(BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
    }

    // Delete the user row — cascades to csvImports, transactions, monthlyAnalytics,
    // forecasts, categoryRules, and categoryCorrections (all @relation onDelete: Cascade)
    await prisma.user.delete({ where: { id: userId } }).catch((err) => {
      // If the profile row doesn't exist for some reason, continue — we still
      // want to remove the auth account so the user can leave.
      if (err?.code !== "P2025") throw err;
    });

    // Finally, remove the authentication account itself
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("Delete auth user error:", authError.message);
      return NextResponse.json({ error: "Failed to delete authentication account" }, { status: 500 });
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
