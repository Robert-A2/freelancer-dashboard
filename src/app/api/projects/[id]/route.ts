import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = new Set(["active", "archived"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = (await request.json()) as { clientName?: string; projectName?: string; status?: string };

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: { clientName?: string; projectName?: string; status?: "active" | "archived" } = {};
    if (body.clientName !== undefined) {
      if (!body.clientName.trim()) return NextResponse.json({ error: "Client name cannot be empty." }, { status: 400 });
      data.clientName = body.clientName.trim();
    }
    if (body.projectName !== undefined) {
      if (!body.projectName.trim()) return NextResponse.json({ error: "Project name cannot be empty." }, { status: 400 });
      data.projectName = body.projectName.trim();
    }
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      // "completed" is only ever set automatically (webhook / CSV match) once
      // every milestone clears — never a freelancer-triggered transition.
      if (project.status === "completed" && body.status === "active") {
        return NextResponse.json({ error: "A completed project can't be reopened." }, { status: 409 });
      }
      data.status = body.status as "active" | "archived";
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.project.update({ where: { id }, data });
    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { milestones: { select: { status: true } } },
    });
    if (!project || project.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The underlying Transaction/payment history survives a project delete
    // either way (onDelete: SetNull on Milestone.transaction) — but deleting
    // the freelancer-facing record of a project that was actually paid would
    // still be a confusing loss. Archive instead.
    const hasPaidMilestone = project.milestones.some((m) => m.status === "paid" || m.status === "cleared");
    if (hasPaidMilestone) {
      return NextResponse.json(
        { error: "This project has completed payments — archive it instead of deleting." },
        { status: 409 }
      );
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
