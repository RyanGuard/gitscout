// NextAuth configuration for Scout
// GitHub OAuth App setup required:
//   Homepage URL: https://gitscout-beta.vercel.app
//   Callback URL: https://gitscout-beta.vercel.app/api/auth/callback/github
//   For local dev: http://localhost:3000/api/auth/callback/github
//
// Required env vars: GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET, RESEND_API_KEY

import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import type { SendVerificationRequestParams } from "next-auth/providers/email";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

async function sendVerificationRequest({
  identifier: email,
  url,
}: SendVerificationRequestParams) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Scout <onboarding@resend.dev>",
      to: email,
      subject: "Sign in to Scout",
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:'Instrument Sans',system-ui,sans-serif;padding:40px 20px">
          <div style="text-align:center;margin-bottom:32px">
            <div style="display:inline-block;background:#C8A55A;border-radius:7px;padding:10px 12px">
              <span style="color:#19191A;font-weight:700;font-size:18px">S</span>
            </div>
          </div>
          <h1 style="font-size:20px;font-weight:700;text-align:center;color:#1c1c1a;margin-bottom:8px">
            Sign in to Scout
          </h1>
          <p style="text-align:center;color:#737373;font-size:14px;margin-bottom:32px">
            Click the button below to sign in. This link expires in 24 hours.
          </p>
          <div style="text-align:center;margin-bottom:32px">
            <a href="${url}" style="display:inline-block;background:#C8A55A;color:#fff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none">
              Sign in
            </a>
          </div>
          <p style="text-align:center;color:#a3a3a3;font-size:12px">
            If you didn&rsquo;t request this email, you can ignore it.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
}

export const authOptions: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
        },
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID || "",
      clientSecret: process.env.GOOGLE_SECRET || "",
    }),
  ],
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
}
