import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayerLists } from "./use-player-lists";

describe("usePlayerLists", () => {
  // localStorage is cleared in vitest.setup.ts beforeEach
  beforeEach(() => {
    localStorage.clear();
  });

  describe("initialization", () => {
    it("initializes with default fixtures when localStorage is empty", () => {
      const { result } = renderHook(() => usePlayerLists());

      // Default watchlist: [4, 6, 11, 13, 18, 19, 20]
      expect(result.current.watchlist.size).toBe(7);
      expect(result.current.isWatchlisted(4)).toBe(true);
      expect(result.current.isWatchlisted(6)).toBe(true);
      expect(result.current.isWatchlisted(11)).toBe(true);
      expect(result.current.isWatchlisted(13)).toBe(true);
      expect(result.current.isWatchlisted(18)).toBe(true);
      expect(result.current.isWatchlisted(19)).toBe(true);
      expect(result.current.isWatchlisted(20)).toBe(true);

      // Default queue: [11, 18, 13, 6, 19] (ordered)
      expect(result.current.queue).toEqual([11, 18, 13, 6, 19]);
    });

    it("loads existing data from localStorage instead of defaults", () => {
      // Pre-populate localStorage with custom data
      localStorage.setItem("scoresheet-watchlist", JSON.stringify([1, 2, 3]));
      localStorage.setItem("scoresheet-queue", JSON.stringify([1, 2]));

      const { result } = renderHook(() => usePlayerLists());

      // Should use existing data, not defaults
      expect(result.current.watchlist.size).toBe(3);
      expect(result.current.isWatchlisted(1)).toBe(true);
      expect(result.current.isWatchlisted(2)).toBe(true);
      expect(result.current.isWatchlisted(3)).toBe(true);
      expect(result.current.queue).toEqual([1, 2]);
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("scoresheet-watchlist", "not-valid-json");
      localStorage.setItem("scoresheet-queue", "also-not-valid");

      const { result } = renderHook(() => usePlayerLists());

      // Should initialize with empty sets instead of crashing
      expect(result.current.watchlist.size).toBe(0);
      expect(result.current.queue.length).toBe(0);
    });
  });

  describe("watchlist methods", () => {
    it("addToWatchlist adds player to watchlist only", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToWatchlist(100);
      });

      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(false);
    });

    it("removeFromWatchlist removes from both watchlist and queue (coupling)", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100); // Adds to both queue and watchlist
      });

      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(true);

      act(() => {
        result.current.removeFromWatchlist(100);
      });

      // Should remove from both watchlist and queue
      expect(result.current.isWatchlisted(100)).toBe(false);
      expect(result.current.isInQueue(100)).toBe(false);
    });

    it("toggleWatchlist adds when not watchlisted", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.toggleWatchlist(100);
      });

      expect(result.current.isWatchlisted(100)).toBe(true);
    });

    it("toggleWatchlist removes from both watchlist and queue (coupling)", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100); // Adds to both
      });

      act(() => {
        result.current.toggleWatchlist(100); // Remove (toggle off)
      });

      // Should remove from both watchlist and queue
      expect(result.current.isWatchlisted(100)).toBe(false);
      expect(result.current.isInQueue(100)).toBe(false);
    });
  });

  describe("queue methods", () => {
    it("addToQueue adds to both queue and watchlist (coupling)", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100);
      });

      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(true);
      expect(result.current.queue).toContain(100);
    });

    it("addToQueue appends to end of queue", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(101);
        result.current.addToQueue(102);
        result.current.addToQueue(103);
      });

      // Should be in order added (after defaults)
      const queueWithoutDefaults = result.current.queue.filter(
        (id) => ![11, 18, 13, 6, 19].includes(id)
      );
      expect(queueWithoutDefaults).toEqual([101, 102, 103]);
    });

    it("removeFromQueue removes from queue only, not watchlist", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100);
      });

      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(true);

      act(() => {
        result.current.removeFromQueue(100);
      });

      // Should remove from queue but stay on watchlist
      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(false);
    });

    it("toggleQueue adds to both queue and watchlist when not in queue", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.toggleQueue(100);
      });

      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(true);
    });

    it("toggleQueue removes from queue only when in queue", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100);
      });

      act(() => {
        result.current.toggleQueue(100); // Toggle off
      });

      // Should remove from queue but stay on watchlist
      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(false);
    });

    it("getQueuePosition returns correct 1-based position", () => {
      const { result } = renderHook(() => usePlayerLists());

      // Default queue: [11, 18, 13, 6, 19]
      expect(result.current.getQueuePosition(11)).toBe(1);
      expect(result.current.getQueuePosition(18)).toBe(2);
      expect(result.current.getQueuePosition(13)).toBe(3);
      expect(result.current.getQueuePosition(6)).toBe(4);
      expect(result.current.getQueuePosition(19)).toBe(5);
    });

    it("getQueuePosition returns null for non-queued player", () => {
      const { result } = renderHook(() => usePlayerLists());

      expect(result.current.getQueuePosition(999)).toBeNull();
    });

    it("reorderQueue updates queue order", () => {
      const { result } = renderHook(() => usePlayerLists());

      const newOrder = [19, 6, 13, 18, 11]; // Reverse of default

      act(() => {
        result.current.reorderQueue(newOrder);
      });

      expect(result.current.queue).toEqual(newOrder);
      expect(result.current.getQueuePosition(19)).toBe(1);
      expect(result.current.getQueuePosition(11)).toBe(5);
    });
  });

  describe("localStorage persistence", () => {
    it("persists watchlist to localStorage", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToWatchlist(100);
        result.current.addToWatchlist(200);
      });

      const stored = localStorage.getItem("scoresheet-watchlist");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toContain(100);
      expect(parsed).toContain(200);
    });

    it("persists queue to localStorage as ordered array", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(101);
        result.current.addToQueue(102);
      });

      const stored = localStorage.getItem("scoresheet-queue");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed)).toBe(true);
      // Should include defaults + new additions in order
      expect(parsed).toContain(101);
      expect(parsed).toContain(102);
    });

    it("persists reordered queue to localStorage", () => {
      const { result } = renderHook(() => usePlayerLists());

      const newOrder = [19, 6, 13, 18, 11];

      act(() => {
        result.current.reorderQueue(newOrder);
      });

      const stored = localStorage.getItem("scoresheet-queue");
      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(newOrder);
    });
  });

  describe("coupling invariant: Queue ⊆ Watchlist", () => {
    it("maintains invariant when adding to queue", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100);
      });

      // Player should be in both
      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(true);
    });

    it("maintains invariant when removing from watchlist", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100);
        result.current.removeFromWatchlist(100);
      });

      // Player should be in neither
      expect(result.current.isWatchlisted(100)).toBe(false);
      expect(result.current.isInQueue(100)).toBe(false);
    });

    it("allows removing from queue while staying on watchlist", () => {
      const { result } = renderHook(() => usePlayerLists());

      act(() => {
        result.current.addToQueue(100);
        result.current.removeFromQueue(100);
      });

      // Player should be watchlisted but not in queue
      expect(result.current.isWatchlisted(100)).toBe(true);
      expect(result.current.isInQueue(100)).toBe(false);
    });
  });

  describe("isHydrated flag", () => {
    it("sets isHydrated to true after loading from localStorage", () => {
      const { result } = renderHook(() => usePlayerLists());

      expect(result.current.isHydrated).toBe(true);
    });
  });
});
