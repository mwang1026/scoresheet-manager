/**
 * API fetch and mutation functions for all backend endpoints.
 */

import type {
  MyTeam,
  Player,
  ScrapedLeague,
  ScrapedTeam,
  Team,
  HitterDailyStats,
  PitcherDailyStats,
  Projection,
} from "../types";
import {
  transformPlayer,
  transformTeam,
  transformHitterStats,
  transformPitcherStats,
  transformProjection,
} from "./transforms";

/**
 * Module-level team ID for injecting X-Team-Id header into team-scoped requests.
 * Set by TeamProvider via setApiTeamId().
 */
let _currentTeamId: number | null = null;

export function setApiTeamId(id: number | null): void {
  _currentTeamId = id;
}

function getTeamHeaders(): Record<string, string> {
  if (_currentTeamId === null) return {};
  return { "X-Team-Id": String(_currentTeamId) };
}

/**
 * Fetch all Scoresheet league players
 *
 * NOTE: Fetches all players in one call (page_size=2000).
 * Single-user app, ~1,600 players total.
 */
export async function fetchPlayers(teamId?: number): Promise<Player[]> {
  const headers = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/players?page_size=2000", { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch players: ${response.statusText}`);
  }

  const data = await response.json();
  return data.players.map(transformPlayer);
}

/**
 * Fetch a single player by ID
 */
export async function fetchPlayer(playerId: number): Promise<Player> {
  const response = await fetch(`/api/players/${playerId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Player not found");
    }
    throw new Error(`Failed to fetch player: ${response.statusText}`);
  }

  const backendPlayer = await response.json();
  return transformPlayer(backendPlayer);
}

/**
 * Fetch all fantasy teams
 */
export async function fetchTeams(teamId?: number): Promise<Team[]> {
  const headers = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/teams", { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.statusText}`);
  }

  const data = await response.json();
  return data.teams.map(transformTeam);
}

/**
 * Fetch hitter stats for a date range
 *
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @param playerId - Optional player ID filter (for player detail page)
 */
export async function fetchHitterStats(
  start: string,
  end: string,
  playerId?: number
): Promise<HitterDailyStats[]> {
  const params = new URLSearchParams({ start, end });
  if (playerId) {
    params.append("player_id", playerId.toString());
  }

  const response = await fetch(`/api/stats/hitters?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch hitter stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.stats.map(transformHitterStats);
}

/**
 * Fetch pitcher stats for a date range
 *
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @param playerId - Optional player ID filter (for player detail page)
 */
export async function fetchPitcherStats(
  start: string,
  end: string,
  playerId?: number
): Promise<PitcherDailyStats[]> {
  const params = new URLSearchParams({ start, end });
  if (playerId) {
    params.append("player_id", playerId.toString());
  }

  const response = await fetch(`/api/stats/pitchers?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch pitcher stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.stats.map(transformPitcherStats);
}

/**
 * Fetch projections for all Scoresheet league players
 *
 * @param source - Optional projection source filter (e.g., "PECOTA-50")
 * @param playerId - Optional player ID filter (for player detail page)
 * @param season - Season year (defaults to 2026)
 */
export async function fetchProjections(
  source?: string,
  playerId?: number,
  season?: number
): Promise<Projection[]> {
  const params = new URLSearchParams();
  if (source) {
    params.append("source", source);
  }
  if (playerId) {
    params.append("player_id", playerId.toString());
  }
  if (season) {
    params.append("season", season.toString());
  }

  const url = `/api/projections${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch projections: ${response.statusText}`);
  }

  const data = await response.json();
  return data.projections.map(transformProjection);
}

/**
 * Fetch watchlist player IDs
 */
