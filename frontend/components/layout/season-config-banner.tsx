"use client";

import { useState } from "react";
import { needsSeasonConfigUpdate, getSeasonYear } from "@/lib/defaults";

const SESSION_KEY = "season-config-banner-dismissed";

export function SeasonConfigBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });

  const needsUpdate = needsSeasonConfigUpdate(new Date());

  if (!needsUpdate || dismissed) return null;

  const year = getSeasonYear(new Date());

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "1");
    }
  };

  return (
    <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-amber-800">
        Season dates for {year} haven&apos;t been configured yet. Update{" "}
        <code className="font-mono text-xs bg-amber-200 px-1 rounded">SEASON_CONFIG</code> in{" "}
        <code className="font-mono text-xs bg-amber-200 px-1 rounded">frontend/lib/defaults.ts</code>{" "}
        with Opening Day and season end dates.
      </span>
      <button
        onClick={handleDismiss}
        className="ml-4 text-amber-700 hover:text-amber-900 font-medium shrink-0"
        aria-label="Dismiss season config warning"
      >
        ✕
      </button>
    </div>
  );
}
