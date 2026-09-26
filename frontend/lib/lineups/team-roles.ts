/**
 * Resolve a team's lineup roles: scraped Scoresheet lineup first, depth chart
 * inference as a fallback, nothing when the team has no players.
 */

import type { Player, TeamLineup } from "../types";
import type { AggregatedHitterStats, AggregatedPitcherStats, StatsSource } from "../stats/types";
import { buildTeamDepthChart } from "../depth-charts/lineup-optimizer";
import { buildInferredRoleMap, buildRoleMap, type LineupRoleMap, type LineupRoleSource } from "./roles";

export interface TeamRoles {
  roles: LineupRoleMap;
  /** null when neither a scraped lineup nor enough players exist. */
  source: LineupRoleSource | null;
}

export interface BuildTeamRolesArgs {
  team: { id: number; name: string; is_my_team: boolean };
  lineup: TeamLineup | undefined;
  /** The team's rostered players. */
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  statsSource: StatsSource;
}

export function hasScrapedLineup(lineup: TeamLineup | undefined): lineup is TeamLineup {
  return !!lineup && (lineup.vs_rhp !== null || lineup.vs_lhp !== null);
}

export function buildTeamRoles(args: BuildTeamRolesArgs): TeamRoles {
  const { team, lineup, players, hitterStatsMap, pitcherStatsMap, statsSource } = args;
  if (hasScrapedLineup(lineup)) {
    return { roles: buildRoleMap(lineup), source: "scoresheet" };
  }
  if (players.length === 0) {
    return { roles: new Map(), source: null };
  }
  const depthChart = buildTeamDepthChart(
    team.id,
    team.name,
    team.is_my_team,
    players,
    hitterStatsMap,
    pitcherStatsMap,
    null,
    statsSource
  );
  return { roles: buildInferredRoleMap(depthChart), source: "inferred" };
}

/** Short caption explaining where a team's roles came from. */
export function describeLineupSource(source: LineupRoleSource | null, weekEnd: string | null): string | undefined {
  if (source === "scoresheet") {
    return weekEnd ? `Lineup from Scoresheet week ending ${weekEnd}` : "Lineup from Scoresheet";
  }
  if (source === "inferred") return "Lineup inferred from depth chart (no scraped lineup)";
  return undefined;
}
