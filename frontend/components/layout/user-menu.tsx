"use client";

import { User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "Not signed in";

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-muted-foreground lg:hidden" />
        <div className="hidden lg:block">
          <p className="text-xs text-muted-foreground">{email}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
