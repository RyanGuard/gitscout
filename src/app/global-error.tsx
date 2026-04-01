"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">
        <div className="text-center px-4">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-neutral-400 max-w-md">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-hover transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
