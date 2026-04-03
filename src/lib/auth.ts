// NextAuth configuration for Scout
//
// GitHub OAuth App:
//   Callback URL: {ORIGIN}/api/auth/callback/github
//   Local: http://localhost:3000/api/auth/callback/github
//
// Google OAuth (Google Cloud Console → APIs & Services → Credentials → OAuth 2.0):
//   Authorized JavaScript origins: http://localhost:3000 and your production origin
//   Authorized redirect URIs: {ORIGIN}/api/auth/callback/google
//   Env vars (either pair works):
//     GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET  (Google / NextAuth default names)
//     GOOGLE_ID + GOOGLE_SECRET                (legacy Scout names)
//
// Always set: NEXTAUTH_SECRET, NEXTAUTH_URL (e.g. http://localhost:3000 locally, https://your-domain on Vercel)
//
// Email magic links: add EmailProvider + Resend when re-enabled (RESEND_API_KEY, EMAIL_FROM).

import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET;

// GitHub is the primary provider. Use signIn("github") in clients and
// githubSignInUrl() from @/lib/auth-signin for redirects so optional Google (below)
// does not replace one-click GitHub with a provider picker.
const providers: NextAuthOptions["providers"] = [
  GitHubProvider({
    clientId: process.env.GITHUB_ID || "",
    clientSecret: process.env.GITHUB_SECRET || "",
    authorization: {
      params: {
        prompt: "consent",
      },
    },
  }),
];

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
} else if (process.env.NODE_ENV === "development") {
  console.warn(
    "[auth] Google sign-in disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or GOOGLE_ID and GOOGLE_SECRET)."
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  providers,
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
};

/** Parse `Cookie` header into a name→value map (for Route Handler session lookup). */
function cookiesFromRequest(request: Request): Record<string, string> {
  const header = request.headers.get("cookie");
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    if (name) out[name] = value;
  }
  return out;
}

/**
 * Authenticate a request via session OR eval API key.
 * Returns the user ID if authenticated, null otherwise.
 * The eval API key (EVAL_API_KEY env var) lets the VPS eval agents
 * call authenticated endpoints without a browser session.
 *
 * When a `Request` is passed (App Router route handlers), session is resolved from
 * that request's Cookie header. Relying only on `getServerSession(authOptions)` can
 * return null for client `fetch()` calls in some Next.js versions.
 */
export async function getAuthUserId(request?: Request): Promise<string | null> {
  if (request) {
    const evalKey = request.headers.get("x-eval-api-key");
    if (evalKey && process.env.EVAL_API_KEY && evalKey === process.env.EVAL_API_KEY) {
      return process.env.EVAL_USER_ID || "eval-service";
    }

    const reqLike = {
      headers: Object.fromEntries(request.headers.entries()),
      cookies: cookiesFromRequest(request),
    };
    const resStub = {
      getHeader() {},
      setCookie() {},
      setHeader() {},
    };
    // next-auth types target Pages router; this shape matches what AuthHandler reads for "session".
    const session = await getServerSession(
      reqLike as never,
      resStub as never,
      authOptions
    );
    if (session?.user?.id) return session.user.id;
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

// Extend the session type to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface NextAuthOptions {
    /** Supported at runtime (e.g. Vercel); not always in published types. */
    trustHost?: boolean;
  }
}
