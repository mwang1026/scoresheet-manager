"use client";

import { getPlayoffWindow } from "@/lib/defaults";
import {
  HITTER_SERIES_PA_PCT,
  PITCHER_SERIES_IP_PCT,
  PLAYOFF_WINDOW_WEIGHT,
  formatPlayoffWindow,
} from "@/lib/stats/playoff";

interface PlayoffModeNoteProps {
  seasonYear: number;
}

/** One-line reminder of how playoff-mode numbers are built. Shown next to the source toggle. */
export function PlayoffModeNote({ seasonYear }: PlayoffModeNoteProps) {
  const window = getPlayoffWindow(seasonYear);
  return (
    <span className="text-xs text-muted-foreground" data-testid="playoff-mode-note">
      {formatPlayoffWindow(window)} stats ×{PLAYOFF_WINDOW_WEIGHT} + earlier season · series caps{" "}
      {Math.round(HITTER_SERIES_PA_PCT * 100)}% PA / {Math.round(PITCHER_SERIES_IP_PCT * 100)}% IP
    </span>
  );
}
