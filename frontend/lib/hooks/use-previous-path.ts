"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav-items";

const STORAGE_KEY = "previousPath";

/** Mount in AppShell to track route changes */
export function PreviousPathTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Don't overwrite when navigating to a player detail page
    if (!pathname.match(/^\/players\/\d+/)) {
      sessionStorage.setItem(STORAGE_KEY, pathname);
    }
  }, [pathname]);
  return null;
}

/** Read the previous path and return a "Back to X" label */
export function usePreviousPathLabel(): string {
  const stored =
    typeof window !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY)
      : null;
  if (!stored) return "Back";
  const match = NAV_ITEMS.find((item) =>
    item.href === "/" ? stored === "/" : stored.startsWith(item.href)
  );
  return match ? `Back to ${match.label}` : "Back";
}
