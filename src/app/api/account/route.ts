import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { deleteConnectedAccount } from "@/lib/stripe";

// Legacy bucket from a since-removed upload path — kept here purely as
// defensive cleanup for any file a past version of the app may have left
// behind. Nothing in the current app writes to it.
const CSV_BUCKET = "csv-imports";
const LOGO_BUCKET = "brand-logos";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.id;
    const admin = createAdminClient();

    // Read the Stripe Connect link (if any) before the row that stores it is
    // gone — otherwise there'd be no way to know which Stripe account to close.
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountId: true },
    });

    // Remove any files left in storage under this user's folder, in both
    // buckets — a public logo left behind after "deletion" would still be
    // reachable at its public URL, which would make "we delete everything"
    // false.
    for (const bucket of [CSV_BUCKET, LOGO_BUCKET]) {
      const { data: files } = await admin.storage.from(bucket).list(userId);
      if (files && files.length > 0) {
        await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
      }
    }

    // Delete the user row — cascades to accounts, csvImports, transactions,
    // monthlyAnalytics, forecasts, categoryRules, categoryCorrections,
    // userIntentRules, payers, projects, and milestones (all @relation
    // onDelete: Cascade in schema.prisma).
    await prisma.user.delete({ where: { id: userId } }).catch((err) => {
      // If the profile row doesn't exist for some reason, continue — we still
      // want to remove the auth account so the user can leave.
      if (err?.code !== "P2025") throw err;
    });

    // Close the Stripe Connect account too — otherwise "delete everything"
    // would leave a live Express account (including bank details Stripe holds
    // for payouts) sitting on Stripe's side indefinitely. Stripe refuses this
    // if the account still has a balance or pending payouts; that's a real
    // constraint outside our control, so it's logged and surfaced rather than
    // silently swallowed, without blocking the rest of account deletion.
    let stripeDeletionFailed = false;
    if (dbUser?.stripeAccountId) {
      try {
        await deleteConnectedAccount(dbUser.stripeAccountId);
      } catch (err) {
        stripeDeletionFailed = true;
        console.error(`Failed to close Stripe account for deleted user ${userId}:`, err);
      }
    }

    // Finally, remove the authentication account itself
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("Delete auth user error:", authError.message);
      return NextResponse.json({ error: "Failed to delete authentication account" }, { status: 500 });
    }

    await supabase.auth.signOut();

    return NextResponse.json({ success: true, stripeDeletionFailed });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
