"use client";

import useSWR from "swr";
import {
  fetchCustomPositions,
  addCustomPositionAPI,
  removeCustomPositionAPI,
} from "../api";
import { useTeamContext } from "../contexts/team-context";
type CustomPositionsMap = Record<number, string[]>;

/**
 * Hook to manage custom (OOP) positions per team.
 * Uses SWR for data fetching with optimistic updates.
 */
export function useCustomPositions() {
  const { teamId } = useTeamContext();

  const key = teamId ? `/api/custom-positions?team=${teamId}` : null;

  const { data, mutate } = useSWR(key, () => fetchCustomPositions(), {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const customPositions: CustomPositionsMap = data || {};

  const getPlayerCustomPositions = (playerId: number): string[] => {
    return customPositions[playerId] || [];
  };

  const addCustomPosition = async (playerId: number, position: string) => {
    const current = { ...customPositions };

    // Optimistic update
    const optimistic = { ...current };
    optimistic[playerId] = [...(optimistic[playerId] || []), position];
    mutate(optimistic, false);

    try {
      const updated = await addCustomPositionAPI(playerId, position);
      mutate(updated);
    } catch (error) {
      // Revert on error
      mutate(current);
      throw error;
    }
  };

  const removeCustomPosition = async (playerId: number, position: string) => {
    const current = { ...customPositions };

    // Optimistic update
    const optimistic = { ...current };
    optimistic[playerId] = (optimistic[playerId] || []).filter(
      (p) => p !== position
    );
    if (optimistic[playerId].length === 0) {
      delete optimistic[playerId];
    }
    mutate(optimistic, false);

    try {
      const updated = await removeCustomPositionAPI(playerId, position);
      mutate(updated);
    } catch (error) {
      // Revert on error
      mutate(current);
      throw error;
    }
  };

  return {
    customPositions,
    getPlayerCustomPositions,
    addCustomPosition,
    removeCustomPosition,
  };
}
