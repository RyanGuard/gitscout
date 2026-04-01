"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { initPostHog, identifyUser, posthog } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      identifyUser(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    }
  }, [session?.user?.id, session?.user?.email, session?.user?.name]);

  useEffect(() => {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.capture("$pageview", { path: pathname });
    }
  }, [pathname]);

  return <>{children}</>;
}
