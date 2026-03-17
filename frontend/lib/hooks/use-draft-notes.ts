"use client";

import useSWR from "swr";
import { fetchDraftNote, saveDraftNoteAPI } from "../api";
import { useTeamContext } from "../contexts/team-context";

/**
 * Hook to manage the team's draft note using backend API.
 * Uses SWR for data fetching with optimistic updates.
 */
export function useDraftNotes() {
  const { teamId } = useTeamContext();

  const key = teamId ? `/api/draft/notes?team=${teamId}` : null;

  const { data, mutate } = useSWR(key, () => fetchDraftNote(), {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const content = data ?? "";

  const save = async (newContent: string) => {
    const previous = content;
    const trimmed = newContent.trim();

    // Optimistic update
    mutate(trimmed || "", false);

    try {
      await saveDraftNoteAPI(newContent);
      mutate();
    } catch (error) {
      console.error("Failed to save draft note:", error);
      // Revert on error
      mutate(previous);
    }
  };

  return { content, save };
}
