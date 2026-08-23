import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { PROJECTS_ENABLED } from "@/lib/feature-flags";

// Freelancer-side status updates only ("sent" when the link is copied/shared).
// "paid"/"cleared" are never set here — those are exclusively the webhook's
// and the CSV-matcher's job, since client-side/manual confirmation can never
// be trusted for money.
const ALLOWED_STATUSES = new Set(["sent"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Projects/Milestones paused — see feature-flags.ts.
  if (!PROJECTS_ENABLED) return NextResponse.json({ error: "Not available" }, { status: 404 });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      label?: string;
      amount?: number;
      dueDate?: string | null;
    };

    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone || milestone.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // ── Status transition: pending -> sent ──────────────────────────────────
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (milestone.status !== "pending") {
        return NextResponse.json({ milestone });
      }
      const updated = await prisma.milestone.update({ where: { id }, data: { status: "sent" } });
      return NextResponse.json({ milestone: updated });
    }

    // ── Field edits: label / amount / dueDate ───────────────────────────────
    // Only while still "pending" — once a link has been sent, the client may
    // already be looking at a specific amount, and once paid it's final.
    // Changing terms out from under either would be misleading.
    if (milestone.status !== "pending") {
      return NextResponse.json({ error: "Only a not-yet-sent milestone can be edited." }, { status: 409 });
    }

    const data: { label?: string; amount?: Decimal; dueDate?: Date | null } = {};
    if (body.label !== undefined) {
      if (!body.label.trim()) return NextResponse.json({ error: "Label cannot be empty." }, { status: 400 });
      data.label = body.label.trim();
    }
    if (body.amount !== undefined) {
      if (!Number.isFinite(body.amount) || body.amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
      }
      data.amount = new Decimal(body.amount);
    }
    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.milestone.update({ where: { id }, data });
    return NextResponse.json({ milestone: updated });
  } catch (error) {
    console.error("Update milestone error:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!PROJECTS_ENABLED) return NextResponse.json({ error: "Not available" }, { status: 404 });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone || milestone.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // A sent-but-unpaid milestone's link may already be in a client's inbox —
    // deleting it out from under them would break that link with no
    // explanation. Only a never-sent milestone can be removed outright.
    if (milestone.status !== "pending") {
      return NextResponse.json(
        { error: "Only a not-yet-sent milestone can be deleted." },
        { status: 409 }
      );
    }

    await prisma.milestone.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete milestone error:", error);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}
