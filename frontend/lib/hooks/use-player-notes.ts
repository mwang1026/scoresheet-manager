"use client";

import useSWR from "swr";
import { fetchTeamNotes, upsertNoteAPI } from "../api";
import { useTeamContext } from "../contexts/team-context";

/**
 * Hook to manage per-player notes using backend API.
 * Uses SWR for data fetching with optimistic updates.
 */
export function usePlayerNotes() {
  const { teamId } = useTeamContext();

  const notesKey = teamId ? `/api/notes?team=${teamId}` : null;

  const { data: notesData, mutate: mutateNotes } = useSWR(
    notesKey,
    () => fetchTeamNotes(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const notes = notesData || {};

  const getNote = (playerId: number): string => {
    return notes[playerId] || "";
  };

  const hasNote = (playerId: number): boolean => {
    return !!notes[playerId];
  };

  const saveNote = async (playerId: number, content: string) => {
    const current = { ...notes };
    const trimmed = content.trim();

    // Optimistic update
    const optimistic = { ...current };
    if (trimmed) {
      optimistic[playerId] = trimmed;
    } else {
      delete optimistic[playerId];
    }
    mutateNotes(optimistic, false);

    try {
      await upsertNoteAPI(playerId, content);
      mutateNotes();
    } catch (error) {
      console.error("Failed to save note:", error);
      // Revert on error
      mutateNotes(current);
    }
  };

  return { getNote, hasNote, saveNote };
}
