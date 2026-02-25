/**
 * Shared stat types for aggregated hitter/pitcher stats and date ranges.
 */

export interface AggregatedHitterStats {
  // Raw sums
  PA: number;
  AB: number;
  H: number;
  "1B": number;
  "2B": number;
  "3B": number;
  HR: number;
  SO: number;
  GO: number;
  FO: number;
  GDP: number;
  BB: number;
  IBB: number;
  HBP: number;
  SB: number;
  CS: number;
  R: number;
  RBI: number;
  SF: number;
  SH: number;
  // Calculated
  AVG: number | null;
  OBP: number | null;
  SLG: number | null;
  OPS: number | null;
}

export interface AggregatedPitcherStats {
  // Raw sums
  G: number;
  GS: number;
  GF: number;
  CG: number;
  SHO: number;
  SV: number;
  HLD: number;
  IP_outs: number;
  W: number;
  L: number;
  ER: number;
  R: number;
  BF: number;
  H: number;
  BB: number;
  IBB: number;
  HBP: number;
  K: number;
  HR: number;
  WP: number;
  BK: number;
  // Calculated
  ERA: number | null;
  WHIP: number | null;
  K9: number | null;
}

export type DateRange =
  | { type: "season"; year?: number }
  | { type: "wtd" }
  | { type: "last7" }
  | { type: "last14" }
  | { type: "last30" }
  | { type: "custom"; start: string; end: string };

/**
 * Type for stats source selection (actual vs projected)
 */
export type StatsSource = "actual" | "projected";
