"use client";

import useSWR from "swr";
import { fetchLatestNews, fetchNewsFlags, fetchPlayerNews } from "../api";
import type { DashboardNewsItem, PlayerNewsItem } from "../types";

/**
 * Hook to fetch player IDs with recent news (for table icons).
 * Returns a Set for O(1) lookups.
 */
export function useNewsFlags(days: number = 7) {
  const { data } = useSWR<number[]>(
    `news-flags-${days}`,
    () => fetchNewsFlags(days),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min
    }
  );

  const newsPlayerIds = new Set(data || []);

  return { newsPlayerIds };
}

/**
 * Hook to fetch latest news items (dashboard widget + /news page).
 */
export function useLatestNews(limit: number = 50) {
  const { data, isLoading, error } = useSWR<DashboardNewsItem[]>(
    `latest-news-${limit}`,
    () => fetchLatestNews(limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min
    }
  );

  return {
    news: data || [],
    isLoading,
    error,
  };
}

/**
 * Hook to fetch news for a specific player (tooltip + detail page).
 * Pass null playerId to skip the fetch.
 */
export function usePlayerNews(playerId: number | null, limit: number = 20) {
  const key = playerId !== null ? `player-news-${playerId}-${limit}` : null;

  const { data, isLoading, error } = useSWR<PlayerNewsItem[]>(
    key,
    () => fetchPlayerNews(playerId!, limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 min
    }
  );

  return {
    news: data || [],
    isLoading,
    error,
  };
}
