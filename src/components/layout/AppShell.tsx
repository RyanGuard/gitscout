"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  // While loading, show minimal layout
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-background-tertiary)" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300" style={{ borderTopColor: "#C8A55A" }} />
      </div>
    );
  }

  // Not authenticated — render children without shell (landing page)
  if (!session) {
    return <>{children}</>;
  }

  // Authenticated — render with sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-w-0 overflow-auto"
        style={{ background: "var(--color-background-tertiary)" }}
      >
        {children}
      </main>
    </div>
  );
}
