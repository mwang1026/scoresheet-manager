import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayerLists } from "./use-player-lists";

describe("usePlayerLists", () => {
  // localStorage is cleared in vitest.setup.ts beforeEach

  it("initializes with empty sets", () => {
    const { result } = renderHook(() => usePlayerLists());

    // Wait for hydration
    act(() => {
      // Trigger useEffect
    });

    expect(result.current.watchlist.size).toBe(0);
    expect(result.current.queue.size).toBe(0);
  });

  it("toggles watchlist - adds player", () => {
    const { result } = renderHook(() => usePlayerLists());

    act(() => {
      result.current.toggleWatchlist(1);
    });

    expect(result.current.isWatchlisted(1)).toBe(true);
    expect(result.current.watchlist.has(1)).toBe(true);
  });

  it("toggles watchlist - removes player", () => {
    const { result } = renderHook(() => usePlayerLists());

    act(() => {
      result.current.toggleWatchlist(1);
    });

    expect(result.current.isWatchlisted(1)).toBe(true);

    act(() => {
      result.current.toggleWatchlist(1);
    });

    expect(result.current.isWatchlisted(1)).toBe(false);
    expect(result.current.watchlist.has(1)).toBe(false);
  });

  it("toggles queue - adds player", () => {
    const { result } = renderHook(() => usePlayerLists());

    act(() => {
      result.current.toggleQueue(2);
    });

    expect(result.current.isInQueue(2)).toBe(true);
    expect(result.current.queue.has(2)).toBe(true);
  });

  it("toggles queue - removes player", () => {
    const { result } = renderHook(() => usePlayerLists());

    act(() => {
      result.current.toggleQueue(2);
    });

    expect(result.current.isInQueue(2)).toBe(true);

    act(() => {
      result.current.toggleQueue(2);
    });

    expect(result.current.isInQueue(2)).toBe(false);
    expect(result.current.queue.has(2)).toBe(false);
  });

  it("persists watchlist to localStorage", () => {
    const { result } = renderHook(() => usePlayerLists());

    act(() => {
      result.current.toggleWatchlist(1);
      result.current.toggleWatchlist(2);
    });

    const stored = localStorage.getItem("scoresheet-watchlist");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed).toContain(1);
    expect(parsed).toContain(2);
  });

  it("persists queue to localStorage", () => {
    const { result } = renderHook(() => usePlayerLists());

    act(() => {
      result.current.toggleQueue(3);
      result.current.toggleQueue(4);
    });

    const stored = localStorage.getItem("scoresheet-queue");
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed).toContain(3);
    expect(parsed).toContain(4);
  });

  it("loads initial state from localStorage on mount", () => {
    // Pre-populate localStorage
    localStorage.setItem("scoresheet-watchlist", JSON.stringify([10, 20]));
    localStorage.setItem("scoresheet-queue", JSON.stringify([30, 40]));

    const { result } = renderHook(() => usePlayerLists());

    // Wait for hydration useEffect
    expect(result.current.isHydrated).toBe(true);

    expect(result.current.isWatchlisted(10)).toBe(true);
    expect(result.current.isWatchlisted(20)).toBe(true);
    expect(result.current.isInQueue(30)).toBe(true);
    expect(result.current.isInQueue(40)).toBe(true);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("scoresheet-watchlist", "not-valid-json");

    const { result } = renderHook(() => usePlayerLists());

    // Should initialize with empty set instead of crashing
    expect(result.current.watchlist.size).toBe(0);
  });
});
