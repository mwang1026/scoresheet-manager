/**
 * Lineup roles: what each rostered player does in a team's working lineup.
 *
 * Roles come from the scraped Scoresheet lineups (GET /api/lineups). When a
 * team has no scraped lineup, callers may build inferred roles from the depth
 * chart optimizer instead (see buildInferredRoleMap); those carry no batting
 * order and are labelled as inferred in the UI.
 */

import type { TeamLineup } from "../types";
import type { DepthChartPosition, DepthChartTeam } from "../depth-charts/types";
import { DEPTH_CHART_POSITIONS, PITCHER_POSITIONS, SP_POSITIONS } from "../depth-charts/types";

const HITTER_POSITIONS: DepthChartPosition[] = DEPTH_CHART_POSITIONS.filter(
  (p) => !PITCHER_POSITIONS.has(p)
);
const ROTATION_POSITIONS = DEPTH_CHART_POSITIONS.filter((p) => SP_POSITIONS.has(p));

/** Playoffs use a four-man rotation. */
export const PLAYOFF_ROTATION_SIZE = 4;

export type LineupRoleSource = "scoresheet" | "inferred";

export interface PlayerLineupRole {
  source: LineupRoleSource;
  /** 0-8 batting slot vs RHP, null when not in that lineup. */
  slotVsR: number | null;
  slotVsL: number | null;
  positionVsR: string | null;
  positionVsL: string | null;
  /** 1-based rotation order for starting pitchers, null otherwise. */
  rotationNo: number | null;
  isReliever: boolean;
}

export type LineupRoleMap = Map<number, PlayerLineupRole>;

function emptyRole(source: LineupRoleSource): PlayerLineupRole {
  return {
    source,
    slotVsR: null,
    slotVsL: null,
    positionVsR: null,
    positionVsL: null,
    rotationNo: null,
    isReliever: false,
  };
}

/** Hitter who starts in at least one of the two lineups. */
export function isStartingHitter(role: PlayerLineupRole | undefined): boolean {
  return !!role && (role.slotVsR !== null || role.slotVsL !== null);
}

/** Pitcher in the playoff rotation (first four). */
export function isPlayoffStarter(role: PlayerLineupRole | undefined): boolean {
  return !!role && role.rotationNo !== null && role.rotationNo <= PLAYOFF_ROTATION_SIZE;
}

/** Pitcher counted in starter totals: playoff rotation or bullpen. */
export function isPitchingStarter(role: PlayerLineupRole | undefined): boolean {
  return isPlayoffStarter(role) || !!role?.isReliever;
}

/** Any starting role: lineup hitter, rotation pitcher, or reliever. */
export function isStarter(role: PlayerLineupRole | undefined): boolean {
  return isStartingHitter(role) || isPlayoffStarter(role) || !!role?.isReliever;
}

/**
 * Build a role map from one team's scraped lineup. Unresolved pins (AAA
 * fill-ins) have no player_id and are skipped.
 */
export function buildRoleMap(lineup: TeamLineup | undefined): LineupRoleMap {
  const roles: LineupRoleMap = new Map();
  if (!lineup) return roles;

  const get = (playerId: number) => {
    let role = roles.get(playerId);
    if (!role) {
      role = emptyRole("scoresheet");
      roles.set(playerId, role);
    }
    return role;
  };

  for (const s of lineup.vs_rhp ?? []) {
    if (s.player_id === null) continue;
    const role = get(s.player_id);
    role.slotVsR = s.slot;
    role.positionVsR = s.position;
  }
  for (const s of lineup.vs_lhp ?? []) {
    if (s.player_id === null) continue;
    const role = get(s.player_id);
    role.slotVsL = s.slot;
    role.positionVsL = s.position;
  }
  lineup.rotation.forEach((p, i) => {
    if (p.player_id === null) return;
    get(p.player_id).rotationNo = i + 1;
  });
  for (const p of lineup.relievers) {
    if (p.player_id === null) continue;
    const role = get(p.player_id);
    if (role.rotationNo === null) role.isReliever = true;
  }
  return roles;
}

/**
 * Inferred roles from the depth chart optimizer when no scraped lineup exists.
 * Starters get slot 0 (order unknown) so they sort ahead of the bench; the
 * source flag lets the UI label them as inferred.
 */
export function buildInferredRoleMap(team: DepthChartTeam): LineupRoleMap {
  const roles: LineupRoleMap = new Map();
  const get = (playerId: number) => {
    let role = roles.get(playerId);
    if (!role) {
      role = emptyRole("inferred");
      roles.set(playerId, role);
    }
    return role;
  };

  for (const pos of HITTER_POSITIONS) {
    for (const p of team.roster[pos] ?? []) {
      if (p.role === "bench") continue;
      const role = get(p.id);
      if (p.role === "LR" || p.role === "R") {
        role.slotVsR = 0;
        role.positionVsR = role.positionVsR ?? pos;
      }
      if (p.role === "LR" || p.role === "L") {
        role.slotVsL = 0;
        role.positionVsL = role.positionVsL ?? pos;
      }
    }
  }

  let rotationNo = 0;
  for (const pos of ROTATION_POSITIONS) {
    for (const p of team.roster[pos] ?? []) {
      if (p.role === "bench") continue;
      const role = get(p.id);
      if (role.rotationNo === null) role.rotationNo = ++rotationNo;
    }
  }
  return roles;
}

/**
 * Sort key: vs-RHP starters by slot, then vs-LHP-only starters, then the
 * rotation in order, then relievers, then the bench.
 */
export function lineupSortKey(role: PlayerLineupRole | undefined): number {
  if (!role) return 400;
  if (role.slotVsR !== null) return role.slotVsR;
  if (role.slotVsL !== null) return 100 + role.slotVsL;
  if (role.rotationNo !== null) return 200 + role.rotationNo;
  if (role.isReliever) return 300;
  return 400;
}

/**
 * Compact label for a table cell: "3 / 5", "B", "SP2", "RP", "S" (inferred).
 * A missing role means the player is not in the lineup at all, i.e. bench.
 */
export function formatLineupRole(role: PlayerLineupRole | undefined): string {
  if (!role) return "B";
  if (role.rotationNo !== null) return `SP${role.rotationNo}`;
  if (role.isReliever) return "RP";
  if (role.slotVsR === null && role.slotVsL === null) return "B";
  if (role.source === "inferred") return "S";
  const r = role.slotVsR === null ? "–" : String(role.slotVsR + 1);
  const l = role.slotVsL === null ? "–" : String(role.slotVsL + 1);
  return `${r} / ${l}`;
}
