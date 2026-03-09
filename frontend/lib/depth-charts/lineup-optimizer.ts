/**
 * Lineup optimizer for depth chart position assignment.
 *
 * For each team, builds vs-L and vs-R lineups using greedy assignment
 * (thinnest positions first), then derives platoon roles from lineup overlap.
 */

import type { Player } from "../types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import type { StatsSource } from "../stats/types";
import { calculatePlatoonOPS } from "../stats/player-utils";
import { DEFENSE_AVERAGES } from "../constants";
import type { DraftPick } from "../types";
import {
  type DepthChartPosition,
  type DepthChartPlayer,
  type DepthChartTeam,
  type PlatoonRole,
  DEPTH_CHART_POSITIONS,
  STARTERS_PER_POSITION,
  CF_ELIGIBILITY_THRESHOLD,
  SP_DISPLAY_LIMIT,
  MIN_PROJECTED_PA,
  MIN_PROJECTED_P_IP,
  SR_POSITIONS,
  NO_DEF_POSITIONS,
} from "./types";

// Hitter positions that need lineup optimization
const HITTER_POSITIONS: DepthChartPosition[] = ["C", "1B", "2B", "SS", "3B", "CF", "COF", "DH"];

interface PlayerWithStats {
  player: Player;
  ops: number | null;
  opsVsL: number | null;
  opsVsR: number | null;
  pa: number;
  hr: number;
}

interface PitcherWithStats {
  player: Player;
  era: number | null;
  whip: number | null;
  ip: number;
  k: number;
}

/**
 * Get defense rating for a player at a specific depth chart position
 */
function getDefenseRating(player: Player, position: DepthChartPosition): number | null {
  switch (position) {
    case "1B": return player.eligible_1b;
    case "2B": return player.eligible_2b;
    case "3B": return player.eligible_3b;
    case "SS": return player.eligible_ss;
    case "CF": return player.eligible_of;
    case "COF": return player.eligible_of;
    default: return null;
  }
}

/**
 * Check if a hitter is eligible at a given depth chart position
 */
export function isEligibleAtDCPosition(player: Player, position: DepthChartPosition): boolean {
  switch (position) {
    case "C":
      return player.primary_position === "C";
    case "1B":
      return player.eligible_1b !== null || player.primary_position === "1B";
    case "2B":
      return player.eligible_2b !== null || player.primary_position === "2B";
    case "3B":
      return player.eligible_3b !== null || player.primary_position === "3B";
    case "SS":
      return player.eligible_ss !== null || player.primary_position === "SS";
    case "CF":
      return player.eligible_of !== null && player.eligible_of >= CF_ELIGIBILITY_THRESHOLD;
    case "COF":
      return player.eligible_of !== null;
    case "DH":
      return true; // Any hitter can DH
    default:
      return false;
  }
}

/**
 * Build eligible player lists per position, sorted by the number of eligible players (thinnest first)
 */
function getPositionOrder(
  hitters: PlayerWithStats[],
): { position: DepthChartPosition; count: number }[] {
  const positionsWithCounts = HITTER_POSITIONS
    .filter((pos) => pos !== "DH") // DH handled separately after all positions
    .map((pos) => ({
      position: pos,
      count: hitters.filter((h) => isEligibleAtDCPosition(h.player, pos)).length,
    }));

  // Sort thinnest first (fewest eligible players)
  positionsWithCounts.sort((a, b) => a.count - b.count);
  return positionsWithCounts;
}

/**
 * Build a lineup (vs-L or vs-R) using greedy assignment.
 * Processes positions thinnest-first, assigning best available player.
 */
