import * as Sentry from "@sentry/nextjs";

// Guarded on the DSN being set rather than always calling Sentry.init() —
// keeps local dev console output clean until a real Sentry project exists.
// Set NEXT_PUBLIC_SENTRY_DSN (see .env.local) to activate.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Low default — raise once there's a real DSN and a sense of event volume.
    tracesSampleRate: 0.1,
  });
}

// Required by the SDK to capture client-side route-change errors/performance.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
