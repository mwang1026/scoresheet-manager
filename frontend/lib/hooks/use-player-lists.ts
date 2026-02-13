"use client";

import { useState, useEffect } from "react";

const WATCHLIST_KEY = "scoresheet-watchlist";
const QUEUE_KEY = "scoresheet-queue";

/**
 * Custom hook to manage watchlist and draft queue using localStorage
 * SSR-safe: initializes from localStorage in useEffect
 */
export function usePlayerLists() {
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<Set<number>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    const loadedWatchlist = loadSet(WATCHLIST_KEY);
    const loadedQueue = loadSet(QUEUE_KEY);

    setWatchlist(loadedWatchlist);
    setQueue(loadedQueue);
    setIsHydrated(true);
  }, []);

  const toggleWatchlist = (playerId: number) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      saveSet(WATCHLIST_KEY, next);
      return next;
    });
  };

  const toggleQueue = (playerId: number) => {
    setQueue((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      saveSet(QUEUE_KEY, next);
      return next;
    });
  };

  const isWatchlisted = (playerId: number): boolean => {
    return watchlist.has(playerId);
  };

  const isInQueue = (playerId: number): boolean => {
    return queue.has(playerId);
  };

  return {
    watchlist,
    queue,
    toggleWatchlist,
    toggleQueue,
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