function buildLineup(
  hitters: PlayerWithStats[],
  getOPS: (h: PlayerWithStats) => number | null,
): Map<DepthChartPosition, Set<number>> {
  const lineup = new Map<DepthChartPosition, Set<number>>();
  const assigned = new Set<number>();

  const positionOrder = getPositionOrder(hitters);

  // Assign starters for each position (thinnest first)
  for (const { position } of positionOrder) {
    const slots = STARTERS_PER_POSITION[position] ?? 1;
    const eligible = hitters
      .filter((h) => isEligibleAtDCPosition(h.player, position) && !assigned.has(h.player.id))
      .sort((a, b) => (getOPS(b) ?? -1) - (getOPS(a) ?? -1));

    const starters = new Set<number>();
    for (let i = 0; i < Math.min(slots, eligible.length); i++) {
      starters.add(eligible[i].player.id);
      assigned.add(eligible[i].player.id);
    }
    lineup.set(position, starters);
  }

  // DH: best remaining unassigned hitter
  const dhCandidates = hitters
    .filter((h) => !assigned.has(h.player.id))
    .sort((a, b) => (getOPS(b) ?? -1) - (getOPS(a) ?? -1));

  const dhSet = new Set<number>();
  if (dhCandidates.length > 0) {
    dhSet.add(dhCandidates[0].player.id);
    assigned.add(dhCandidates[0].player.id);

    // DH defense swap: if DH has better defense at a shared position, swap
    const dh = dhCandidates[0];
    for (const [pos, starters] of lineup) {
      if (pos === "DH") continue;
      if (!isEligibleAtDCPosition(dh.player, pos)) continue;

      const dhDef = getDefenseRating(dh.player, pos);
      if (dhDef === null) continue;

      for (const starterId of starters) {
        const starter = hitters.find((h) => h.player.id === starterId);
        if (!starter) continue;
        const starterDef = getDefenseRating(starter.player, pos);
        if (starterDef === null || dhDef <= starterDef) continue;

        // Swap: DH takes the field position, current starter becomes DH
        starters.delete(starterId);
        starters.add(dh.player.id);
        dhSet.clear();
        dhSet.add(starterId);
        break;
      }
      if (!dhSet.has(dh.player.id)) break; // Already swapped
    }
  }
  lineup.set("DH", dhSet);

  return lineup;
}

/**
 * Derive platoon roles from vs-L and vs-R lineup overlap
 */
function derivePlatoonRoles(
  vsLLineup: Map<DepthChartPosition, Set<number>>,
  vsRLineup: Map<DepthChartPosition, Set<number>>,
): Map<number, PlatoonRole> {
  const inVsL = new Set<number>();
  const inVsR = new Set<number>();

  for (const starters of vsLLineup.values()) {
    for (const id of starters) inVsL.add(id);
  }
  for (const starters of vsRLineup.values()) {
    for (const id of starters) inVsR.add(id);
  }

  const roles = new Map<number, PlatoonRole>();
  const allPlayers = new Set([...inVsL, ...inVsR]);

  for (const id of allPlayers) {
    if (inVsL.has(id) && inVsR.has(id)) roles.set(id, "LR");
    else if (inVsL.has(id)) roles.set(id, "L");
    else roles.set(id, "R");
  }

  return roles;
}

/**
 * Determine each player's primary position (where they are thinnest + best relative value)
 */
function determinePrimaryPositions(
  hitters: PlayerWithStats[],
  vsLLineup: Map<DepthChartPosition, Set<number>>,
  vsRLineup: Map<DepthChartPosition, Set<number>>,
): Map<number, DepthChartPosition> {
  const primaryPositions = new Map<number, DepthChartPosition>();

  for (const { player } of hitters) {
    // Find all positions where this player is a starter (in either lineup)
    const starterPositions: DepthChartPosition[] = [];
    for (const pos of HITTER_POSITIONS) {
      const inL = vsLLineup.get(pos)?.has(player.id) ?? false;
      const inR = vsRLineup.get(pos)?.has(player.id) ?? false;
      if (inL || inR) starterPositions.push(pos);
    }

    if (starterPositions.length === 0) {
      // Bench player — primary is their natural position (or first eligible)
      primaryPositions.set(player.id, mapPlayerPosition(player));
      continue;
    }

    if (starterPositions.length === 1) {
      primaryPositions.set(player.id, starterPositions[0]);
      continue;
    }

    // Multiple positions: pick thinnest (fewest eligible hitters at that position)
    const positionsByDepth = starterPositions.map((pos) => ({
      pos,
      eligible: hitters.filter((h) => isEligibleAtDCPosition(h.player, pos)).length,
    }));
    positionsByDepth.sort((a, b) => a.eligible - b.eligible);

    primaryPositions.set(player.id, positionsByDepth[0].pos);
  }

  return primaryPositions;
}

/**
 * Map a player's primary_position to the closest depth chart position
 */
function mapPlayerPosition(player: Player): DepthChartPosition {
  if (player.primary_position === "OF") return "COF";
  if (player.primary_position === "C") return "C";
  const pos = player.primary_position as DepthChartPosition;
  if (HITTER_POSITIONS.includes(pos)) return pos;
  return "DH";
}

/**
 * Build depth chart data for a single team
 */
