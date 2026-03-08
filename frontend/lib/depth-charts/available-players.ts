/**
 * Utility to find top available (unrostered) free agents by depth chart position.
 * All data is already fetched — no new API calls needed.
 */

import type { Player } from "../types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import { calculatePlatoonOPS } from "../stats/player-utils";
import { isEligibleAtDCPosition } from "./lineup-optimizer";
import type { DepthChartPosition } from "./types";
import { DEPTH_CHART_POSITIONS } from "./types";

const TOP_N = 5;

const HITTER_POSITIONS: DepthChartPosition[] = ["C", "1B", "2B", "SS", "3B", "CF", "COF", "DH"];
const PITCHER_POSITIONS_SET = new Set<DepthChartPosition>(["P-L", "P-R", "SR-L", "SR-R"]);

export interface AvailableHitterEntry {
  type: "hitter";
  id: number;
  name: string;
  opsVsL: number | null;
  opsVsR: number | null;
}

export interface AvailablePitcherEntry {
  type: "pitcher";
  id: number;
  name: string;
  era: number | null;
}

export type AvailablePlayerEntry = AvailableHitterEntry | AvailablePitcherEntry;

function isPitcherPosition(pos: string): boolean {
  return pos === "P" || pos === "SR";
}

/**
 * Get the top 5 available (unrostered) free agents for each depth chart position.
 *
 * - Hitter positions: uses isEligibleAtDCPosition, excludes pitchers, sorts by OPS desc
 * - Pitcher positions: matches on primary_position + hand, sorts by ERA asc
 */
export function getTopAvailableByPosition(
  players: Player[],
  hitterStatsMap: Map<number, AggregatedHitterStats>,
  pitcherStatsMap: Map<number, AggregatedPitcherStats>,
): Map<DepthChartPosition, AvailablePlayerEntry[]> {
  const freeAgents = players.filter((p) => p.team_id === null);

  // Separate hitters and pitchers once
  const faHitters = freeAgents.filter((p) => !isPitcherPosition(p.primary_position));
  const faPitchers = freeAgents.filter((p) => isPitcherPosition(p.primary_position));

  const result = new Map<DepthChartPosition, AvailablePlayerEntry[]>();

  // Hitter positions
  for (const pos of HITTER_POSITIONS) {
    const eligible = faHitters.filter((p) => isEligibleAtDCPosition(p, pos));

    const withStats = eligible.map((p) => {
      const stats = hitterStatsMap.get(p.id);
      const ops = stats?.OPS ?? null;
      const opsVsL = calculatePlatoonOPS(ops, p.ob_vl, p.sl_vl);
      const opsVsR = calculatePlatoonOPS(ops, p.ob_vr, p.sl_vr);
      return { player: p, ops, opsVsL, opsVsR };
    });

    // Sort by OPS descending (nulls last)
    withStats.sort((a, b) => (b.ops ?? -1) - (a.ops ?? -1));

    result.set(
      pos,
      withStats.slice(0, TOP_N).map((h): AvailableHitterEntry => ({
        type: "hitter",
        id: h.player.id,
        name: h.player.name,
        opsVsL: h.opsVsL,
        opsVsR: h.opsVsR,
      })),
    );
  }

  // Pitcher positions
  for (const pos of DEPTH_CHART_POSITIONS) {
    if (!PITCHER_POSITIONS_SET.has(pos)) continue;

    // Determine which pitchers match this column
    const isStarter = pos === "P-L" || pos === "P-R";
    const isLeft = pos === "P-L" || pos === "SR-L";
    const primaryPos = isStarter ? "P" : "SR";

    const eligible = faPitchers.filter(
      (p) => p.primary_position === primaryPos && (isLeft ? p.hand === "L" : p.hand !== "L"),
    );

    const withStats = eligible.map((p) => {
      const stats = pitcherStatsMap.get(p.id);
      return { player: p, era: stats?.ERA ?? null };
    });

    // Sort by ERA ascending (nulls last)
    withStats.sort((a, b) => (a.era ?? 999) - (b.era ?? 999));

    result.set(
      pos,
      withStats.slice(0, TOP_N).map((p): AvailablePitcherEntry => ({
        type: "pitcher",
        id: p.player.id,
        name: p.player.name,
        era: p.era,
      })),
    );
  }

  return result;
}
