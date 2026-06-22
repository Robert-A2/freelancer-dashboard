import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildUserDigest } from "@/lib/digest-engine";
import { sendDigestEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      weeklyDigestOptIn: true,
      digestUnsubscribeToken: { not: null },
    },
    select: { id: true, email: true, fullName: true, digestUnsubscribeToken: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.digestUnsubscribeToken) continue;
    try {
      const digest = await buildUserDigest(user.id, {
        email: user.email,
        fullName: user.fullName,
        digestUnsubscribeToken: user.digestUnsubscribeToken,
      });
      if (!digest) { skipped++; continue; }
      await sendDigestEmail(digest);
      sent++;
    } catch (err) {
      console.error(`[digest] failed for ${user.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ sent, skipped, failed });
}
