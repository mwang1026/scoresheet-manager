"use client";

import { SessionProvider } from "next-auth/react";
import { TeamProvider } from "@/lib/contexts/team-context";
import { SettingsProvider } from "@/lib/contexts/settings-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TeamProvider>
        <SettingsProvider>{children}</SettingsProvider>
      </TeamProvider>
    </SessionProvider>
  );
}
