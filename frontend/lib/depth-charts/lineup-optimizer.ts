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
  CF_DEF_WEIGHT,
  DEF_POSITIONS,
  AVERAGE_DEF_BASELINE,
  SP_DISPLAY_LIMIT,
  MIN_PROJECTED_PA,
  MIN_PROJECTED_P_IP,
  SR_POSITIONS,
  NO_DEF_POSITIONS,
} from "./types";
import { dcPositionToBase } from "./oop-penalties";

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
 * Get defense rating for a player at a specific depth chart position.
 * OOP ratings are already merged into eligible_* fields by the backend.
 */
function getDefenseRating(
  player: Player,
  position: DepthChartPosition,
): number | null {
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
 * Check if a hitter is eligible at a given depth chart position.
 * OOP eligibility is already merged into eligible_* fields by the backend.
 */
export function isEligibleAtDCPosition(
  player: Player,
  position: DepthChartPosition,
): boolean {
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
// Positions excluded from greedy loop — handled separately
const GREEDY_EXCLUDED = new Set<DepthChartPosition>(["DH", "CF", "COF"]);

function getPositionOrder(
  hitters: PlayerWithStats[],
): { position: DepthChartPosition; count: number }[] {
  const positionsWithCounts = HITTER_POSITIONS
    .filter((pos) => !GREEDY_EXCLUDED.has(pos))
    .map((pos) => ({
      position: pos,
      count: hitters.filter((h) =>
        isEligibleAtDCPosition(h.player, pos)
      ).length,
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

  // Reserve sole CF-eligible player so greedy loop doesn't consume them
  const cfEligible = hitters.filter((h) => isEligibleAtDCPosition(h.player, "CF"));
  if (cfEligible.length === 1) {
    assigned.add(cfEligible[0].player.id);
  }

  const positionOrder = getPositionOrder(hitters);

  // Assign starters for each position (thinnest first)
  for (const { position } of positionOrder) {
    const slots = STARTERS_PER_POSITION[position] ?? 1;
    const eligible = hitters
      .filter((h) =>
        isEligibleAtDCPosition(h.player, position) &&
        !assigned.has(h.player.id)
      )
      .sort((a, b) => (getOPS(b) ?? -1) - (getOPS(a) ?? -1));

    const starters = new Set<number>();
    for (let i = 0; i < Math.min(slots, eligible.length); i++) {
      starters.add(eligible[i].player.id);
      assigned.add(eligible[i].player.id);
    }
    lineup.set(position, starters);
  }

  // Un-reserve sole CF player for OF assignment
  if (cfEligible.length === 1) {
    assigned.delete(cfEligible[0].player.id);
  }

  // OF assignment: optimize CF for defense among OPS starters
  const ofEligible = hitters
    .filter((h) =>
      isEligibleAtDCPosition(h.player, "COF") && !assigned.has(h.player.id)
    )
    .sort((a, b) => (getOPS(b) ?? -1) - (getOPS(a) ?? -1));

  const top3 = ofEligible.slice(0, 3);
  const cfInTop3 = top3.filter((h) =>
    isEligibleAtDCPosition(h.player, "CF")
  );

  let cfStarter: PlayerWithStats | null = null;
  let cofStarters: PlayerWithStats[];

  if (cfInTop3.length >= 1) {
    // Pick best defender among CF-eligible in top 3
    cfStarter = cfInTop3.reduce((best, h) => {
      const bestDef = best.player.eligible_of ?? -Infinity;
      const hDef = h.player.eligible_of ?? -Infinity;
      return hDef > bestDef ? h : best;
    });
    cofStarters = top3.filter((h) => h !== cfStarter);
  } else {
    // No CF-eligible in top 3 — find best CF-eligible by OPS outside top 3
    const cfOutside = ofEligible.filter(
      (h) => isEligibleAtDCPosition(h.player, "CF") && !top3.includes(h)
    );
    if (cfOutside.length > 0) {
      cfStarter = cfOutside[0]; // Already sorted by OPS desc
      cofStarters = ofEligible.slice(0, 2);
    } else {
      // No CF-eligible — assign best defender among top 3 OPS outfielders to CF
      if (top3.length > 0) {
        cfStarter = top3.reduce((best, h) => {
          const bestDef = best.player.eligible_of ?? -Infinity;
          const hDef = h.player.eligible_of ?? -Infinity;
          return hDef > bestDef ? h : best;
        });
        cofStarters = top3.filter((h) => h !== cfStarter);
      } else {
        cfStarter = null;
        cofStarters = [];
      }
    }
  }

  lineup.set("CF", cfStarter ? new Set([cfStarter.player.id]) : new Set());
  if (cfStarter) assigned.add(cfStarter.player.id);

  const cofSet = new Set<number>();
  for (const s of cofStarters) {
    cofSet.add(s.player.id);
    assigned.add(s.player.id);
  }
  lineup.set("COF", cofSet);

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

    // Special case: CF vs COF — primary = CF only if CF in both lineups
    if (starterPositions.includes("CF") && starterPositions.includes("COF")) {
      const cfInL = vsLLineup.get("CF")?.has(player.id) ?? false;
      const cfInR = vsRLineup.get("CF")?.has(player.id) ?? false;
      primaryPositions.set(player.id, (cfInL && cfInR) ? "CF" : "COF");
      continue;
    }

    // Multiple positions: pick thinnest (fewest eligible hitters at that position)
    const positionsByDepth = starterPositions.map((pos) => ({
      pos,
      eligible: hitters.filter((h) =>
        isEligibleAtDCPosition(h.player, pos)
      ).length,
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
 * Compute aggregate starting DEF for a lineup, relative to baseline.
 * For each DEF_POSITION, sums the defense rating of assigned starters.
 * CF is weighted at CF_DEF_WEIGHT. Missing ratings contribute 0 (position average).
 */
export function computeStartingDEF(
  hitters: PlayerWithStats[],
  lineup: Map<DepthChartPosition, Set<number>>,
): number | null {
  if (hitters.length === 0) return null;

  let rawSum = 0;

  for (const pos of DEF_POSITIONS) {
    const starterIds = lineup.get(pos);
    if (!starterIds || starterIds.size === 0) {
      // No starters assigned — use position average (contributes 0 relative)
      const slots = STARTERS_PER_POSITION[pos] ?? 1;
      const avg = DEFENSE_AVERAGES[pos] ?? 0;
      const weight = pos === "CF" ? CF_DEF_WEIGHT : 1;
      rawSum += avg * weight * slots;
      continue;
    }

    for (const id of starterIds) {
      const hitter = hitters.find((h) => h.player.id === id);
      const rating = hitter ? getDefenseRating(hitter.player, pos) : null;
      const value = rating ?? (DEFENSE_AVERAGES[pos] ?? 0);
      const weight = pos === "CF" ? CF_DEF_WEIGHT : 1;
      rawSum += value * weight;
    }

    // Fill missing slots with position average
    const expectedSlots = STARTERS_PER_POSITION[pos] ?? 1;
    const filledSlots = starterIds.size;
    if (filledSlots < expectedSlots) {
      const avg = DEFENSE_AVERAGES[pos] ?? 0;
      const weight = pos === "CF" ? CF_DEF_WEIGHT : 1;
      rawSum += avg * weight * (expectedSlots - filledSlots);
    }
  }

  return rawSum - AVERAGE_DEF_BASELINE;
}

/**
 * Build maximum-defense lineup using recursive backtracking.
 * Tries all valid assignments to find the one maximizing total weighted DEF.
 * With ~7 slots and 2-5 candidates per position, the search space is tiny.
 * Returns { ids: Set of player IDs in the maxDEF lineup, lineup: position map }.
 */
function buildMaxDEFLineup(
  hitters: PlayerWithStats[],
): { ids: Set<number>; lineup: Map<DepthChartPosition, Set<number>> } {
  // Expand positions into individual slots: 1B, 2B, 3B, SS, CF, COF-1, COF-2
  type Slot = { position: DepthChartPosition; slotIndex: number };
  const slots: Slot[] = [];
  for (const pos of DEF_POSITIONS) {
    const count = STARTERS_PER_POSITION[pos] ?? 1;
    for (let i = 0; i < count; i++) {
      slots.push({ position: pos, slotIndex: i });
    }
  }

  // Build eligibility lists per slot
  const slotEligible: PlayerWithStats[][] = slots.map(({ position }) => {
    let eligible = hitters.filter((h) => isEligibleAtDCPosition(h.player, position));
    // CF fallback: if no CF-eligible players, allow any COF-eligible player
    if (position === "CF" && eligible.length === 0) {
      eligible = hitters.filter((h) => isEligibleAtDCPosition(h.player, "COF"));
    }
    return eligible;
  });

  // Sort slots by eligibility count (thinnest first) for better pruning
  const slotOrder = slots.map((_, i) => i);
  slotOrder.sort((a, b) => slotEligible[a].length - slotEligible[b].length);

  // Precompute default (empty slot) scores
  const slotDefaultScore = slots.map(({ position }) => {
    const avg = DEFENSE_AVERAGES[position] ?? 0;
    const weight = position === "CF" ? CF_DEF_WEIGHT : 1;
    return avg * weight;
  });

  let bestScore = -Infinity;
  let bestAssignment: (number | null)[] = new Array(slots.length).fill(null);
  const currentAssignment: (number | null)[] = new Array(slots.length).fill(null);
  const usedIds = new Set<number>();

  // Upper bound: sum of default scores for remaining unvisited slots
  // plus best possible score for each remaining slot
  function search(orderIdx: number, currentScore: number): void {
    if (orderIdx === slotOrder.length) {
      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestAssignment = [...currentAssignment];
      }
      return;
    }

    const slotIdx = slotOrder[orderIdx];
    const { position, slotIndex } = slots[slotIdx];
    const weight = position === "CF" ? CF_DEF_WEIGHT : 1;

    // Compute upper bound: current score + best possible for remaining slots
    let upperBound = currentScore;
    for (let i = orderIdx; i < slotOrder.length; i++) {
      const si = slotOrder[i];
      const eligible = slotEligible[si];
      let bestSlotScore = slotDefaultScore[si];
      for (const h of eligible) {
        if (usedIds.has(h.player.id)) continue;
        const rating = getDefenseRating(h.player, slots[si].position);
        const w = slots[si].position === "CF" ? CF_DEF_WEIGHT : 1;
        const score = (rating ?? (DEFENSE_AVERAGES[slots[si].position] ?? 0)) * w;
        if (score > bestSlotScore) bestSlotScore = score;
      }
      upperBound += bestSlotScore;
    }
    if (upperBound <= bestScore) return; // Prune

    // For COF-2 (slotIndex=1), only consider players with id > COF-1's id to avoid duplicates
    const cofMinId = position === "COF" && slotIndex === 1
      ? (currentAssignment[slotOrder.find((si) =>
          slots[si].position === "COF" && slots[si].slotIndex === 0
        )!] ?? 0)
      : 0;

    // Try assigning each eligible player
    for (const h of slotEligible[slotIdx]) {
      if (usedIds.has(h.player.id)) continue;
      if (cofMinId > 0 && h.player.id <= cofMinId) continue;

      const rating = getDefenseRating(h.player, position);
      const score = (rating ?? (DEFENSE_AVERAGES[position] ?? 0)) * weight;

      currentAssignment[slotIdx] = h.player.id;
      usedIds.add(h.player.id);
      search(orderIdx + 1, currentScore + score);
      usedIds.delete(h.player.id);
      currentAssignment[slotIdx] = null;
    }

    // Try leaving slot empty (league average)
    currentAssignment[slotIdx] = null;
    search(orderIdx + 1, currentScore + slotDefaultScore[slotIdx]);
  }

  search(0, 0);

  // Convert best assignment to lineup map
  const lineup = new Map<DepthChartPosition, Set<number>>();
  for (const pos of HITTER_POSITIONS) {
    lineup.set(pos, new Set());
  }

  const ids = new Set<number>();
  for (let i = 0; i < slots.length; i++) {
    const playerId = bestAssignment[i];
    if (playerId !== null) {
      lineup.get(slots[i].position)!.add(playerId);
      ids.add(playerId);
    }
  }

  return { ids, lineup };
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
  const maxDEF = buildMaxDEFLineup(lineupHitters);

  // Derive primary positions
  const primaryPositions = determinePrimaryPositions(hitters, vsLLineup, vsRLineup);

  // Build roster map
  const roster = {} as Record<DepthChartPosition, DepthChartPlayer[]>;

  // Hitter positions
  for (const pos of HITTER_POSITIONS) {
    let eligible = hitters.filter((h) =>
      isEligibleAtDCPosition(h.player, pos)
    );
    // CF: include players assigned to CF in lineup even if below threshold
    if (pos === "CF") {
      const cfInL = vsLLineup.get("CF") ?? new Set();
      const cfInR = vsRLineup.get("CF") ?? new Set();
      const assignedToCF = new Set([...cfInL, ...cfInR]);
      for (const h of hitters) {
        if (assignedToCF.has(h.player.id) && !eligible.some((e) => e.player.id === h.player.id)) {
          eligible.push(h);
        }
      }
    }
    // DH: show players assigned to DH in either lineup, plus DH-only players
    if (pos === "DH") {
      eligible = eligible.filter((h) => {
        const inL = vsLLineup.get("DH")?.has(h.player.id) ?? false;
        const inR = vsRLineup.get("DH")?.has(h.player.id) ?? false;
        const isDHOnly = h.player.primary_position === "DH";
        return inL || inR || isDHOnly;
      });
    }
    const baseline = DEFENSE_AVERAGES[pos] ?? null;

    roster[pos] = eligible.map((h): DepthChartPlayer => {
      // Derive role from position-specific lineup membership
      // (a player may be at 3B in vsL but DH in vsR — show position-specific role)
      let role: PlatoonRole;
      const inL = vsLLineup.get(pos)?.has(h.player.id) ?? false;
      const inR = vsRLineup.get(pos)?.has(h.player.id) ?? false;
      if (inL && inR) role = "LR";
      else if (inL) role = "L";
      else if (inR) role = "R";
      else role = "bench";
      const isPrimary = primaryPositions.get(h.player.id) === pos;
      const defRating = getDefenseRating(h.player, pos);
      const defDiff = defRating !== null && baseline !== null ? defRating - baseline : null;
      // Player is OOP at this position if oop_positions includes the base position
      const basePos = dcPositionToBase(pos);
      const isOOP = basePos ? (h.player.oop_positions ?? []).includes(basePos) : false;

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
        isOOP,
        inMaxDEF: maxDEF.ids.has(h.player.id),
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
    inMaxDEF: false,
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

  // DEF aggregates — relative to league-average baseline
  const defVsL = computeStartingDEF(hitters, vsLLineup);
  const defVsR = computeStartingDEF(hitters, vsRLineup);
  const defLate = computeStartingDEF(hitters, maxDEF.lineup);

  // Compute lineup gaps — count unfilled hitter starter slots in the worse lineup
  const countStarters = (lineup: Map<DepthChartPosition, Set<number>>) =>
    HITTER_POSITIONS.reduce((sum, pos) => sum + (lineup.get(pos)?.size ?? 0), 0);
  const expectedStarters = HITTER_POSITIONS.reduce(
    (sum, pos) => sum + (STARTERS_PER_POSITION[pos] ?? 1), 0,
  );
  const minStarters = Math.min(countStarters(vsLLineup), countStarters(vsRLineup));
  const lineupGaps = Math.max(0, expectedStarters - minStarters);

  return {
    id: teamId,
    name: teamName,
    isMyTeam,
    vL,
    vR,
    spEra,
    defVsL,
    defVsR,
    defLate,
    pickPosition,
    lineupGaps,
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
