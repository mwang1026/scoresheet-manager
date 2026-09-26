export {
  PLAYOFF_ROTATION_SIZE,
  buildRoleMap,
  buildInferredRoleMap,
  isStartingHitter,
  isPlayoffStarter,
  isPitchingStarter,
  isStarter,
  lineupSortKey,
  formatLineupRole,
} from "./roles";
export type { LineupRoleMap, LineupRoleSource, PlayerLineupRole } from "./roles";

export {
  computeStarterHitterTotals,
  computeStarterPitcherTotals,
  computeStarterTotals,
} from "./starter-totals";
export type { StarterTotals } from "./starter-totals";

export { buildTeamRoles, describeLineupSource, hasScrapedLineup } from "./team-roles";
export type { BuildTeamRolesArgs, TeamRoles } from "./team-roles";
