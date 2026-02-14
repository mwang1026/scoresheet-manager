"use client";

import { useState, useEffect } from "react";

const WATCHLIST_KEY = "scoresheet-watchlist";
const QUEUE_KEY = "scoresheet-queue";

/**
 * QUEUE-WATCHLIST COUPLING INVARIANT:
 * - Queue ⊆ Watchlist: Every queued player MUST be on the watchlist
 * - addToQueue(id) → auto-adds to watchlist
 * - removeFromWatchlist(id) → auto-removes from queue
 * - removeFromQueue(id) → queue only (does NOT remove from watchlist)
 * - toggleQueue/toggleWatchlist respect coupling rules
 *
 * DEFAULT FIXTURES (first visit):
 * - Watchlist: [4, 6, 11, 13, 18, 19, 20] (all unowned players from fixtures)
 * - Queue: [11, 18, 13, 6, 19] (Juan Soto, Ohtani P, Ohtani H, Torres, Clase)
 */

/**
 * Custom hook to manage watchlist and draft queue using localStorage
 * SSR-safe: initializes from localStorage in useEffect
 * Queue is an ordered array to support drag-and-drop reordering
 */
export function usePlayerLists() {
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<number[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    // Check if any data exists in localStorage
    const hasExistingData =
      localStorage.getItem(WATCHLIST_KEY) !== null ||
      localStorage.getItem(QUEUE_KEY) !== null;

    let loadedWatchlist: Set<number>;
    let loadedQueue: number[];

    if (hasExistingData) {
      // Use existing data
      loadedWatchlist = loadSet(WATCHLIST_KEY);
      loadedQueue = loadArray(QUEUE_KEY);
    } else {
      // First visit: use default fixtures
      loadedWatchlist = new Set([4, 6, 11, 13, 18, 19, 20]);
      loadedQueue = [11, 18, 13, 6, 19];
      // Save defaults to localStorage
      saveSet(WATCHLIST_KEY, loadedWatchlist);
      saveArray(QUEUE_KEY, loadedQueue);
    }

    setWatchlist(loadedWatchlist);
    setQueue(loadedQueue);
    setIsHydrated(true);
  }, []);

  /**
   * Add player to watchlist (watchlist-only, does NOT add to queue)
   */
  const addToWatchlist = (playerId: number) => {
    setWatchlist((prev) => {
      if (prev.has(playerId)) return prev; // Already watchlisted
      const next = new Set(prev);
      next.add(playerId);
      saveSet(WATCHLIST_KEY, next);
      return next;
    });
  };

  /**
   * Remove player from watchlist (also removes from queue due to coupling)
   */
  const removeFromWatchlist = (playerId: number) => {
    setWatchlist((prev) => {
      if (!prev.has(playerId)) return prev; // Not watchlisted
      const next = new Set(prev);
      next.delete(playerId);
      saveSet(WATCHLIST_KEY, next);
      return next;
    });

    // Coupling: also remove from queue
    setQueue((prev) => {
      const next = prev.filter((id) => id !== playerId);
      if (next.length !== prev.length) {
        saveArray(QUEUE_KEY, next);
        return next;
      }
      return prev;
    });
  };

  /**
   * Add player to queue (also adds to watchlist due to coupling)
   */
  const addToQueue = (playerId: number) => {
    // Coupling: ensure player is watchlisted
    setWatchlist((prev) => {
      if (prev.has(playerId)) return prev;
      const next = new Set(prev);
      next.add(playerId);
      saveSet(WATCHLIST_KEY, next);
      return next;
    });

    // Add to queue (append to end)
    setQueue((prev) => {
      if (prev.includes(playerId)) return prev; // Already in queue
      const next = [...prev, playerId];
      saveArray(QUEUE_KEY, next);
      return next;
    });
  };

  /**
   * Remove player from queue (queue-only, does NOT remove from watchlist)
   */
  const removeFromQueue = (playerId: number) => {
    setQueue((prev) => {
      const next = prev.filter((id) => id !== playerId);
      if (next.length !== prev.length) {
        saveArray(QUEUE_KEY, next);
        return next;
      }
      return prev;
    });
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
  const reorderQueue = (newOrder: number[]) => {
    setQueue(newOrder);
    saveArray(QUEUE_KEY, newOrder);
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

// Helper functions
function loadSet(key: string): Set<number> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return new Set();

    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<number>): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
  }
}

function loadArray(key: string): number[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray(key: string, array: number[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(key, JSON.stringify(array));
  } catch {
    // Ignore localStorage errors (quota exceeded, etc.)
  }
}
