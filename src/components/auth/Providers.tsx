"use client";

import { SessionProvider } from "next-auth/react";
import { SoundProvider } from "@/components/ui/SoundToggle";
import { CelebrationProvider } from "@/components/features/Celebrations";
import { KeyboardOverlay } from "@/components/features/KeyboardOverlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SoundProvider>
        <CelebrationProvider>
          {children}
          <KeyboardOverlay />
        </CelebrationProvider>
      </SoundProvider>
    </SessionProvider>
  );
}
