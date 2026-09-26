/**
 * Team aggregates over the players who will actually play.
 *
 * In playoff mode each starter's weighted line is scaled to the playing time
 * Scoresheet grants him per series (the PA / IP cap), so the team line is a
 * cap-weighted blend. A starter with no window playing time contributes
 * nothing. Bench players filling the shortfall from low-cap starters are not
 * modelled. Outside playoff mode the starters' lines are summed as-is.
 */

import type { HitterDailyStats, PitcherDailyStats } from "../types";
import { PROJECTION_SENTINEL_DATE } from "../constants";
import { aggregateHitterStats, aggregatePitcherStats } from "../stats/aggregation";
import { scaleDailyRow } from "../stats/playoff";
import type { PlayoffHitterMeta, PlayoffPitcherMeta } from "../stats/playoff";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import { isPlayoffStarter, isStartingHitter, type LineupRoleMap } from "./roles";

export interface StarterTotals {
  hitters: AggregatedHitterStats;
  pitchers: AggregatedPitcherStats;
  /** Players counted in each aggregate. */
  hitterCount: number;
  pitcherCount: number;
}

function toRow<T extends AggregatedHitterStats | AggregatedPitcherStats>(
  playerId: number,
  stats: T
): T & { player_id: number; date: string } {
  return { ...stats, player_id: playerId, date: PROJECTION_SENTINEL_DATE };
}

/**
 * Hitter totals over lineup starters.
 *
 * @param playoffMeta when given (playoff mode), each starter is scaled to his series PA cap
 */
export function computeStarterHitterTotals(
  players: readonly { id: number }[],
  roles: LineupRoleMap,
  hitterStatsMap: Map<number, AggregatedHitterStats>,
  playoffMeta?: Map<number, PlayoffHitterMeta>
): { stats: AggregatedHitterStats; count: number } {
  const rows: HitterDailyStats[] = [];
  let count = 0;
  for (const p of players) {
    if (!isStartingHitter(roles.get(p.id))) continue;
    const stats = hitterStatsMap.get(p.id);
    if (!stats) continue;
    count += 1;
    const row = toRow(p.id, stats);
    if (!playoffMeta) {
      rows.push(row);
      continue;
    }
    const meta = playoffMeta.get(p.id);
    if (!meta || !meta.willPlay || stats.PA <= 0) continue;
    rows.push(scaleDailyRow(row, meta.seriesPACap / stats.PA));
  }
  return { stats: aggregateHitterStats(rows), count };
}

/**
 * Pitcher totals over the playoff rotation (first four) plus relievers.
 *
 * @param playoffMeta when given (playoff mode), each pitcher is scaled to his series IP cap
 */
export function computeStarterPitcherTotals(
  players: readonly { id: number }[],
  roles: LineupRoleMap,
  pitcherStatsMap: Map<number, AggregatedPitcherStats>,
  playoffMeta?: Map<number, PlayoffPitcherMeta>
): { stats: AggregatedPitcherStats; count: number } {
  const rows: PitcherDailyStats[] = [];
  let count = 0;
  for (const p of players) {
    const role = roles.get(p.id);
    if (!isPlayoffStarter(role) && !role?.isReliever) continue;
    const stats = pitcherStatsMap.get(p.id);
    if (!stats) continue;
    count += 1;
    const row = toRow(p.id, stats);
    if (!playoffMeta) {
      rows.push(row);
      continue;
    }
    const meta = playoffMeta.get(p.id);
    if (!meta || !meta.willPlay || stats.IP_outs <= 0) continue;
    rows.push(scaleDailyRow(row, meta.seriesIPOutsCap / stats.IP_outs));
  }
  return { stats: aggregatePitcherStats(rows), count };
}

export function computeStarterTotals(
  hitters: readonly { id: number }[],
  pitchers: readonly { id: number }[],
  roles: LineupRoleMap,
  hitterStatsMap: Map<number, AggregatedHitterStats>,
  pitcherStatsMap: Map<number, AggregatedPitcherStats>,
  playoffHitterMeta?: Map<number, PlayoffHitterMeta>,
  playoffPitcherMeta?: Map<number, PlayoffPitcherMeta>
): StarterTotals {
  const h = computeStarterHitterTotals(hitters, roles, hitterStatsMap, playoffHitterMeta);
  const p = computeStarterPitcherTotals(pitchers, roles, pitcherStatsMap, playoffPitcherMeta);
  return { hitters: h.stats, pitchers: p.stats, hitterCount: h.count, pitcherCount: p.count };
}
