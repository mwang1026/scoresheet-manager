"use client";

import useSWR from "swr";
import {
  fetchWatchlist,
  fetchDraftQueue,
  addToWatchlistAPI,
  removeFromWatchlistAPI,
  addToQueueAPI,
  removeFromQueueAPI,
  reorderQueueAPI,
} from "../api";
import { useTeamContext } from "../contexts/team-context";

/**
 * QUEUE-WATCHLIST COUPLING INVARIANT:
 * - Queue ⊆ Watchlist: Every queued player MUST be on the watchlist
 * - addToQueue(id) → auto-adds to watchlist (handled by backend)
 * - removeFromWatchlist(id) → auto-removes from queue (handled by backend)
 * - removeFromQueue(id) → queue only (does NOT remove from watchlist)
 * - toggleQueue/toggleWatchlist respect coupling rules
 */

/**
 * Custom hook to manage watchlist and draft queue using backend API
 * Uses SWR for data fetching and optimistic updates
 */
export function usePlayerLists() {
  const { teamId } = useTeamContext();

  // Null key when teamId not yet set prevents premature fetching
  const watchlistKey = teamId ? `/api/watchlist?team=${teamId}` : null;
  const queueKey = teamId ? `/api/draft-queue?team=${teamId}` : null;

  // Fetch watchlist and queue from API
  const {
    data: watchlistData,
    mutate: mutateWatchlist,
    isLoading: watchlistLoading,
  } = useSWR(watchlistKey, fetchWatchlist);

  const {
    data: queueData,
    mutate: mutateQueue,
    isLoading: queueLoading,
  } = useSWR(queueKey, fetchDraftQueue);

  // Convert to expected formats
  const watchlist = new Set(watchlistData || []);
  const queue = queueData || [];
  const isHydrated = !watchlistLoading && !queueLoading;

  /**
   * Add player to watchlist (watchlist-only, does NOT add to queue)
   */
  const addToWatchlist = async (playerId: number) => {
    const current = watchlistData || [];

    // Optimistic update
    if (!current.includes(playerId)) {
      mutateWatchlist([...current, playerId], false);
    }

    try {
      const updated = await addToWatchlistAPI(playerId);
      mutateWatchlist(updated);
    } catch (error) {
      console.error("Failed to add to watchlist:", error);
      // Revert on error
      mutateWatchlist(current);
    }
  };

  /**
   * Remove player from watchlist (also removes from queue due to coupling)
   */
  const removeFromWatchlist = async (playerId: number) => {
    const currentWatchlist = watchlistData || [];
    const currentQueue = queueData || [];

    // Optimistic update for both watchlist and queue
    mutateWatchlist(currentWatchlist.filter((id) => id !== playerId), false);
    mutateQueue(currentQueue.filter((id) => id !== playerId), false);

    try {
      const updatedWatchlist = await removeFromWatchlistAPI(playerId);
      mutateWatchlist(updatedWatchlist);
      // Backend removes from queue automatically, so refetch queue
      mutateQueue();
    } catch (error) {
      console.error("Failed to remove from watchlist:", error);
      // Revert on error
      mutateWatchlist(currentWatchlist);
      mutateQueue(currentQueue);
    }
  };

  /**
   * Add player to queue (also adds to watchlist due to coupling)
   */
  const addToQueue = async (playerId: number) => {
    const currentQueue = queueData || [];
    const currentWatchlist = watchlistData || [];

    // Optimistic update for both queue and watchlist
    if (!currentQueue.includes(playerId)) {
      mutateQueue([...currentQueue, playerId], false);
    }
    if (!currentWatchlist.includes(playerId)) {
      mutateWatchlist([...currentWatchlist, playerId], false);
    }

    try {
      const updatedQueue = await addToQueueAPI(playerId);
      mutateQueue(updatedQueue);
      // Backend adds to watchlist automatically, so refetch watchlist
      mutateWatchlist();
    } catch (error) {
      console.error("Failed to add to queue:", error);
      // Revert on error
      mutateQueue(currentQueue);
      mutateWatchlist(currentWatchlist);
    }
  };

  /**
   * Remove player from queue (queue-only, does NOT remove from watchlist)
   */
  const removeFromQueue = async (playerId: number) => {
    const current = queueData || [];

    // Optimistic update
    mutateQueue(current.filter((id) => id !== playerId), false);

    try {
      const updated = await removeFromQueueAPI(playerId);
      mutateQueue(updated);
    } catch (error) {
      console.error("Failed to remove from queue:", error);
      // Revert on error
      mutateQueue(current);
    }
  };

  /**
   * Toggle watchlist (respects coupling: removing also removes from queue)
   */
  const toggleWatchlist = (playerId: number) => {
    if (watchlist.has(playerId)) {
      removeFromWatchlist(playerId); // Removes from both watchlist and queue
    } else {
      addToWatchlist(playerId); // Adds to watchlist only
    }
  };

  /**
   * Toggle queue (respects coupling: adding also adds to watchlist)
   */
  const toggleQueue = (playerId: number) => {
    if (queue.includes(playerId)) {
      removeFromQueue(playerId); // Removes from queue only
    } else {
      addToQueue(playerId); // Adds to both queue and watchlist
    }
  };

  /**
   * Get 1-based queue position for a player (null if not in queue)
   */
  const getQueuePosition = (playerId: number): number | null => {
    const index = queue.indexOf(playerId);
    return index >= 0 ? index + 1 : null;
  };

  /**
   * Reorder the queue (for drag-and-drop)
   */
  const reorderQueue = async (newOrder: number[]) => {
    const current = queueData || [];

    // Optimistic update
    mutateQueue(newOrder, false);

    try {
      const updated = await reorderQueueAPI(newOrder);
      mutateQueue(updated);
    } catch (error) {
      console.error("Failed to reorder queue:", error);
      // Revert on error
      mutateQueue(current);
    }
  };

  const isWatchlisted = (playerId: number): boolean => {
    return watchlist.has(playerId);
  };

  const isInQueue = (playerId: number): boolean => {
    return queue.includes(playerId);
  };

  return {
    watchlist,
    queue,
    toggleWatchlist,
    toggleQueue,
    addToWatchlist,
    removeFromWatchlist,
    addToQueue,
    removeFromQueue,
    getQueuePosition,
    reorderQueue,
    isWatchlisted,
    isInQueue,
    isHydrated,
  };
}
