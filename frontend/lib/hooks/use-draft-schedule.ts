"use client";

import useSWR from "swr";
import type { DraftScheduleData } from "../types";
import { fetchDraftSchedule, refreshDraftSchedule } from "../api";
import { useTeamContext } from "../contexts/team-context";

/**
 * SWR hook for fetching the draft schedule from the API.
 *
 * Returns schedule data, loading/error states, and a refresh function
 * that triggers a backend re-scrape and optimistically updates the cache.
 */
export function useDraftSchedule() {
  const { teamId } = useTeamContext();
  const key = teamId ? `/api/draft/schedule?team=${teamId}` : null;

  const { data, isLoading, error, mutate } = useSWR<DraftScheduleData>(
    key,
    () => fetchDraftSchedule(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const refresh = async () => {
    const result = await refreshDraftSchedule();
    mutate(result, false);
    return result;
  };

  return { schedule: data, isLoading, error, refresh };
}
