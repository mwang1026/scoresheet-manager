import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock fetchers
vi.mock("../api", () => ({
  fetchLatestNews: vi.fn().mockResolvedValue([
    { id: 1, player_id: 1, headline: "Test", url: "https://x.com/1", published_at: "2026-02-25T00:00:00Z", raw_player_name: "P1", source: "RW" },
  ]),
  fetchNewsFlags: vi.fn().mockResolvedValue([1, 2, 3]),
  fetchPlayerNews: vi.fn().mockResolvedValue([
    { id: 1, player_id: 1, source: "RW", headline: "Test", url: "https://x.com/1", published_at: "2026-02-25T00:00:00Z", body: "Body", raw_player_name: "P1", match_method: "exact" },
  ]),
}));

// Mock SWR to call fetcher immediately
vi.mock("swr", () => ({
  default: (_key: string | null, fetcher: () => Promise<unknown>) => {
    if (_key === null) {
      return { data: undefined, isLoading: false, error: null };
    }
    // For testing, just return mock data directly
    const mockResults: Record<string, unknown> = {
      "news-flags-7": [1, 2, 3],
      "latest-news-50": [{ id: 1, player_id: 1, headline: "Test", url: "https://x.com/1", published_at: "2026-02-25T00:00:00Z", raw_player_name: "P1", source: "RW" }],
      "player-news-1-20": [{ id: 1, player_id: 1, source: "RW", headline: "Test", url: "https://x.com/1", published_at: "2026-02-25T00:00:00Z", body: "Body", raw_player_name: "P1", match_method: "exact" }],
    };
    return {
      data: mockResults[_key as string],
      isLoading: false,
      error: null,
    };
  },
}));

import { useNewsFlags, useLatestNews, usePlayerNews } from "./use-news-data";

describe("useNewsFlags", () => {
  it("returns a Set of player IDs", () => {
    const { result } = renderHook(() => useNewsFlags());
    expect(result.current.newsPlayerIds).toBeInstanceOf(Set);
    expect(result.current.newsPlayerIds.has(1)).toBe(true);
    expect(result.current.newsPlayerIds.has(2)).toBe(true);
    expect(result.current.newsPlayerIds.has(3)).toBe(true);
  });
});

describe("useLatestNews", () => {
  it("returns news array", () => {
    const { result } = renderHook(() => useLatestNews(50));
    expect(result.current.news).toHaveLength(1);
    expect(result.current.news[0].headline).toBe("Test");
    expect(result.current.isLoading).toBe(false);
  });
});

describe("usePlayerNews", () => {
  it("returns news for a player", () => {
    const { result } = renderHook(() => usePlayerNews(1, 20));
    expect(result.current.news).toHaveLength(1);
    expect(result.current.news[0].body).toBe("Body");
  });

  it("skips fetch when playerId is null", () => {
    const { result } = renderHook(() => usePlayerNews(null));
    expect(result.current.news).toHaveLength(0);
  });
});
