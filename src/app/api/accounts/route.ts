import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { AccountType } from "@prisma/client";

const VALID_TYPES = new Set<string>([
  "personal_checking", "personal_savings", "business_checking",
  "business_savings", "investment", "credit_card", "other",
]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { userId: user.id, isArchived: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      institution: true,
      accountType: true,
      currency: true,
      color: true,
      _count: { select: { transactions: true } },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    institution?: string;
    accountType?: string;
    currency?: string;
    color?: string;
  };

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const accountType: AccountType = VALID_TYPES.has(body.accountType ?? "")
    ? (body.accountType as AccountType)
    : "personal_checking";

  // Upsert: if the user already has an account with this name, return it unchanged
  const account = await prisma.account.upsert({
    where: { userId_name: { userId: user.id, name } },
    update: {},
    create: {
      userId: user.id,
      name,
      institution: body.institution?.trim() || null,
      accountType,
      currency: body.currency?.trim() || "EUR",
      color: body.color?.trim() || null,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
