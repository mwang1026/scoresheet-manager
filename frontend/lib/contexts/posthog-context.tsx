"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

// Initialize the posthog singleton at module level (guarded for SSR).
// posthog.init() is a no-op if already initialized with the same token.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    defaults: "2026-01-30",
    persistence: "memory",
    capture_pageview: "history_change",
    capture_pageleave: "if_capture_pageview",
    person_profiles: "identified_only",
    autocapture: true,
  });
}

/** Identifies/resets the PostHog user based on NextAuth session state. */
function PostHogIdentifier({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    if (status === "authenticated" && session?.user?.email) {
      posthog.identify(session.user.email);
    } else if (status === "unauthenticated") {
      posthog.reset();
    }
  }, [session, status]);

  return <>{children}</>;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier>{children}</PostHogIdentifier>
    </PHProvider>
  );
}
