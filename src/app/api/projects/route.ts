import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

interface MilestoneInput {
  label: string;
  amount: number;
  dueDate?: string | null;
}

// Creates a Project + its Milestones in one call. This is the "day one, no
// CSV" entry point — a brand new user can land here before ever uploading a
// bank statement, so (like the upload route) we defensively upsert the User
// row rather than assuming it already exists.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { clientName, projectName, totalValue, milestones, vatRatePct, isReverseCharge } = body as {
      clientName?: string;
      projectName?: string;
      totalValue?: number;
      milestones?: MilestoneInput[];
      vatRatePct?: number | null;
      isReverseCharge?: boolean;
    };

    if (!clientName?.trim() || !projectName?.trim()) {
      return NextResponse.json({ error: "Client name and project name are required." }, { status: 400 });
    }
    if (!Number.isFinite(totalValue) || (totalValue as number) <= 0) {
      return NextResponse.json({ error: "Total value must be a positive number." }, { status: 400 });
    }
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return NextResponse.json({ error: "At least one milestone is required." }, { status: 400 });
    }
    for (const m of milestones) {
      if (!m.label?.trim() || !Number.isFinite(m.amount) || m.amount <= 0) {
        return NextResponse.json({ error: "Each milestone needs a label and a positive amount." }, { status: 400 });
      }
    }
    const milestoneSum = milestones.reduce((s, m) => s + m.amount, 0);
    if (Math.abs(milestoneSum - (totalValue as number)) > 0.01) {
      return NextResponse.json({ error: "Milestone amounts must add up to the total project value." }, { status: 400 });
    }
    if (vatRatePct != null && (!Number.isFinite(vatRatePct) || vatRatePct < 0 || vatRatePct > 100)) {
      return NextResponse.json({ error: "Tax rate must be between 0 and 100." }, { status: 400 });
    }

    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
      },
      select: { vatStatus: true },
    });

    // Charging VAT while not registered is illegal — re-derive the
    // registration state server-side rather than trusting the request body,
    // same principle as re-deriving Stripe amounts from the DB at checkout.
    const canChargeVat = dbUser.vatStatus === "registered";
    const effectiveVatRatePct = canChargeVat ? vatRatePct ?? null : null;
    const effectiveIsReverseCharge = canChargeVat ? !!isReverseCharge : false;

    // Simple sequential numbering: count what this user already has and
    // continue from there. Not safe against two concurrent creates racing
    // (rare for a single freelancer using one tab at a time), but that's the
    // right tradeoff for a per-user invoice number, not a legal registry.
    const existingMilestoneCount = await prisma.milestone.count({ where: { userId: user.id } });

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        totalValue: new Decimal(totalValue as number),
        currency: "EUR",
        milestones: {
          create: milestones.map((m, i) => ({
            userId: user.id,
            label: m.label.trim(),
            amount: new Decimal(m.amount),
            currency: "EUR",
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
            sortOrder: i,
            invoiceNumber: existingMilestoneCount + i + 1,
            vatRatePct: effectiveVatRatePct != null ? new Decimal(effectiveVatRatePct) : null,
            isReverseCharge: effectiveIsReverseCharge,
          })),
        },
      },
      include: { milestones: true },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: { milestones: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("List projects error:", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}
