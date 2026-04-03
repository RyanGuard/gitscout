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

/**
 * Authenticate a request via session OR eval API key.
 * Returns the user ID if authenticated, null otherwise.
 * The eval API key (EVAL_API_KEY env var) lets the VPS eval agents
 * call authenticated endpoints without a browser session.
 */
export async function getAuthUserId(request?: Request): Promise<string | null> {
  // Check eval API key first (header-based auth for eval agents)
  if (request) {
    const evalKey = request.headers.get("x-eval-api-key");
    if (evalKey && process.env.EVAL_API_KEY && evalKey === process.env.EVAL_API_KEY) {
      // Return the configured eval user ID (the account the eval agents act as)
      return process.env.EVAL_USER_ID || "eval-service";
    }
  }

  // Fall back to session auth
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
