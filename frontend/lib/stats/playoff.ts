/**
 * Scoresheet playoff stat weighting.
 *
 * Rules (scoresheet.com/baseball/BBplayoffexpl.php):
 * - A player's playoff performance uses his MLB counting stats from the final
 *   four weeks of the regular season multiplied by 3.33, added to his counting
 *   stats from before that window. Rates are derived from the weighted sums,
 *   so the effective September weight is 3.33 * windowPA / (prePA + 3.33 * windowPA):
 *   about 40% for a full-time player, 100% for a September-only player.
 * - Games after the scheduled final day do not count at all.
 * - Playing time per series: hitters get 40% of their window PA, pitchers 45%
 *   of their window IP. A player with no window playing time does not play.
 * - A starter needs one window MLB start to start once in a series and three
 *   to start twice.
 *
 * Everything here is computed from daily rows on read; nothing is stored.
 */

import type { HitterDailyStats, PitcherDailyStats } from "../types";
import { getPlayoffWindow, type PlayoffWindow } from "../defaults";
import { aggregateHitterStats, aggregatePitcherStats } from "./aggregation";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "./types";

/** Multiplier Scoresheet applies to final-four-week counting stats. */
export const PLAYOFF_WINDOW_WEIGHT = 3.33;
/** Share of window PA a hitter may use in one playoff series. */
export const HITTER_SERIES_PA_PCT = 0.4;
/** Share of window IP a pitcher may use in one playoff series. */
export const PITCHER_SERIES_IP_PCT = 0.45;
/** Window MLB starts required to start once / twice in a series. */
export const MIN_WINDOW_GS_FOR_ONE_START = 1;
export const MIN_WINDOW_GS_FOR_TWO_STARTS = 3;

export type PlayoffStarts = 0 | 1 | 2;

export interface PlayoffHitterMeta {
  /** PA inside the playoff window. */
  windowPA: number;
  /** PA available per playoff series (40% of window PA, rounded). */
  seriesPACap: number;
  /** False when the player had no window PA — he will not play. */
  willPlay: boolean;
}

export interface PlayoffPitcherMeta {
  windowIPOuts: number;
  /** Outs available per playoff series (45% of window outs, rounded). */
  seriesIPOutsCap: number;
  windowGS: number;
  windowCG: number;
  /** How many games he may start in a seven-game series. */
  playoffStarts: PlayoffStarts;
  willPlay: boolean;
}

export type { PlayoffWindow };

/** ISO date strings compare lexicographically, so no Date construction is needed. */
export function isInPlayoffWindow(date: string, window: PlayoffWindow): boolean {
  return date >= window.start && date <= window.end;
}

function isBeforeWindow(date: string, window: PlayoffWindow): boolean {
  return date < window.start;
}

/** Multiply every counting field of a daily row by `factor`; keeps player_id and date. */
export function scaleDailyRow<T extends { player_id: number; date: string }>(
  row: T,
  factor: number
): T {
  const scaled: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    scaled[key] =
      key === "player_id" || key === "date" || typeof value !== "number"
        ? value
        : value * factor;
  }
  return scaled as T;
}

/**
 * Split rows into pre-window and window rows, dropping anything after the
 * window (post-schedule games never count). Returns the weighted row list
 * ready for the standard aggregators plus the raw window rows for meta.
 */
function splitAndWeight<T extends { player_id: number; date: string }>(
  rows: T[],
  window: PlayoffWindow
): { weighted: T[]; windowRows: T[] } {
  const windowRows = rows.filter((r) => isInPlayoffWindow(r.date, window));
  const preRows = rows.filter((r) => isBeforeWindow(r.date, window));
  const weighted = [
    ...preRows,
    ...windowRows.map((r) => scaleDailyRow(r, PLAYOFF_WINDOW_WEIGHT)),
  ];
  return { weighted, windowRows };
}

export function computePlayoffHitterStats(
  rows: HitterDailyStats[],
  window: PlayoffWindow
): { stats: AggregatedHitterStats; meta: PlayoffHitterMeta } {
  const { weighted, windowRows } = splitAndWeight(rows, window);
  const windowPA = windowRows.reduce((sum, r) => sum + r.PA, 0);
  return {
    stats: aggregateHitterStats(weighted),
    meta: {
      windowPA,
      seriesPACap: Math.round(windowPA * HITTER_SERIES_PA_PCT),
      willPlay: windowPA > 0,
    },
  };
}

export function playoffStartsFor(windowGS: number): PlayoffStarts {
  if (windowGS >= MIN_WINDOW_GS_FOR_TWO_STARTS) return 2;
  if (windowGS >= MIN_WINDOW_GS_FOR_ONE_START) return 1;
  return 0;
}

export function computePlayoffPitcherStats(
  rows: PitcherDailyStats[],
  window: PlayoffWindow
): { stats: AggregatedPitcherStats; meta: PlayoffPitcherMeta } {
  const { weighted, windowRows } = splitAndWeight(rows, window);
  const windowIPOuts = windowRows.reduce((sum, r) => sum + r.IP_outs, 0);
  const windowBF = windowRows.reduce((sum, r) => sum + r.BF, 0);
  const windowGS = windowRows.reduce((sum, r) => sum + r.GS, 0);
  const windowCG = windowRows.reduce((sum, r) => sum + r.CG, 0);
  return {
    stats: aggregatePitcherStats(weighted),
    meta: {
      windowIPOuts,
      seriesIPOutsCap: Math.round(windowIPOuts * PITCHER_SERIES_IP_PCT),
      windowGS,
      windowCG,
      playoffStarts: playoffStartsFor(windowGS),
      willPlay: windowIPOuts > 0 || windowBF > 0,
    },
  };
}

function groupByPlayer<T extends { player_id: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.player_id);
    if (existing) existing.push(row);
    else grouped.set(row.player_id, [row]);
  }
  return grouped;
}

export interface PlayoffStatsMaps {
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  hitterMetaMap: Map<number, PlayoffHitterMeta>;
  pitcherMetaMap: Map<number, PlayoffPitcherMeta>;
}

/**
 * Per-player playoff stat lines and playing-time meta from full-season daily rows.
 */
export function getPlayoffStatsMaps(
  hitterRows: HitterDailyStats[],
  pitcherRows: PitcherDailyStats[],
  seasonYear: number
): PlayoffStatsMaps {
  const window = getPlayoffWindow(seasonYear);
  const hitterStatsMap = new Map<number, AggregatedHitterStats>();
  const hitterMetaMap = new Map<number, PlayoffHitterMeta>();
  for (const [playerId, rows] of groupByPlayer(hitterRows)) {
    const { stats, meta } = computePlayoffHitterStats(rows, window);
    hitterStatsMap.set(playerId, stats);
    hitterMetaMap.set(playerId, meta);
  }

  const pitcherStatsMap = new Map<number, AggregatedPitcherStats>();
  const pitcherMetaMap = new Map<number, PlayoffPitcherMeta>();
  for (const [playerId, rows] of groupByPlayer(pitcherRows)) {
    const { stats, meta } = computePlayoffPitcherStats(rows, window);
    pitcherStatsMap.set(playerId, stats);
    pitcherMetaMap.set(playerId, meta);
  }

  return { hitterStatsMap, pitcherStatsMap, hitterMetaMap, pitcherMetaMap };
}

/** "Aug 31 – Sep 27" from a window's ISO dates (timezone-safe: built from parts). */
export function formatPlayoffWindow(window: PlayoffWindow): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${fmt(window.start)} – ${fmt(window.end)}`;
}
