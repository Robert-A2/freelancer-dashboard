import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

// Lazily constructed — module import alone must never touch the Stripe SDK
// constructor. Next.js imports every route module during build-time page-data
// collection, so an eager `new Stripe(...)` with a missing/placeholder key
// would break `next build` even for routes that are never actually invoked.
function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (test mode: sk_test_...) before using any payment feature."
    );
  }
  if (!globalForStripe.stripe) {
    globalForStripe.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return globalForStripe.stripe;
}

export function assertStripeConfigured(): void {
  getStripeClient();
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// ── Stripe Connect (Express accounts) ─────────────────────────────────────────
// Freelancers receive milestone payments directly into their own Stripe
// balance — this platform never touches or holds client money. An Express
// account gives the fastest onboarding (Stripe-hosted KYC) while still
// letting money flow straight to the freelancer's bank account.

export async function createConnectedAccount(userEmail: string): Promise<Stripe.Account> {
  return getStripeClient().accounts.create({
    type: "express",
    email: userEmail,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
  });
}

export async function createAccountOnboardingLink(
  stripeAccountId: string,
  returnPath: string,
  refreshPath: string
): Promise<Stripe.AccountLink> {
  const base = getSiteUrl();
  return getStripeClient().accountLinks.create({
    account: stripeAccountId,
    return_url: `${base}${returnPath}`,
    refresh_url: `${base}${refreshPath}`,
    type: "account_onboarding",
  });
}

export async function getAccountStatus(stripeAccountId: string): Promise<Stripe.Account> {
  return getStripeClient().accounts.retrieve(stripeAccountId);
}

// Called when a user deletes their Nonodia account — Nonodia is the platform
// responsible for this Express account, so deleting it here actually closes
// it on Stripe's side rather than just forgetting the id in our own database.
// Stripe rejects deletion if the account still holds a balance or has
// pending payouts; callers should treat failure as non-fatal and surface it
// rather than block the rest of account deletion on it.
export async function deleteConnectedAccount(stripeAccountId: string): Promise<void> {
  await getStripeClient().accounts.del(stripeAccountId);
}

// ── Checkout Session for a single Milestone ───────────────────────────────────
// A direct charge on the freelancer's connected account: the full charge
// settles into their Stripe balance, minus Nonodia's application fee, which
// Stripe routes to the platform's own account in the same transaction. The
// client is charged the same amount either way — the fee only ever reduces
// what the freelancer receives, never what the client pays.
// projectId/milestoneId travel in metadata so the webhook can find the exact
// row to update without trusting anything from the client.

export async function createMilestoneCheckoutSession(params: {
  stripeAccountId: string;
  milestoneId: string;
  projectId: string;
  label: string;
  projectName: string;
  clientName: string;
  amount: number;
  platformFeeAmount: number;
  currency: string;
  paymentUrlToken: string;
}): Promise<Stripe.Checkout.Session> {
  const base = getSiteUrl();
  const { stripeAccountId, milestoneId, projectId, label, projectName, clientName, amount, platformFeeAmount, currency, paymentUrlToken } = params;

  return getStripeClient().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `${projectName} — ${label}`,
              description: `Milestone payment for ${clientName}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round(platformFeeAmount * 100),
      },
      metadata: { milestoneId, projectId },
      success_url: `${base}/pay/${paymentUrlToken}?paid=1`,
      cancel_url: `${base}/pay/${paymentUrlToken}`,
    },
    { stripeAccount: stripeAccountId }
  );
}

// ── Webhook signature verification ────────────────────────────────────────────

export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }
  return getStripeClient().webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
