import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getExpectedPayments } from "@/lib/expected-payment-engine";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount, clientName, projectName, expectedDate, activityType } = body as {
      amount?: number;
      clientName?: string | null;
      projectName?: string | null;
      expectedDate?: string;
      // Only meaningful when the user's tax profile activityType is "mixed"
      // (Tax & Contributions spec section 5) — which activity this payment
      // belongs to.
      activityType?: string | null;
    };

    if (!Number.isFinite(amount) || (amount as number) <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }
    if (!expectedDate) {
      return NextResponse.json({ error: "Expected date is required." }, { status: 400 });
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, fullName: user.user_metadata?.full_name ?? "", email: user.email ?? "" },
    });

    const expectedPayment = await prisma.expectedPayment.create({
      data: {
        userId: user.id,
        amount: new Decimal(amount as number),
        clientName: clientName?.trim() || null,
        projectName: projectName?.trim() || null,
        expectedDate: new Date(expectedDate),
        activityType: activityType || null,
      },
    });

    return NextResponse.json({ expectedPayment });
  } catch (error) {
    console.error("Create expected payment error:", error);
    return NextResponse.json({ error: "Failed to save expected payment" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const expectedPayments = await getExpectedPayments(user.id);
    return NextResponse.json({ expectedPayments });
  } catch (error) {
    console.error("List expected payments error:", error);
    return NextResponse.json({ error: "Failed to load expected payments" }, { status: 500 });
  }
}
