/**
 * One place that turns a stats source into per-player stat maps.
 *
 * Every page with the Actual / Projected / Playoff toggle used to carry its
 * own copy of this branch. Pages call buildStatsMaps and then, for roster
 * totals, aggregateRosterHitters / aggregateRosterPitchers.
 */

import type { HitterDailyStats, PitcherDailyStats, Projection } from "../types";
import { PROJECTION_SENTINEL_DATE } from "../constants";
import {
  aggregateHitterStats,
  aggregateHitterStatsByPlayer,
  aggregatePitcherStats,
  aggregatePitcherStatsByPlayer,
  getProjectionStatsMaps,
} from "./aggregation";
import { getPlayoffStatsMaps, type PlayoffHitterMeta, type PlayoffPitcherMeta } from "./playoff";
import type { AggregatedHitterStats, AggregatedPitcherStats, StatsSource } from "./types";

export interface BuildStatsMapsArgs {
  statsSource: StatsSource;
  /** Projection system name; only used when statsSource is "projected". */
  projectionSource: string;
  projections: Projection[] | undefined;
  /** Daily rows for the active range ("actual") or the full season ("playoff"). */
  hitterRows: HitterDailyStats[] | undefined;
  pitcherRows: PitcherDailyStats[] | undefined;
  /** Season year for the playoff window; only used when statsSource is "playoff". */
  seasonYear: number;
}

export interface StatsMaps {
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  /** Empty unless statsSource is "playoff". */
  playoffHitterMeta: Map<number, PlayoffHitterMeta>;
  playoffPitcherMeta: Map<number, PlayoffPitcherMeta>;
}

export function buildStatsMaps(args: BuildStatsMapsArgs): StatsMaps {
  const { statsSource, projectionSource, projections, hitterRows, pitcherRows, seasonYear } = args;

  if (statsSource === "projected") {
    const { hitterStatsMap, pitcherStatsMap } = getProjectionStatsMaps(
      projections ?? [],
      projectionSource
    );
    return { hitterStatsMap, pitcherStatsMap, playoffHitterMeta: new Map(), playoffPitcherMeta: new Map() };
  }

  if (statsSource === "playoff") {
    const maps = getPlayoffStatsMaps(hitterRows ?? [], pitcherRows ?? [], seasonYear);
    return {
      hitterStatsMap: maps.hitterStatsMap,
      pitcherStatsMap: maps.pitcherStatsMap,
      playoffHitterMeta: maps.hitterMetaMap,
      playoffPitcherMeta: maps.pitcherMetaMap,
    };
  }

  return {
    hitterStatsMap: aggregateHitterStatsByPlayer(hitterRows ?? []),
    pitcherStatsMap: aggregatePitcherStatsByPlayer(pitcherRows ?? []),
    playoffHitterMeta: new Map(),
    playoffPitcherMeta: new Map(),
  };
}

/**
 * Team totals for a set of players from a per-player map.
 *
 * Aggregating aggregates is exact here: totals are sums of counting stats
 * with rates derived afterwards, so re-aggregating per-player lines equals
 * aggregating the underlying daily rows.
 */
export function aggregateRosterHitters(
  players: readonly { id: number }[],
  hitterStatsMap: Map<number, AggregatedHitterStats>
): AggregatedHitterStats {
  const rows: HitterDailyStats[] = [];
  for (const p of players) {
    const stats = hitterStatsMap.get(p.id);
    if (stats) rows.push({ ...stats, player_id: p.id, date: PROJECTION_SENTINEL_DATE });
  }
  return aggregateHitterStats(rows);
}

export function aggregateRosterPitchers(
  players: readonly { id: number }[],
  pitcherStatsMap: Map<number, AggregatedPitcherStats>
): AggregatedPitcherStats {
  const rows: PitcherDailyStats[] = [];
  for (const p of players) {
    const stats = pitcherStatsMap.get(p.id);
    if (stats) rows.push({ ...stats, player_id: p.id, date: PROJECTION_SENTINEL_DATE });
  }
  return aggregatePitcherStats(rows);
}

/** Per-player map restricted to a set of players (for table rows). */
export function pickPlayers<T>(players: readonly { id: number }[], map: Map<number, T>): Map<number, T> {
  const picked = new Map<number, T>();
  for (const p of players) {
    const value = map.get(p.id);
    if (value !== undefined) picked.set(p.id, value);
  }
  return picked;
}
