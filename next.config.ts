import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withSentryConfig(withNextIntl(nextConfig), {
  // No org/project/authToken set — sourcemap upload is skipped rather than
  // attempted and failing until a real Sentry project exists (add
  // SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT to enable it later).
  silent: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
