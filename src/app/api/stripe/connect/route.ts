import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { createConnectedAccount, createAccountOnboardingLink } from "@/lib/stripe";

// Creates (or reuses) the freelancer's Stripe Express connected account and
// returns a fresh onboarding link. Called from the Settings page — never
// exposes secret keys to the browser, only the one-time onboarding URL.
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeAccountId: true, email: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let accountId = dbUser.stripeAccountId;
    if (!accountId) {
      const account = await createConnectedAccount(dbUser.email);
      accountId = account.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId },
      });
    }

    const link = await createAccountOnboardingLink(
      accountId,
      "/settings?stripeReturn=1",
      "/settings?stripeRefresh=1"
    );

    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Stripe connect error:", error);
    return NextResponse.json({ error: "Failed to start Stripe connection" }, { status: 500 });
  }
}
