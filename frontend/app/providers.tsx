"use client";

import { TeamProvider } from "@/lib/contexts/team-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <TeamProvider>{children}</TeamProvider>;
}
