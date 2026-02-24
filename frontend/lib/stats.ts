/**
 * Stat calculation utilities for fantasy baseball
 *
 * Formulas per CLAUDE.md:
 * - AVG = H / AB
 * - OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
 * - SLG = (1B + 2×2B + 3×3B + 4×HR) / AB
 * - OPS = OBP + SLG
 * - ERA = (ER / (IP_outs/3)) × 9
 * - WHIP = (H + BB) / (IP_outs/3)
 * - K/9 = (K / (IP_outs/3)) × 9
 *
 * DATE/TIME HANDLING NOTES:
 * - All date fields use ISO format strings: "YYYY-MM-DD" (e.g., "2025-04-15")
 * - Date represents the calendar day the game STARTED (not ended)
 *   - For delayed games spanning multiple days: use start date
 *   - For doubleheaders: each game gets same date
 * - TODO: Verify MLB Stats API timezone behavior when integrating
 *   - Does API return local time or UTC?
 *   - How are late-night games (past midnight) handled?
 * - Be careful with JavaScript Date() constructor:
 *   - new Date("2025-04-15") is UTC midnight, which may shift to previous day in local TZ
 *   - Use string parsing for display/labels to avoid TZ issues
 *   - Use Date objects for comparisons (they handle TZ consistently)
 */

import type {
  HitterDailyStats,
  PitcherDailyStats,
  Projection,
  HitterProjection,
  PitcherProjection,
} from "./types";

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
 * Aggregate hitter stats from daily records
 */
export function aggregateHitterStats(stats: HitterDailyStats[]): AggregatedHitterStats {
  const sums = stats.reduce(
    (acc, stat) => ({
      PA: acc.PA + stat.PA,
      AB: acc.AB + stat.AB,
      H: acc.H + stat.H,
      "1B": acc["1B"] + stat["1B"],
      "2B": acc["2B"] + stat["2B"],
      "3B": acc["3B"] + stat["3B"],
      HR: acc.HR + stat.HR,
      SO: acc.SO + stat.SO,
      GO: acc.GO + stat.GO,
      FO: acc.FO + stat.FO,
      GDP: acc.GDP + stat.GDP,
      BB: acc.BB + stat.BB,
      IBB: acc.IBB + stat.IBB,
      HBP: acc.HBP + stat.HBP,
      SB: acc.SB + stat.SB,
      CS: acc.CS + stat.CS,
      R: acc.R + stat.R,
      RBI: acc.RBI + stat.RBI,
      SF: acc.SF + stat.SF,
      SH: acc.SH + stat.SH,
    }),
    {
      PA: 0,
      AB: 0,
      H: 0,
      "1B": 0,
      "2B": 0,
      "3B": 0,
      HR: 0,
      SO: 0,
      GO: 0,
      FO: 0,
      GDP: 0,
      BB: 0,
      IBB: 0,
      HBP: 0,
      SB: 0,
      CS: 0,
      R: 0,
      RBI: 0,
      SF: 0,
      SH: 0,
    }
  );

  // Calculate derived stats
  const AVG = sums.AB > 0 ? sums.H / sums.AB : null;

  const obpDenom = sums.AB + sums.BB + sums.HBP + sums.SF;
  const OBP = obpDenom > 0 ? (sums.H + sums.BB + sums.HBP) / obpDenom : null;

  const totalBases = sums["1B"] + 2 * sums["2B"] + 3 * sums["3B"] + 4 * sums.HR;
  const SLG = sums.AB > 0 ? totalBases / sums.AB : null;

  const OPS = OBP !== null && SLG !== null ? OBP + SLG : null;

  return {
    ...sums,
    AVG,
    OBP,
    SLG,
    OPS,
  };
}

/**
 * Aggregate pitcher stats from daily records
 */
export function aggregatePitcherStats(stats: PitcherDailyStats[]): AggregatedPitcherStats {
  const sums = stats.reduce(
    (acc, stat) => ({
      G: acc.G + stat.G,
      GS: acc.GS + stat.GS,
      GF: acc.GF + stat.GF,
      CG: acc.CG + stat.CG,
      SHO: acc.SHO + stat.SHO,
      SV: acc.SV + stat.SV,
      HLD: acc.HLD + stat.HLD,
      IP_outs: acc.IP_outs + stat.IP_outs,
      W: acc.W + stat.W,
      L: acc.L + stat.L,
      ER: acc.ER + stat.ER,
      R: acc.R + stat.R,
      BF: acc.BF + stat.BF,
      H: acc.H + stat.H,
      BB: acc.BB + stat.BB,
      IBB: acc.IBB + stat.IBB,
      HBP: acc.HBP + stat.HBP,
      K: acc.K + stat.K,
      HR: acc.HR + stat.HR,
      WP: acc.WP + stat.WP,
      BK: acc.BK + stat.BK,
    }),
    {
      G: 0,
      GS: 0,
      GF: 0,
      CG: 0,
      SHO: 0,
      SV: 0,
      HLD: 0,
      IP_outs: 0,
      W: 0,
      L: 0,
      ER: 0,
      R: 0,
      BF: 0,
      H: 0,
      BB: 0,
      IBB: 0,
      HBP: 0,
      K: 0,
      HR: 0,
      WP: 0,
      BK: 0,
    }
  );

  // Calculate derived stats
  const IP = sums.IP_outs / 3;
  const ERA = IP > 0 ? (sums.ER / IP) * 9 : null;
  const WHIP = IP > 0 ? (sums.H + sums.BB) / IP : null;
  const K9 = IP > 0 ? (sums.K / IP) * 9 : null;

  return {
    ...sums,
    ERA,
    WHIP,
    K9,
  };
}

