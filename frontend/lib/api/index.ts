/**
 * API module barrel — re-exports everything from sub-modules.
 *
 * Consumers import from "@/lib/api" as before; TypeScript resolves
 * this to api/index.ts automatically. Zero import path changes needed.
 */

export type {
  BackendPlayer,
  BackendTeam,
  BackendHitterStats,
  BackendPitcherStats,
  BackendHitterProjection,
  BackendPitcherProjection,
  BackendProjection,
} from "./transforms";

export {
  transformPlayer,
  transformTeam,
  transformHitterStats,
  transformPitcherStats,
  transformProjection,
} from "./transforms";

export {
  setApiTeamId,
  fetchPlayers,
  fetchPlayer,
  fetchTeams,
  fetchHitterStats,
  fetchPitcherStats,
  fetchProjections,
  fetchWatchlist,
  addToWatchlistAPI,
  removeFromWatchlistAPI,
  fetchDraftQueue,
  addToQueueAPI,
  removeFromQueueAPI,
  reorderQueueAPI,
  fetchDraftSchedule,
  refreshDraftSchedule,
  fetchTeamNotes,
  upsertNoteAPI,
  fetchUserSettings,
  saveUserSettings,
  fetchMyTeams,
  fetchScrapedLeagues,
  fetchScrapedTeams,
  addMyTeam,
  removeMyTeam,
} from "./fetchers";
