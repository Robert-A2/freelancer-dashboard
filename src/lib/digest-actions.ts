"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "./prisma";
import { randomUUID } from "crypto";

export async function setDigestOptIn(optIn: boolean): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  if (optIn) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { digestUnsubscribeToken: true },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        weeklyDigestOptIn: true,
        digestUnsubscribeToken: existing?.digestUnsubscribeToken ?? randomUUID(),
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { weeklyDigestOptIn: false },
    });
  }

  return { success: true };
}
