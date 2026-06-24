"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-5">
      <div className="card max-w-md w-full space-y-6">
        <div className="space-y-2">
          <p className="label">Something went wrong</p>
          <h1 className="text-xl font-semibold text-[#D8E8F4]">
            We couldn&apos;t load this page
          </h1>
          <p className="text-sm text-[#8AAEC8]">
            A temporary error occurred. Your data is safe — try refreshing or
            come back in a moment.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="btn-primary px-5 py-2 rounded-xl text-sm font-medium">
            Try again
          </button>
          <Link
            href="/dashboard"
            className="btn-secondary px-5 py-2 rounded-xl text-sm font-medium text-center"
          >
            Go to dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="text-[11px] text-[#4A6882]">Error ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
