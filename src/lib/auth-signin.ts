/**
 * Build a NextAuth URL that starts GitHub OAuth directly.
 * Use this for redirects instead of `/api/auth/signin?callbackUrl=...` so optional
 * Google (or other) providers do not force a provider-selection screen.
 */
export function githubSignInUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/api/auth/signin/github?${new URLSearchParams({ callbackUrl: path }).toString()}`;
}
