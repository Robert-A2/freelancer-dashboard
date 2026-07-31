import * as Sentry from "@sentry/nextjs";

// Covers src/middleware.ts (runs on the edge runtime) — same DSN-gated
// pattern as sentry.server.config.ts.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