export function buildTeamDepthChart(
  teamId: number,
  teamName: string,
  isMyTeam: boolean,
  players: Player[],
  hitterStatsMap: Map<number, AggregatedHitterStats>,
  pitcherStatsMap: Map<number, AggregatedPitcherStats>,
  pickPosition: number | null,
  statsSource: StatsSource = "actual",
): DepthChartTeam {
  // Separate hitters and pitchers
  const hitters: PlayerWithStats[] = [];
  const pitchers: PitcherWithStats[] = [];

  for (const player of players) {
    if (player.primary_position === "P" || player.primary_position === "SR") {
      const stats = pitcherStatsMap.get(player.id);
      const ip = stats ? stats.IP_outs / 3 : 0;
      pitchers.push({
        player,
        era: stats?.ERA ?? null,
        whip: stats?.WHIP ?? null,
        ip,
        k: stats?.K ?? 0,
      });
    } else {
      const stats = hitterStatsMap.get(player.id);
      const ops = stats?.OPS ?? null;
      const opsVsL = calculatePlatoonOPS(ops, player.ob_vl, player.sl_vl);
      const opsVsR = calculatePlatoonOPS(ops, player.ob_vr, player.sl_vr);
      hitters.push({
        player,
        ops,
        opsVsL,
        opsVsR,
        pa: stats?.PA ?? 0,
        hr: stats?.HR ?? 0,
      });
    }
  }

  // Filter for lineup eligibility — exclude low-volume players in projected mode
  const lineupHitters = statsSource === "projected"
    ? hitters.filter((h) => h.pa >= MIN_PROJECTED_PA)
    : hitters;

  // Build lineups
  const vsLLineup = buildLineup(lineupHitters, (h) => h.opsVsL);
  const vsRLineup = buildLineup(lineupHitters, (h) => h.opsVsR);

  // Derive roles and primary positions
  const roles = derivePlatoonRoles(vsLLineup, vsRLineup);
  const primaryPositions = determinePrimaryPositions(hitters, vsLLineup, vsRLineup);

  // Build roster map
  const roster = {} as Record<DepthChartPosition, DepthChartPlayer[]>;

  // Hitter positions
  for (const pos of HITTER_POSITIONS) {
    let eligible = hitters.filter((h) => isEligibleAtDCPosition(h.player, pos));
    // DH: only show the projected DH and DH-only eligible players
    if (pos === "DH") {
      eligible = eligible.filter((h) => primaryPositions.get(h.player.id) === "DH");
    }
    const baseline = DEFENSE_AVERAGES[pos] ?? null;

    roster[pos] = eligible.map((h): DepthChartPlayer => {
      const role = roles.get(h.player.id) ?? "bench";
      const isPrimary = primaryPositions.get(h.player.id) === pos;
      const defRating = getDefenseRating(h.player, pos);
      const defDiff = defRating !== null && baseline !== null ? defRating - baseline : null;

      return {
        id: h.player.id,
        name: h.player.name,
        role,
        isPrimary,
        stat: h.ops,
        statVsL: h.opsVsL,
        statVsR: h.opsVsR,
        defRating,
        defDiff,
        type: "hitter",
        hand: null,
        pa: h.pa,
        hr: h.hr,
        ops: h.ops ?? undefined,
        opsL: h.opsVsL ?? undefined,
        opsR: h.opsVsR ?? undefined,
      };
    });

    // Sort: starters first (LR, L, R), then bench; within each group, by OPS desc
    const roleOrder: Record<PlatoonRole, number> = { LR: 0, L: 1, R: 2, bench: 3 };
    roster[pos].sort((a, b) => {
      const roleComp = roleOrder[a.role] - roleOrder[b.role];
      if (roleComp !== 0) return roleComp;
      return (b.stat ?? -1) - (a.stat ?? -1);
    });
  }

  // Pitcher positions
  const spPitchers = pitchers.filter((p) => p.player.primary_position === "P");
  const srPitchers = pitchers.filter((p) => p.player.primary_position === "SR");

  const leftSR = srPitchers.filter((p) => p.player.hand === "L");
  const rightSR = srPitchers.filter((p) => p.player.hand !== "L");

  // Sort by ERA ascending
  const sortByERA = (a: PitcherWithStats, b: PitcherWithStats) =>
    (a.era ?? 99) - (b.era ?? 99);

  leftSR.sort(sortByERA);
  rightSR.sort(sortByERA);

  // Filter SP for starter eligibility in projected mode
  const volumeSP = statsSource === "projected"
    ? spPitchers.filter((p) => p.ip >= MIN_PROJECTED_P_IP)
    : spPitchers;

  // Select top 5 SP by ERA across both hands; show all SP, highlight top 5
  volumeSP.sort(sortByERA);
  const topSP = volumeSP.slice(0, SP_DISPLAY_LIMIT);
  const topSPIds = new Set(topSP.map((p) => p.player.id));

  // Split ALL SP by hand for display
  const allLeftSP = spPitchers.filter((p) => p.player.hand === "L");
  const allRightSP = spPitchers.filter((p) => p.player.hand !== "L");

  const mapPitcher = (p: PitcherWithStats, isStarter: boolean): DepthChartPlayer => ({
    id: p.player.id,
    name: p.player.name,
    role: isStarter ? "LR" : "bench",
    isPrimary: true,
    stat: p.era,
    statVsL: null,
    statVsR: null,
    defRating: null,
    defDiff: null,
    type: "pitcher",
    hand: p.player.hand,
    ip: p.ip,
    era: p.era ?? undefined,
    whip: p.whip ?? undefined,
    k: p.k,
  });

  roster["P-L"] = allLeftSP.map((p) => mapPitcher(p, topSPIds.has(p.player.id)));
  roster["P-R"] = allRightSP.map((p) => mapPitcher(p, topSPIds.has(p.player.id)));
  roster["SR-L"] = leftSR.map((p) => mapPitcher(p, false));
  roster["SR-R"] = rightSR.map((p) => mapPitcher(p, false));

  // Compute team aggregates — ERA uses only top 5
  const vL = computeTeamOPS(hitters, vsLLineup, (h) => h.opsVsL);
  const vR = computeTeamOPS(hitters, vsRLineup, (h) => h.opsVsR);
  const spEra = computeSPEra(topSP);

  return {
    id: teamId,
    name: teamName,
    isMyTeam,
    vL,
    vR,
    spEra,
    pickPosition,
    roster,
  };
}

