import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { recalculateMonthlyAnalytics } from "@/lib/analytics-engine";
import { recomputeVerifiedRevenue } from "@/lib/payer-engine";
import { generateForecast } from "@/lib/forecast-engine";
import { computePlatformFee } from "@/utils/finance";

// The ONLY place a Milestone is ever allowed to become "paid" — never the
// client redirect, never a freelancer action. Stripe signs every event with
// STRIPE_WEBHOOK_SECRET; constructWebhookEvent() rejects anything that isn't
// a genuine, unmodified event from Stripe.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Ack anything we don't act on so Stripe doesn't keep retrying it.
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const milestoneId = session.metadata?.milestoneId;

  if (!milestoneId) {
    console.error("Stripe webhook: checkout.session.completed missing milestoneId metadata", session.id);
    return NextResponse.json({ received: true });
  }

  try {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone) {
      console.error(`Stripe webhook: milestone ${milestoneId} not found`);
      return NextResponse.json({ received: true });
    }

    // Idempotency — Stripe can and does resend webhooks. A milestone can only
    // be paid once; if it already has a linked Transaction, do nothing.
    if (milestone.transactionId || milestone.status === "paid" || milestone.status === "cleared") {
      return NextResponse.json({ received: true });
    }

    const { project } = milestone;
    const paidAt = new Date();

    // Find-or-create a Payer matching this project's clientName exactly. This
    // is a known, authoritative identity (typed by the freelancer), unlike the
    // fuzzy bank-description matching the CSV path uses — but it lands in the
    // exact same Payer table, so this client's Stripe history and CSV history
    // merge into one identity for client-risk-engine.ts automatically.
    const payer = await prisma.payer.upsert({
      where: { userId_canonicalName: { userId: project.userId, canonicalName: project.clientName } },
      update: {},
      create: { userId: project.userId, canonicalName: project.clientName, payerType: "client" },
    });

    // Same Transaction shape the CSV importer produces — this is the single
    // seam that makes forecast/cashflow/health-score/clients pick this up
    // with zero new logic on their end.
    const transaction = await prisma.transaction.create({
      data: {
        userId: project.userId,
        payerId: payer.id,
        transactionDate: paidAt,
        description: `${project.projectName} — ${milestone.label} (${project.clientName})`,
        amount: milestone.amount,
        transactionType: "income",
        category: "client payment",
        categoryConfidence: "high",
        categorySource: "milestone",
        intent: "freelance_income",
        intentConfidence: "high",
        intentSource: "user",
        needsReview: false,
      },
    });

    // Record Nonodia's cut as its own visible expense line rather than
    // silently netting it out of the income transaction above. The income
    // transaction stays equal to the invoiced milestone amount (so it always
    // reconciles with what the client was told they owed); the fee shows up
    // separately so cashflow/runway reflect what actually lands in the
    // freelancer's bank, and the freelancer can see exactly what Nonodia took.
    const platformFee = computePlatformFee(Number(milestone.amount));
    if (platformFee > 0) {
      await prisma.transaction.create({
        data: {
          userId: project.userId,
          transactionDate: paidAt,
          description: `Nonodia fee — ${project.projectName} — ${milestone.label}`,
          amount: platformFee,
          transactionType: "expense",
          category: "platform fee",
          categoryConfidence: "high",
          categorySource: "milestone",
          intent: "business_expense",
          intentConfidence: "high",
          intentSource: "user",
          needsReview: false,
        },
      });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        status: "paid",
        paidAt,
        stripePaymentIntentId: paymentIntentId,
        transactionId: transaction.id,
      },
    });

    // If every milestone on this project is now paid/cleared, the project is
    // done — mark it completed so it stops competing for attention in the
    // projects list next to genuinely active work.
    const remaining = await prisma.milestone.count({
      where: { projectId: project.id, status: { notIn: ["paid", "cleared"] } },
    });
    if (remaining === 0) {
      await prisma.project.update({ where: { id: project.id }, data: { status: "completed" } });
    }

    // Re-run the exact same recalculation pipeline the CSV upload path
    // triggers after createMany, so cashflow/forecast/health score reflect
    // this payment immediately, not just on the next CSV upload.
    try {
      await recalculateMonthlyAnalytics(project.userId);
      await recomputeVerifiedRevenue(project.userId);
      await generateForecast(project.userId);
    } catch (err) {
      // The Transaction + Milestone update above already committed — this
      // failure only means the cached aggregates are stale until the next
      // recalculation (next upload, or next webhook). Never fail the webhook
      // response for this, or Stripe will retry and risk a duplicate attempt
      // at a step that already succeeded.
      console.error(`Stripe webhook: post-payment recalculation failed for user ${project.userId}:`, err);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    // A 500 here tells Stripe to retry — appropriate for a genuine failure
    // (e.g. a transient DB error) since the payment must not be silently lost.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
