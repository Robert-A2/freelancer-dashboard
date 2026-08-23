import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createMilestoneCheckoutSession } from "@/lib/stripe";
import { computeVatBreakdown, computePlatformFee } from "@/utils/finance";
import { PROJECTS_ENABLED } from "@/lib/feature-flags";

// Stripe's published minimum charge for EUR/GBP-family currencies — below
// this, Stripe itself rejects session creation with an opaque API error.
// Guarding here turns that into a specific, actionable message instead of
// the generic "something went wrong" a client would otherwise see.
const MIN_CHARGE_AMOUNT = 0.5;

// Public route — the caller is the freelancer's client, not a Nonodia account
// holder. Everything needed to build the Checkout Session is re-derived
// server-side from the token; nothing about price or destination account is
// ever trusted from the request body.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Projects/Milestones (and client checkout) paused — see feature-flags.ts.
  if (!PROJECTS_ENABLED) return NextResponse.json({ error: "Not available" }, { status: 404 });
  try {
    const { token } = await params;

    const milestone = await prisma.milestone.findUnique({
      where: { paymentUrlToken: token },
      include: {
        project: {
          include: { user: { select: { stripeAccountId: true, stripeAccountEnabled: true } } },
        },
      },
    });

    if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (milestone.status === "paid" || milestone.status === "cleared") {
      return NextResponse.json({ error: "This milestone has already been paid." }, { status: 409 });
    }

    const { project } = milestone;
    const owner = project.user;
    if (!owner.stripeAccountEnabled || !owner.stripeAccountId) {
      return NextResponse.json({ error: "Payments are not set up for this project yet." }, { status: 503 });
    }

    // Charge the gross amount (net + VAT) — the amount stored on the
    // milestone is always the freelancer's net contract value, VAT is added
    // here at charge time. Re-derived from the DB, never trusted from the client.
    const vatRatePct = milestone.vatRatePct != null ? Number(milestone.vatRatePct) : null;
    const { gross } = computeVatBreakdown(Number(milestone.amount), vatRatePct);

    if (!Number.isFinite(gross) || gross < MIN_CHARGE_AMOUNT) {
      console.error(`Checkout blocked: invalid/too-small amount for milestone ${milestone.id}`, { amount: milestone.amount.toString(), vatRatePct, gross });
      return NextResponse.json({ error: "This payment amount is too small to process." }, { status: 400 });
    }

    // Fee is computed on the net (pre-VAT) contract value — VAT collected on
    // behalf of the tax authority is never Nonodia's to take a cut of.
    const platformFeeAmount = computePlatformFee(Number(milestone.amount));

    let session;
    try {
      session = await createMilestoneCheckoutSession({
        stripeAccountId: owner.stripeAccountId,
        milestoneId: milestone.id,
        projectId: project.id,
        label: milestone.label,
        projectName: project.projectName,
        clientName: project.clientName,
        amount: gross,
        platformFeeAmount,
        currency: milestone.currency,
        paymentUrlToken: milestone.paymentUrlToken,
      });
    } catch (stripeError) {
      // Stripe's own error carries the real reason (restricted account,
      // capability not yet active, etc.) — log it in full so a failure here
      // is diagnosable from the server log instead of a bare "500".
      const message = stripeError instanceof Stripe.errors.StripeError ? stripeError.message : String(stripeError);
      console.error(`Stripe checkout session creation failed for milestone ${milestone.id}:`, message, stripeError);
      return NextResponse.json({ error: "Payments aren't available for this project right now. Please try again shortly or contact the freelancer." }, { status: 502 });
    }

    // Record the session id for reconciliation only — status is never set
    // here. Only the Stripe webhook (Phase 5) may mark a milestone "paid".
    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Create milestone checkout session error:", error);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
