"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "./Sidebar";

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

  // Not authenticated — render children without shell (landing page)
  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
