"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { LineupsData, TeamLineup } from "../types";
import { fetchLineups, refreshLineups } from "../api";
import { useTeamContext } from "../contexts/team-context";

/**
 * SWR hook for the league's derived team lineups (latest scraped Scoresheet week).
 *
 * Keyed by the active team so switching leagues refetches. Exposes a
 * per-team lookup and a refresh that triggers the backend scrape.
 */
export function useTeamLineups() {
  const { teamId, currentTeam } = useTeamContext();
  const key = teamId ? `/api/lineups?team=${teamId}` : null;

  const { data, isLoading, error, mutate } = useSWR<LineupsData>(key, () => fetchLineups(), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const lineupsByTeam = useMemo(
    () => new Map<number, TeamLineup>((data?.teams ?? []).map((t) => [t.team_id, t])),
    [data]
  );

  const refresh = async () => {
    if (!currentTeam) return;
    await refreshLineups(currentTeam.league_id);
    await mutate();
  };

  return {
    lineups: data,
    lineupsByTeam,
    weekEnd: data?.week_end ?? null,
    isLoading,
    error,
    refresh,
  };
}
