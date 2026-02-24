"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Scoresheet Manager</h1>
          <p className="text-sm text-muted-foreground">
            Fantasy baseball management for Scoresheet leagues.
          </p>
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
