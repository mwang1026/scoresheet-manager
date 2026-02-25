export const HITTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "DH"] as const;
export const PITCHER_POSITIONS = ["P", "SR"] as const;
export const ALL_POSITIONS = [...HITTER_POSITIONS, ...PITCHER_POSITIONS] as const;
export type Position = (typeof ALL_POSITIONS)[number];

export function isPitcherPosition(position: string): boolean {
  return (PITCHER_POSITIONS as readonly string[]).includes(position);
}

/**
 * Synthetic date used when converting projection data to the DailyStats format.
 * Projections have no real game date — this sentinel value (Unix epoch) makes
 * the placeholder intent obvious and distinguishable from real stat dates.
 */
export const PROJECTION_SENTINEL_DATE = "1970-01-01";
