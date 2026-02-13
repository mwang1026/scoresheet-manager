"use client";

import { User } from "lucide-react";

export function UserMenu() {
  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-muted-foreground lg:hidden" />
        <div className="hidden lg:block">
          <p className="text-xs text-muted-foreground">user@example.com</p>
          <p className="text-xs text-muted-foreground">Log out</p>
        </div>
      </div>
    </div>
  );
}
