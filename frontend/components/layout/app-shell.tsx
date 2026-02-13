"use client";

import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-14 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