export async function fetchWatchlist(teamId?: number): Promise<number[]> {
  const headers = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/watchlist", { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch watchlist: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}

/**
 * Add a player to the watchlist
 */
export async function addToWatchlistAPI(playerId: number, teamId?: number): Promise<number[]> {
  const teamHeaders = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...teamHeaders },
    body: JSON.stringify({ player_id: playerId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add to watchlist: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}

/**
 * Remove a player from the watchlist
 */
export async function removeFromWatchlistAPI(playerId: number, teamId?: number): Promise<number[]> {
  const headers = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch(`/api/watchlist/${playerId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to remove from watchlist: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}

/**
 * Fetch draft queue player IDs (ordered)
 */
export async function fetchDraftQueue(teamId?: number): Promise<number[]> {
  const headers = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/draft-queue", { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch draft queue: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}

/**
 * Add a player to the draft queue
 */
export async function addToQueueAPI(playerId: number, teamId?: number): Promise<number[]> {
  const teamHeaders = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/draft-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...teamHeaders },
    body: JSON.stringify({ player_id: playerId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add to queue: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}

/**
 * Remove a player from the draft queue
 */
export async function removeFromQueueAPI(playerId: number, teamId?: number): Promise<number[]> {
  const headers = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch(`/api/draft-queue/${playerId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to remove from queue: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}

/**
 * Fetch the current user's persisted settings from the backend.
 * Returns null if no settings have been saved yet.
 */
export async function fetchUserSettings(): Promise<import("../settings-types").UserSettings | null> {
  const response = await fetch("/api/me/settings", { headers: getTeamHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to fetch user settings: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data) return null;
  return data.settings_json as import("../settings-types").UserSettings;
}

/**
 * Persist the current user's settings to the backend.
 */
export async function saveUserSettings(
  settings: import("../settings-types").UserSettings
): Promise<void> {
  const response = await fetch("/api/me/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getTeamHeaders() },
    body: JSON.stringify({ settings_json: settings }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save user settings: ${response.statusText}`);
  }
}

/**
 * Fetch all teams for the current user with league info
 */
export async function fetchMyTeams(): Promise<MyTeam[]> {
  const response = await fetch("/api/me/teams", { headers: getTeamHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to fetch my teams: ${response.statusText}`);
  }

  const data = await response.json();
  return data.teams;
}

/**
 * Fetch the cached list of Scoresheet leagues
 */
export async function fetchScrapedLeagues(): Promise<ScrapedLeague[]> {
  const response = await fetch("/api/scoresheet/leagues");

  if (!response.ok) {
    throw new Error(`Failed to fetch leagues: ${response.statusText}`);
  }

  const data = await response.json();
  return data.leagues;
}

/**
 * Fetch team owner names for a specific Scoresheet league
 */
export async function fetchScrapedTeams(dataPath: string): Promise<ScrapedTeam[]> {
  const response = await fetch(`/api/scoresheet/leagues/${dataPath}/teams`);

  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.statusText}`);
  }

  const data = await response.json();
  return data.teams;
}

/**
 * Add a team association for the current user
 */
export async function addMyTeam(dataPath: string, scoresheetTeamId: number): Promise<MyTeam> {
  const response = await fetch("/api/me/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getTeamHeaders() },
    body: JSON.stringify({ data_path: dataPath, scoresheet_team_id: scoresheetTeamId }),
  });

  if (!response.ok) {
    const detail = await response.json().then((d) => d.detail).catch(() => response.statusText);
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return response.json();
}

/**
 * Remove a team association for the current user
 */
export async function removeMyTeam(teamId: number): Promise<void> {
  const response = await fetch(`/api/me/teams/${teamId}`, {
    method: "DELETE",
    headers: getTeamHeaders(),
  });

  if (!response.ok) {
    const detail = await response.json().then((d) => d.detail).catch(() => response.statusText);
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

/**
 * Fetch all notes for the current team as a player_id → content map
 */
export async function fetchTeamNotes(): Promise<Record<number, string>> {
  const response = await fetch("/api/notes", { headers: getTeamHeaders() });

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  const data = await response.json();
  // Backend returns string keys; convert to number keys
  const notes: Record<number, string> = {};
  for (const [key, value] of Object.entries(data.notes)) {
    notes[Number(key)] = value as string;
  }
  return notes;
}

/**
 * Upsert a player note. Empty content deletes.
 */
export async function upsertNoteAPI(playerId: number, content: string): Promise<void> {
  const response = await fetch(`/api/players/${playerId}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getTeamHeaders() },
    body: JSON.stringify({ content }),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to save note: ${response.statusText}`);
  }
}

/**
 * Reorder the draft queue
 */
export async function reorderQueueAPI(playerIds: number[], teamId?: number): Promise<number[]> {
  const teamHeaders = teamId != null ? { "X-Team-Id": String(teamId) } : getTeamHeaders();
  const response = await fetch("/api/draft-queue/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...teamHeaders },
    body: JSON.stringify({ player_ids: playerIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder queue: ${response.statusText}`);
  }

  const data = await response.json();
  return data.player_ids;
}
