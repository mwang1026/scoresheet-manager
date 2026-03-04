"use client";

import { SessionProvider } from "next-auth/react";
import { PostHogProvider } from "@/lib/contexts/posthog-context";
import { TeamProvider } from "@/lib/contexts/team-context";
import { SettingsProvider } from "@/lib/contexts/settings-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostHogProvider>
        <TeamProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </TeamProvider>
      </PostHogProvider>
    </SessionProvider>
  );
}
