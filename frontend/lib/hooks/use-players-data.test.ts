import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlayers, useTeams } from "./use-players-data";
import { SWRConfig } from "swr";
import { createElement } from "react";
import { fetchPlayers, fetchTeams } from "../api";

// Control teamId via module-level variable so individual tests can override it
let mockTeamId: number | null = 1;

vi.mock("../contexts/team-context", () => ({
  useTeamContext: () => ({ teamId: mockTeamId }),
}));

// Mock the API fetchers to avoid real network calls
vi.mock("../api", () => ({
  fetchPlayers: vi.fn(() => Promise.resolve([])),
  fetchTeams: vi.fn(() => Promise.resolve([])),
  fetchHitterStats: vi.fn(() => Promise.resolve([])),
  fetchPitcherStats: vi.fn(() => Promise.resolve([])),
  fetchProjections: vi.fn(() => Promise.resolve([])),
  setApiTeamId: vi.fn(),
}));

// Fresh SWR cache per test — prevents cross-test cache pollution
const swrWrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  );

describe("usePlayers SWR key isolation", () => {
  beforeEach(() => {
    mockTeamId = 1;
    vi.mocked(fetchPlayers).mockClear();
  });

  it("does not fetch when teamId is null", () => {
    mockTeamId = null;

    const { result } = renderHook(() => usePlayers(), { wrapper: swrWrapper });

    // Null SWR key → no loading, no data, fetch never called
    expect(result.current.isLoading).toBe(false);
    expect(result.current.players).toBeUndefined();
    expect(vi.mocked(fetchPlayers)).not.toHaveBeenCalled();
  });

  it("fetches when teamId is set", async () => {
    mockTeamId = 1;

    const { result } = renderHook(() => usePlayers(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(vi.mocked(fetchPlayers)).toHaveBeenCalled();
  });

  it("refetches when teamId changes from 1 to 2", async () => {
    mockTeamId = 1;

    const { result, rerender } = renderHook(() => usePlayers(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callsAfterFirstLoad = vi.mocked(fetchPlayers).mock.calls.length;
    expect(callsAfterFirstLoad).toBeGreaterThan(0);

    // Switch teamId — new SWR key → SWR triggers a new fetch
    mockTeamId = 2;
    rerender();

    await waitFor(() => {
      expect(vi.mocked(fetchPlayers).mock.calls.length).toBeGreaterThan(callsAfterFirstLoad);
    });
  });

  it("passes teamId from SWR key tuple to fetchPlayers", async () => {
    mockTeamId = 42;

    const { result } = renderHook(() => usePlayers(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // fetchPlayers must be called with the exact teamId — not undefined or stale value
    expect(vi.mocked(fetchPlayers)).toHaveBeenCalledWith(42);
  });

  it("passes updated teamId when team switches", async () => {
    mockTeamId = 1;
    const { result, rerender } = renderHook(() => usePlayers(), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(fetchPlayers).mockClear();

    mockTeamId = 25;
    rerender();

    await waitFor(() => {
      expect(vi.mocked(fetchPlayers)).toHaveBeenCalledWith(25);
    });
  });
});

describe("useTeams SWR key isolation", () => {
  beforeEach(() => {
    mockTeamId = 1;
    vi.mocked(fetchTeams).mockClear();
  });

  it("does not fetch when teamId is null", () => {
    mockTeamId = null;

    const { result } = renderHook(() => useTeams(), { wrapper: swrWrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.teams).toBeUndefined();
    expect(vi.mocked(fetchTeams)).not.toHaveBeenCalled();
  });

  it("fetches when teamId is set", async () => {
    mockTeamId = 1;

    const { result } = renderHook(() => useTeams(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(vi.mocked(fetchTeams)).toHaveBeenCalled();
  });

  it("refetches when teamId changes from 1 to 2", async () => {
    mockTeamId = 1;

    const { result, rerender } = renderHook(() => useTeams(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const callsAfterFirstLoad = vi.mocked(fetchTeams).mock.calls.length;
    expect(callsAfterFirstLoad).toBeGreaterThan(0);

    // Switch teamId — new SWR key → SWR triggers a new fetch
    mockTeamId = 2;
    rerender();

    await waitFor(() => {
      expect(vi.mocked(fetchTeams).mock.calls.length).toBeGreaterThan(callsAfterFirstLoad);
    });
  });

  it("passes teamId from SWR key tuple to fetchTeams", async () => {
    mockTeamId = 7;

    const { result } = renderHook(() => useTeams(), { wrapper: swrWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(vi.mocked(fetchTeams)).toHaveBeenCalledWith(7);
  });
});