/**
 * Aggregate hitter stats by player ID
 */
export function aggregateHitterStatsByPlayer(
  stats: HitterDailyStats[]
): Map<number, AggregatedHitterStats> {
  const statsByPlayer = new Map<number, HitterDailyStats[]>();

  for (const stat of stats) {
    const existing = statsByPlayer.get(stat.player_id) ?? [];
    statsByPlayer.set(stat.player_id, [...existing, stat]);
  }

  const aggregated = new Map<number, AggregatedHitterStats>();
  for (const [playerId, playerStats] of statsByPlayer) {
    aggregated.set(playerId, aggregateHitterStats(playerStats));
  }

  return aggregated;
}

/**
 * Aggregate pitcher stats by player ID
 */
export function aggregatePitcherStatsByPlayer(
  stats: PitcherDailyStats[]
): Map<number, AggregatedPitcherStats> {
  const statsByPlayer = new Map<number, PitcherDailyStats[]>();

  for (const stat of stats) {
    const existing = statsByPlayer.get(stat.player_id) ?? [];
    statsByPlayer.set(stat.player_id, [...existing, stat]);
  }

  const aggregated = new Map<number, AggregatedPitcherStats>();
  for (const [playerId, playerStats] of statsByPlayer) {
    aggregated.set(playerId, aggregatePitcherStats(playerStats));
  }

  return aggregated;
}

/**
 * Filter stats by date range
 *
 * IMPORTANT: Date comparisons use JavaScript Date objects which handle
 * timezone conversion consistently. The `date` field should be in
 * "YYYY-MM-DD" format representing the calendar day the game started.
 *
 * When integrating with MLB Stats API, verify:
 * - What timezone the API uses for game dates
 * - How late-night games (crossing midnight) are dated
 * - Delayed/suspended games spanning multiple days (use start date)
 */
export function filterStatsByDateRange<T extends { date: string }>(
  stats: T[],
  range: DateRange
): T[] {
  const today = new Date();

  switch (range.type) {
    case "season": {
      const year = range.year ?? today.getFullYear();
      return stats.filter((stat) => {
        const statDate = new Date(stat.date);
        return statDate.getFullYear() === year;
      });
    }
    case "wtd": {
      // Week to Date: Monday-based week (Scoresheet weeks start Monday)
      // Zero out time components for date-only comparison
      const todayDate = new Date(today);
      todayDate.setHours(0, 0, 0, 0);

      const monday = new Date(todayDate);
      const dayOfWeek = monday.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
      monday.setDate(monday.getDate() - daysToMonday);

      return stats.filter((stat) => {
        const statDate = new Date(stat.date + "T00:00:00"); // Ensure UTC interpretation
        return statDate >= monday && statDate <= todayDate;
      });
    }
    case "last7": {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 7);
      return stats.filter((stat) => new Date(stat.date) >= cutoff);
    }
    case "last14": {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 14);
      return stats.filter((stat) => new Date(stat.date) >= cutoff);
    }
    case "last30": {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 30);
      return stats.filter((stat) => new Date(stat.date) >= cutoff);
    }
    case "custom": {
      const start = new Date(range.start);
      const end = new Date(range.end);
      return stats.filter((stat) => {
        const statDate = new Date(stat.date);
        return statDate >= start && statDate <= end;
      });
    }
  }
}

/**
 * Format innings pitched from outs (16 → "5.1", 21 → "7.0")
 */
export function formatIP(outs: number): string {
  const fullInnings = Math.floor(outs / 3);
  const remainder = outs % 3;
  return `${fullInnings}.${remainder}`;
}

/**
 * Format batting average (.300 format, "---" for null)
 */
export function formatAvg(value: number | null): string {
  if (value === null) return "---";
  return value.toFixed(3);
}

/**
 * Format rate stat (3.50 format, "---" for null)
 */
export function formatRate(value: number | null): string {
  if (value === null) return "---";
  return value.toFixed(2);
}

/**
 * Check if player is a pitcher (P or SR)
 */
export function isPlayerPitcher(player: {
  primary_position: string;
}): boolean {
  return player.primary_position === "P" || player.primary_position === "SR";
}

/**
 * Check if player is eligible at a position
 */
