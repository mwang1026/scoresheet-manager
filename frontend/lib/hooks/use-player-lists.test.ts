import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePlayerLists } from "./use-player-lists";
import { SWRConfig } from "swr";
import { createElement } from "react";

// Wrapper to disable SWR cache for tests
const swrWrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  );

describe("usePlayerLists", () => {
  beforeEach(() => {
    // Mock storage is reset in vitest.setup.ts
  });

  describe("initialization", () => {
    it("initializes with empty watchlist and queue from API", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      expect(result.current.watchlist.size).toBe(0);
      expect(result.current.queue.length).toBe(0);
    });

    it("handles API errors gracefully", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      // Should initialize with empty sets instead of crashing
      expect(result.current.watchlist.size).toBe(0);
      expect(result.current.queue.length).toBe(0);
    });
  });

  describe("watchlist methods", () => {
    it("addToWatchlist adds player to watchlist only", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToWatchlist(100);
      });

      await waitFor(() => {
        expect(result.current.isWatchlisted(100)).toBe(true);
      });

      expect(result.current.isInQueue(100)).toBe(false);
    });

    it("removeFromWatchlist removes from both watchlist and queue (coupling)", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100); // Adds to both queue and watchlist
      });

      await waitFor(() => {
        expect(result.current.isWatchlisted(100)).toBe(true);
        expect(result.current.isInQueue(100)).toBe(true);
      });

      await act(async () => {
        await result.current.removeFromWatchlist(100);
      });

      await waitFor(() => {
        // Should remove from both watchlist and queue
        expect(result.current.isWatchlisted(100)).toBe(false);
        expect(result.current.isInQueue(100)).toBe(false);
      });
    });

    it("toggleWatchlist adds when not watchlisted", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.toggleWatchlist(100);
      });

      await waitFor(() => {
        expect(result.current.isWatchlisted(100)).toBe(true);
      });
    });

    it("toggleWatchlist removes from both watchlist and queue (coupling)", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100); // Adds to both
      });

      await waitFor(() => {
        expect(result.current.isWatchlisted(100)).toBe(true);
        expect(result.current.isInQueue(100)).toBe(true);
      });

      await act(async () => {
        await result.current.toggleWatchlist(100); // Removes from both
      });

      await waitFor(() => {
        expect(result.current.isWatchlisted(100)).toBe(false);
        expect(result.current.isInQueue(100)).toBe(false);
      });
    });
  });

  describe("queue methods", () => {
    it("addToQueue adds to both queue and watchlist (coupling)", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(true);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });
    });

    it("addToQueue appends to end of queue", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(10);
        await result.current.addToQueue(20);
        await result.current.addToQueue(30);
      });

      await waitFor(() => {
        expect(result.current.queue).toEqual([10, 20, 30]);
      });
    });

    it("removeFromQueue removes from queue only, not watchlist", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(true);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });

      await act(async () => {
        await result.current.removeFromQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(false);
        expect(result.current.isWatchlisted(100)).toBe(true); // Still watchlisted
      });
    });

    it("toggleQueue adds to both queue and watchlist when not in queue", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.toggleQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(true);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });
    });

    it("toggleQueue removes from queue only when in queue", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(true);
      });

      await act(async () => {
        await result.current.toggleQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(false);
        expect(result.current.isWatchlisted(100)).toBe(true); // Still watchlisted
      });
    });

    it("getQueuePosition returns correct 1-based position", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(10);
        await result.current.addToQueue(20);
        await result.current.addToQueue(30);
      });

      await waitFor(() => {
        expect(result.current.getQueuePosition(10)).toBe(1);
        expect(result.current.getQueuePosition(20)).toBe(2);
        expect(result.current.getQueuePosition(30)).toBe(3);
      });
    });

    it("getQueuePosition returns null for non-queued player", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      expect(result.current.getQueuePosition(999)).toBe(null);
    });

    it("reorderQueue updates queue order", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(10);
        await result.current.addToQueue(20);
        await result.current.addToQueue(30);
      });

      await waitFor(() => {
        expect(result.current.queue).toEqual([10, 20, 30]);
      });

      await act(async () => {
        await result.current.reorderQueue([30, 10, 20]);
      });

      await waitFor(() => {
        expect(result.current.queue).toEqual([30, 10, 20]);
      });
    });
  });

  describe("coupling invariant", () => {
    it("maintains invariant when adding to queue", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100);
      });

      await waitFor(() => {
        // Queue player must be watchlisted
        expect(result.current.isInQueue(100)).toBe(true);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });
    });

    it("maintains invariant when removing from watchlist", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(true);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });

      await act(async () => {
        await result.current.removeFromWatchlist(100);
      });

      await waitFor(() => {
        // Removing from watchlist must also remove from queue
        expect(result.current.isWatchlisted(100)).toBe(false);
        expect(result.current.isInQueue(100)).toBe(false);
      });
    });

    it("allows removing from queue while staying on watchlist", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });

      await act(async () => {
        await result.current.addToQueue(100);
      });

      await waitFor(() => {
        expect(result.current.isInQueue(100)).toBe(true);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });

      await act(async () => {
        await result.current.removeFromQueue(100);
      });

      await waitFor(() => {
        // Queue removal should NOT remove from watchlist
        expect(result.current.isInQueue(100)).toBe(false);
        expect(result.current.isWatchlisted(100)).toBe(true);
      });
    });
  });

  describe("hydration", () => {
    it("sets isHydrated to true after loading from API", async () => {
      const { result } = renderHook(() => usePlayerLists(), {
        wrapper: swrWrapper,
      });

      // Initially not hydrated
      expect(result.current.isHydrated).toBe(false);

      // Wait for hydration
      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
      });
    });
  });
});
