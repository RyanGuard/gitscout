"use client";

import { useSession, signIn } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

function GuestTopBar() {
  const pathname = usePathname();
  // Don't show on landing page — it has its own sign-in button
  if (pathname === "/") return null;

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.5" stroke="#19191A" strokeWidth="2" />
            <path d="M12 12.5c-4 0-7 2.5-7 5.5h14c0-3-3-5.5-7-5.5z" stroke="#19191A" strokeWidth="2" strokeLinejoin="round" />
            <path d="M18 4l2.5 2.5M18 9l2.5-2.5" stroke="#19191A" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-sm font-bold text-foreground" style={{ letterSpacing: "-0.03em" }}>Scout</span>
      </Link>
      <button
        onClick={() => signIn("github")}
        className="flex items-center gap-1.5 rounded-lg border border-gold-border bg-gold-bg px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:bg-gold/10"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // While loading, show minimal layout
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-gold" />
      </div>
    );
  }

  // Not authenticated — show guest top bar + children
  if (!session) {
    return (
      <>
        <GuestTopBar />
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto bg-background">
        {children}
      </main>
      <OnboardingFlow />
    </div>
  );
}
