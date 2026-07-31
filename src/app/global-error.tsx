"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Root-level error boundary — catches errors that escape the layout itself
// (the (dashboard)/error.tsx boundary only covers that route group). Next.js
// requires this file to render its own <html>/<body>; it replaces the whole
// page when it triggers, so it's deliberately minimal rather than styled.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1.5rem" }}>
          <div>
            <h1>Something went wrong</h1>
            <p>Please refresh the page. If this keeps happening, contact robertkofi.arthur@gmail.com.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
