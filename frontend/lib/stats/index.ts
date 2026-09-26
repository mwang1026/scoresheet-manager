/**
 * Stats module barrel — re-exports everything from sub-modules.
 *
 * Consumers import from "@/lib/stats" as before; TypeScript resolves
 * this to stats/index.ts automatically. Zero import path changes needed.
 */

export type {
  AggregatedHitterStats,
  AggregatedPitcherStats,
  DateRange,
  StatsSource,
} from "./types";

export {
  aggregateHitterStats,
  aggregatePitcherStats,
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  filterStatsByDateRange,
  formatIP,
  formatCount,
  formatAvg,
  formatRate,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  getQualifiedThreshold,
} from "./aggregation";

export {
  STATS_SOURCE_OPTIONS,
  STATS_SOURCE_LABELS,
  usesDailyStats,
  usesDateRange,
  isStatsSource,
} from "./sources";

export {
  PLAYOFF_WINDOW_WEIGHT,
  HITTER_SERIES_PA_PCT,
  PITCHER_SERIES_IP_PCT,
  MIN_WINDOW_GS_FOR_ONE_START,
  MIN_WINDOW_GS_FOR_TWO_STARTS,
  isInPlayoffWindow,
  scaleDailyRow,
  computePlayoffHitterStats,
  computePlayoffPitcherStats,
  playoffStartsFor,
  getPlayoffStatsMaps,
  formatPlayoffWindow,
} from "./playoff";
export type {
  PlayoffHitterMeta,
  PlayoffPitcherMeta,
  PlayoffStarts,
  PlayoffStatsMaps,
  PlayoffWindow,
} from "./playoff";

export {
  buildStatsMaps,
  aggregateRosterHitters,
  aggregateRosterPitchers,
  pickPlayers,
} from "./stats-maps";
export type { BuildStatsMapsArgs, StatsMaps } from "./stats-maps";

export {
  isPlayerPitcher,
  isEligibleAt,
  getEligiblePositions,
  getDefenseDisplay,
  getPositionsList,
  calculatePlatoonOPS,
} from "./player-utils";
