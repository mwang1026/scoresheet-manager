"use client";

import { SessionProvider } from "next-auth/react";
import { TeamProvider } from "@/lib/contexts/team-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TeamProvider>{children}</TeamProvider>
    </SessionProvider>
  );
}