/**
 * Compute weighted average OPS for lineup starters
 */
function computeTeamOPS(
  hitters: PlayerWithStats[],
  lineup: Map<DepthChartPosition, Set<number>>,
  getOPS: (h: PlayerWithStats) => number | null,
): number | null {
  const starterIds = new Set<number>();
  for (const starters of lineup.values()) {
    for (const id of starters) starterIds.add(id);
  }

  const starterOPS = hitters
    .filter((h) => starterIds.has(h.player.id))
    .map((h) => getOPS(h))
    .filter((v): v is number => v !== null);

  if (starterOPS.length === 0) return null;
  return starterOPS.reduce((sum, v) => sum + v, 0) / starterOPS.length;
}

/**
 * Compute average ERA of starting pitchers
 */
function computeSPEra(sps: PitcherWithStats[]): number | null {
  const eras = sps.map((p) => p.era).filter((e): e is number => e !== null);
  if (eras.length === 0) return null;
  return eras.reduce((sum, e) => sum + e, 0) / eras.length;
}

/**
 * Build depth chart data for all teams
 */
export function buildAllTeamDepthCharts(
  teams: { id: number; name: string; is_my_team: boolean }[],
  players: Player[],
  hitterStatsMap: Map<number, AggregatedHitterStats>,
  pitcherStatsMap: Map<number, AggregatedPitcherStats>,
  draftPicks?: DraftPick[],
  statsSource: StatsSource = "actual",
): DepthChartTeam[] {
  // Group players by team_id
  const playersByTeam = new Map<number, Player[]>();
  for (const player of players) {
    if (player.team_id !== null) {
      const existing = playersByTeam.get(player.team_id) ?? [];
      playersByTeam.set(player.team_id, [...existing, player]);
    }
  }

  // Build pick position map (first round pick for each team)
  const pickPositionMap = new Map<number, number>();
  if (draftPicks) {
    for (const pick of draftPicks) {
      if (pick.round === 1 && !pickPositionMap.has(pick.team_id)) {
        pickPositionMap.set(pick.team_id, pick.pick_in_round);
      }
    }
  }

  // Sort teams: my team first, then alphabetically
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.is_my_team && !b.is_my_team) return -1;
    if (!a.is_my_team && b.is_my_team) return 1;
    return a.name.localeCompare(b.name);
  });

  return sortedTeams.map((team) =>
    buildTeamDepthChart(
      team.id,
      team.name,
      team.is_my_team,
      playersByTeam.get(team.id) ?? [],
      hitterStatsMap,
      pitcherStatsMap,
      pickPositionMap.get(team.id) ?? null,
      statsSource,
    )
  );
}
