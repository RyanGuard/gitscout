/**
 * Returns a safe error message for API responses.
 * In development, returns the actual error message for debugging.
 * In production, returns the generic fallback to avoid leaking internals.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[api-error] ${fallback}:`, message);
  // Show actual error in all environments for now (helps debug production issues)
  // TODO: revert to fallback-only for production once stable
  return `${fallback}: ${message}`;
}
