"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
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
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <h2 className="mt-4 text-xl font-semibold text-neutral-800 dark:text-neutral-200">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-hover"
      >
        Try again
      </button>
    </div>
  );
}
