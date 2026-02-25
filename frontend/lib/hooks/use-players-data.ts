/**
 * SWR data hooks for fetching players, teams, and stats from the API
 */

import useSWR from "swr";
import type { DateRange } from "../stats";
import type { Player, Team, HitterDailyStats, PitcherDailyStats, Projection } from "../types";
import {
  fetchPlayers,
  fetchTeams,
  fetchHitterStats,
  fetchPitcherStats,
  fetchProjections,
} from "../api";
import { getSeasonStartStr } from "../defaults";

/**
 * Convert relative DateRange to absolute date strings
 *
 * Returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 */
export function getDateRangeBounds(range: DateRange): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (range.type === "season") {
    const year = range.year || now.getFullYear();
    return {
      start: getSeasonStartStr(year),
      end: formatDate(today),
    };
  }

  if (range.type === "wtd") {
    // Week to date (Monday to today)
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    return {
      start: formatDate(monday),
      end: formatDate(today),
    };
  }

  if (range.type === "last7") {
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 6); // 6 days ago + today = 7 days
    return {
      start: formatDate(last7),
      end: formatDate(today),
    };
  }

  if (range.type === "last14") {
    const last14 = new Date(today);
    last14.setDate(today.getDate() - 13);
    return {
      start: formatDate(last14),
      end: formatDate(today),
    };
  }

  if (range.type === "last30") {
    const last30 = new Date(today);
    last30.setDate(today.getDate() - 29);
    return {
      start: formatDate(last30),
      end: formatDate(today),
    };
  }

  // Custom range - already has absolute dates
  return {
    start: range.start,
    end: range.end,
  };
}

/**
 * Hook to fetch all Scoresheet league players
 */
export function usePlayers() {
  const { data, error, isLoading } = useSWR<Player[]>("players", fetchPlayers, {
    revalidateOnFocus: false, // Don't refetch on window focus (static data)
    dedupingInterval: 60000, // Dedupe requests within 60s
  });

  return {
    players: data,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch all fantasy teams
 */
export function useTeams() {
  const { data, error, isLoading } = useSWR<Team[]>("teams", fetchTeams, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  return {
    teams: data,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch hitter stats for a date range
 */
export function useHitterStats(dateRange: DateRange, playerId?: number) {
  const { start, end } = getDateRangeBounds(dateRange);

  // Create cache key from date range and optional player filter
  const key = playerId
    ? `hitter-stats-${start}-${end}-${playerId}`
    : `hitter-stats-${start}-${end}`;

  const { data, error, isLoading } = useSWR<HitterDailyStats[]>(
    key,
    () => fetchHitterStats(start, end, playerId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Stats change less frequently
    }
  );

  return {
    stats: data,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch pitcher stats for a date range
 */
export function usePitcherStats(dateRange: DateRange, playerId?: number) {
  const { start, end } = getDateRangeBounds(dateRange);

  // Create cache key from date range and optional player filter
  const key = playerId
    ? `pitcher-stats-${start}-${end}-${playerId}`
    : `pitcher-stats-${start}-${end}`;

  const { data, error, isLoading } = useSWR<PitcherDailyStats[]>(
    key,
    () => fetchPitcherStats(start, end, playerId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  return {
    stats: data,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch projections for all Scoresheet league players
 *
 * @param source - Optional projection source filter (e.g., "PECOTA-50")
 * @param playerId - Optional player ID filter (for player detail page)
 * @param season - Season year (defaults to 2026)
 */
export function useProjections(source?: string, playerId?: number, season?: number) {
  // Create cache key from filters
  const keyParts = ["projections"];
  if (source) keyParts.push(source);
  if (playerId) keyParts.push(playerId.toString());
  if (season) keyParts.push(season.toString());
  const key = keyParts.join("-");

  const { data, error, isLoading } = useSWR<Projection[]>(
    key,
    () => fetchProjections(source, playerId, season),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes - projections rarely change
    }
  );

  return {
    projections: data,
    isLoading,
    error,
  };
}
