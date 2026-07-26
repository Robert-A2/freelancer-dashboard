import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

interface Body {
  country?: string | null;
  businessLegalStatus?: string | null;
  activityType?: string | null;
  vatStatus?: string | null;
  vatNumber?: string | null;
  manualReservePctOverride?: number | null;
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as Body;
    const data: Record<string, string | null | Decimal> = {};

    for (const key of ["country", "businessLegalStatus", "activityType", "vatStatus", "vatNumber"] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    // Charging VAT while not registered is illegal — vatNumber only ever
    // makes sense alongside vatStatus === "registered". Clearing the status
    // (or never setting it) always clears the number too, so a stale number
    // from a past registration can never linger and get shown on an invoice.
    if (data.vatStatus !== undefined && data.vatStatus !== "registered" && body.vatNumber === undefined) {
      data.vatNumber = null;
    }

    if (body.manualReservePctOverride !== undefined) {
      if (body.manualReservePctOverride !== null && (!Number.isFinite(body.manualReservePctOverride) || body.manualReservePctOverride < 0 || body.manualReservePctOverride > 100)) {
        return NextResponse.json({ error: "Reserve percentage must be between 0 and 100." }, { status: 400 });
      }
      data.manualReservePctOverride = body.manualReservePctOverride === null ? null : new Decimal(body.manualReservePctOverride);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    // Financial Profile / VAT settings are reachable before a user has ever
    // uploaded a CSV or created a project, so their User row may not exist
    // yet — same defensive upsert as /api/projects and /api/branding.
    await prisma.user.upsert({
      where: { id: user.id },
      update: data,
      create: {
        id: user.id,
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        ...data,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update financial profile error:", error);
    return NextResponse.json({ error: "Failed to update financial profile" }, { status: 500 });
  }
}
