export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // The Stripe SDK prints any "stripe-notice" response header it receives as
  // a Node process warning (see stripe/RequestSender.js `_emitStripeNotice`).
  // Stripe's own API sends one recommending the newer Accounts v2 API on
  // certain v1 Connect account calls — informational, not an error, and not
  // something this app's code controls. Next.js's dev overlay surfaces any
  // server console warning as a "Console Error", which reads as a real bug.
  // This filters out only that one specific message; every other warning
  // (including genuine deprecation notices worth seeing) still prints normally.
  const originalEmitWarning = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const message = typeof warning === "string" ? warning : warning.message;
    if (message.includes("Accounts v2")) return;
    return (originalEmitWarning as (...a: unknown[]) => void)(warning, ...args);
  }) as typeof process.emitWarning;
}
