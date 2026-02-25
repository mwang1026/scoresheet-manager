"use client";

import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { SeasonConfigBanner } from "./season-config-banner";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SeasonConfigBanner />
        <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
