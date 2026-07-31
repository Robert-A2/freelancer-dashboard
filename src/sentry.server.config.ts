import * as Sentry from "@sentry/nextjs";

// Guarded on the DSN being set rather than always calling Sentry.init() —
// keeps local dev console output clean until a real Sentry project exists.
// Set SENTRY_DSN (see .env.local) to activate. Server-side errors are the
// ones that matter most here: this is what would have caught the signup
// silent-failure pattern (a failed write nobody found out about until a
// user reported an empty dashboard) before a user had to report it.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
