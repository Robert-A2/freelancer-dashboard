import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { descriptionFingerprint, normalizeMatchKey } from "@/lib/payer-engine";

// POST /api/payers/assign
// Body: { description: string; newName: string }
// Creates (or reuses) a Payer from a user-provided name and links it to all
// payerId:null income transactions whose description shares the same fingerprint.
// The fingerprint is also stored as a PayerAlias matchKey so future imports
// auto-resolve without asking again.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { description, newName } = body as { description?: string; newName?: string };

    if (typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    const trimmedName = typeof newName === "string" ? newName.trim().slice(0, 60) : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "newName is required" }, { status: 400 });
    }

    const fp = descriptionFingerprint(description);
    const mkName = normalizeMatchKey(trimmedName);

    // Upsert the Payer — user's provided name becomes both canonical and display name.
    const payer = await prisma.payer.upsert({
      where:  { userId_canonicalName: { userId: user.id, canonicalName: trimmedName } },
      update: { displayName: trimmedName, updatedAt: new Date() },
      create: { userId: user.id, canonicalName: trimmedName, displayName: trimmedName, payerType: "client" },
    });

    // Store the description fingerprint as an alias so resolvePayers() can match
    // future transactions automatically (no need to prompt the user again).
    if (fp) {
      await prisma.payerAlias.upsert({
        where:  { payerId_matchKey: { payerId: payer.id, matchKey: fp } },
        update: { hitCount: { increment: 1 } },
        create: { payerId: payer.id, rawText: description.slice(0, 80), matchKey: fp, hitCount: 1 },
      }).catch(() => { /* non-critical if fp collides */ });
    }

    // Also store the normalized name key so the standard matchKey lookup works.
    if (mkName && mkName !== fp) {
      await prisma.payerAlias.upsert({
        where:  { payerId_matchKey: { payerId: payer.id, matchKey: mkName } },
        update: { hitCount: { increment: 1 } },
        create: { payerId: payer.id, rawText: trimmedName, matchKey: mkName, hitCount: 1 },
      }).catch(() => { /* non-critical */ });
    }

    // Find all payerId:null income transactions belonging to this user and
    // filter to those whose description fingerprint matches.
    const nullTxs = await prisma.transaction.findMany({
      where:  { userId: user.id, transactionType: "income", payerId: null },
      select: { id: true, description: true },
    });

    const matchingIds = nullTxs
      .filter(tx => descriptionFingerprint(tx.description) === fp)
      .map(tx => tx.id);

    if (matchingIds.length > 0) {
      await prisma.transaction.updateMany({
        where: { id: { in: matchingIds } },
        data:  { payerId: payer.id, needsReview: false },
      });
    }

    return NextResponse.json({ success: true, payerId: payer.id, updatedCount: matchingIds.length });
  } catch (error) {
    console.error("Assign payer error:", error);
    return NextResponse.json({ error: "Failed to assign payer" }, { status: 500 });
  }
}