export function isEligibleAt(
  player: {
    primary_position: string;
    eligible_1b: boolean | number | null;
    eligible_2b: boolean | number | null;
    eligible_3b: boolean | number | null;
    eligible_ss: boolean | number | null;
    eligible_of: boolean | number | null;
  },
  position: string
): boolean {
  // Check primary position
  if (player.primary_position === position) {
    return true;
  }

  // Check secondary eligibility
  // NOTE: Uses Boolean() to handle both legacy (number|null) and API (boolean) types
  switch (position) {
    case "1B":
      return Boolean(player.eligible_1b);
    case "2B":
      return Boolean(player.eligible_2b);
    case "3B":
      return Boolean(player.eligible_3b);
    case "SS":
      return Boolean(player.eligible_ss);
    case "OF":
      return Boolean(player.eligible_of);
    default:
      // C, DH, P, SR have no secondary eligibility fields
      return false;
  }
}

/**
 * Get eligible positions with defense ratings for a player
 */
export function getEligiblePositions(player: {
  primary_position: string;
  eligible_1b: boolean | number | null;
  eligible_2b: boolean | number | null;
  eligible_3b: boolean | number | null;
  eligible_ss: boolean | number | null;
  eligible_of: boolean | number | null;
}): string[] {
  const positions: string[] = [];

  // Map of position name to eligible field value
  const eligibilityMap: [string, number | boolean | null][] = [
    ["1B", player.eligible_1b],
    ["2B", player.eligible_2b],
    ["3B", player.eligible_3b],
    ["SS", player.eligible_ss],
    ["OF", player.eligible_of],
  ];

  // Find the primary position's eligible value
  const primaryEligEntry = eligibilityMap.find(([pos]) => pos === player.primary_position);
  const primaryEligValue = primaryEligEntry?.[1];

  // Add primary position with rating if available (numeric), plain otherwise
  if (typeof primaryEligValue === "number") {
    positions.push(`${player.primary_position}(${primaryEligValue.toFixed(2)})`);
  } else {
    positions.push(player.primary_position);
  }

  // Add remaining eligible positions (excluding primary)
  for (const [pos, value] of eligibilityMap) {
    if (pos !== player.primary_position && Boolean(value)) {
      // For numeric values, show rating; for booleans, show position only
      if (typeof value === "number") {
        positions.push(`${pos}(${value.toFixed(2)})`);
      } else {
        positions.push(pos);
      }
    }
  }

  return positions;
}

/**
 * Get defense display string for a player
 * Catchers show SB/CS rates, field players show eligible positions with ratings
 */
export function getDefenseDisplay(player: {
  primary_position: string;
  eligible_1b: boolean | number | null;
  eligible_2b: boolean | number | null;
  eligible_3b: boolean | number | null;
  eligible_ss: boolean | number | null;
  eligible_of: boolean | number | null;
  osb_al: number | null;
  ocs_al: number | null;
}): string {
  if (player.primary_position === "C") {
    // Catchers: show opponent SB/CS rates in format "C (0.75-0.25)"
    if (player.osb_al !== null && player.ocs_al !== null) {
      const osbRate = player.osb_al.toFixed(2);
      const ocsRate = player.ocs_al.toFixed(2);
      return `C (${osbRate}-${ocsRate})`;
    }
    return "C";
  }

  // Field players: show eligible positions with defense ratings
  const positions = getEligiblePositions(player);
  return positions.join(", ");
}

/**
 * Calculate platoon OPS split from base OPS and integer deltas
 * obDelta and slDelta are integer adjustments (e.g., +5 means +0.005)
 */
export function calculatePlatoonOPS(
  baseOPS: number | null,
  obDelta: number | null,
  slDelta: number | null
): number | null {
  if (baseOPS === null || obDelta === null || slDelta === null) return null;
  return baseOPS + (obDelta + slDelta) / 1000;
}

/**
 * Type for stats source selection (actual vs projected)
 */
export type StatsSource = "actual" | "projected";

/**
 * Get sorted unique projection source names from projection data
 */
export function getAvailableProjectionSources(projections: Projection[]): string[] {
  return Array.from(new Set(projections.map((p) => p.source))).sort();
}

/**
 * Convert projections to aggregated stats maps by player, filtered by source
 *
 * Projections don't have dates, so we add a dummy date for compatibility
 * with the aggregation functions that expect date fields.
 *
 * Returns separate maps for hitters and pitchers.
 */
export function getProjectionStatsMaps(
  projections: Projection[],
  source: string
): {
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
} {
  // Filter by source
  const sourceProjections = projections.filter((p) => p.source === source);

  // Split by player type and add dummy date
  const hitterProjectionStats: HitterDailyStats[] = sourceProjections
    .filter((p): p is HitterProjection => p.player_type === "hitter")
    .map((p) => ({
      ...p,
      date: "2025-01-01", // Dummy date for projections
    }));

  const pitcherProjectionStats: PitcherDailyStats[] = sourceProjections
    .filter((p): p is PitcherProjection => p.player_type === "pitcher")
    .map((p) => ({
      ...p,
      date: "2025-01-01", // Dummy date for projections
    }));

  // Aggregate by player
  const hitterStatsMap = aggregateHitterStatsByPlayer(hitterProjectionStats);
  const pitcherStatsMap = aggregatePitcherStatsByPlayer(pitcherProjectionStats);

  return { hitterStatsMap, pitcherStatsMap };
}
