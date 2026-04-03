"use client";

import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SoundProvider } from "@/components/ui/SoundToggle";
import { CelebrationProvider } from "@/components/features/Celebrations";
import { KeyboardOverlay } from "@/components/features/KeyboardOverlay";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>
        <PostHogProvider>
          <SoundProvider>
            <CelebrationProvider>
              {children}
              <KeyboardOverlay />
            </CelebrationProvider>
          </SoundProvider>
        </PostHogProvider>
      </QueryProvider>
    </SessionProvider>
  );
}
