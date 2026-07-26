import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { isValidBrandFontKey } from "@/lib/brand-font-options";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      brandLogoUrl?: string | null;
      brandAccentColor?: string | null;
      brandFont?: string | null;
      businessName?: string | null;
    };

    if (body.brandAccentColor != null && !HEX_COLOR.test(body.brandAccentColor)) {
      return NextResponse.json({ error: "brandAccentColor must be a hex color like #2FA393" }, { status: 400 });
    }
    if (body.brandFont != null && !isValidBrandFontKey(body.brandFont)) {
      return NextResponse.json({ error: "Unknown brandFont" }, { status: 400 });
    }

    const data = {
      ...(body.brandLogoUrl !== undefined && { brandLogoUrl: body.brandLogoUrl }),
      ...(body.brandAccentColor !== undefined && { brandAccentColor: body.brandAccentColor }),
      ...(body.brandFont !== undefined && { brandFont: body.brandFont }),
      ...(body.businessName !== undefined && { businessName: body.businessName }),
    };

    // Same defensive upsert as /api/projects and /api/uploads/process — Settings
    // is reachable before a user has ever uploaded a CSV or created a project,
    // so their User row may not exist yet. A plain .update() would 500 here.
    const updated = await prisma.user.upsert({
      where: { id: user.id },
      update: data,
      create: {
        id: user.id,
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        ...data,
      },
      select: { brandLogoUrl: true, brandAccentColor: true, brandFont: true, businessName: true },
    });

    return NextResponse.json({ branding: updated });
  } catch (error) {
    console.error("Update branding error:", error);
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }
}
