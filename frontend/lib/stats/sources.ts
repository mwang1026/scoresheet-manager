/**
 * Stats source helpers.
 *
 * Three sources feed every stats view:
 * - "actual":    real daily rows for a user-selected date range
 * - "projected": a full-season projection system (PECOTA, ATC, ...)
 * - "playoff":   Scoresheet's playoff weighting of the full season's daily rows
 *                (see ./playoff.ts)
 *
 * "actual" and "playoff" both consume daily rows from the stats API; only
 * "actual" exposes a date range picker.
 */

import type { StatsSource } from "./types";

export const STATS_SOURCE_OPTIONS: readonly { value: StatsSource; label: string }[] = [
  { value: "actual", label: "Actual" },
  { value: "projected", label: "Projected" },
  { value: "playoff", label: "Playoff" },
] as const;

export const STATS_SOURCE_LABELS: Record<StatsSource, string> = Object.fromEntries(
  STATS_SOURCE_OPTIONS.map((o) => [o.value, o.label])
) as Record<StatsSource, string>;

/** True when the source is built from daily stat rows (needs the stats API). */
export function usesDailyStats(source: StatsSource): boolean {
  return source === "actual" || source === "playoff";
}

/** True when the user picks the date range (playoff mode fixes it to the full season). */
export function usesDateRange(source: StatsSource): boolean {
  return source === "actual";
}

/** Type guard for values coming from URLs or persisted settings. */
export function isStatsSource(value: unknown): value is StatsSource {
  return STATS_SOURCE_OPTIONS.some((o) => o.value === value);
}
