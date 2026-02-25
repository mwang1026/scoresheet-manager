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
  formatAvg,
  formatRate,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  getQualifiedThreshold,
} from "./aggregation";

export {
  isPlayerPitcher,
  isEligibleAt,
  getEligiblePositions,
  getDefenseDisplay,
  getPositionsList,
  calculatePlatoonOPS,
} from "./player-utils";
