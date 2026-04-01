/**
 * Returns a safe error message for API responses.
 * In development, returns the actual error message for debugging.
 * In production, returns the generic fallback to avoid leaking internals.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  console.error(`[api-error] ${fallback}:`, error);
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : fallback;
  }
  return fallback;
}
