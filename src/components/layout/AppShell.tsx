"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // While loading, show minimal layout
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border" style={{ borderTopColor: "#C8A55A" }} />
      </div>
    );
  }

  // Not authenticated — render children without shell (landing page)
  if (!session) {
    return <>{children}</>;
  }

  // Dark pages: search, profile, match
  const isDarkPage = pathname.startsWith("/search") || pathname.startsWith("/profile") || pathname.startsWith("/match");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className={`flex-1 min-w-0 overflow-auto ${isDarkPage ? "dark" : ""}`}
        style={{ background: isDarkPage ? "#0a0a0f" : "var(--color-bg)" }}
      >
        {children}
      </main>
    </div>
  );
}
