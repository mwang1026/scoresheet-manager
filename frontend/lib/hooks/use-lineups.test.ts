import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement } from "react";
import { useTeamLineups } from "./use-lineups";
import { fetchLineups, refreshLineups } from "../api";
import type { LineupsData } from "../types";

let mockTeamId: number | null = 1;

vi.mock("../contexts/team-context", () => ({
  useTeamContext: () => ({
    teamId: mockTeamId,
    currentTeam: mockTeamId ? { id: mockTeamId, league_id: 7 } : null,
  }),
}));

const data: LineupsData = {
  league_id: 7,
  week_end: "2026-09-20",
  teams: [
    { team_id: 1, games: 6, unknown_hand_games: 0, vs_rhp: [], vs_lhp: null, rotation: [], relievers: [] },
    { team_id: 2, games: 6, unknown_hand_games: 1, vs_rhp: [], vs_lhp: null, rotation: [], relievers: [] },
  ],
};

vi.mock("../api", () => ({
  fetchLineups: vi.fn(() => Promise.resolve(data)),
  refreshLineups: vi.fn(() => Promise.resolve()),
}));

const swrWrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

describe("useTeamLineups", () => {
  beforeEach(() => {
    mockTeamId = 1;
    vi.mocked(fetchLineups).mockClear();
    vi.mocked(refreshLineups).mockClear();
  });

  it("does not fetch without a team", () => {
    mockTeamId = null;
    const { result } = renderHook(() => useTeamLineups(), { wrapper: swrWrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lineupsByTeam.size).toBe(0);
    expect(fetchLineups).not.toHaveBeenCalled();
  });

  it("fetches and indexes lineups by team", async () => {
    const { result } = renderHook(() => useTeamLineups(), { wrapper: swrWrapper });
    await waitFor(() => expect(result.current.lineups).toBeDefined());
    expect(result.current.weekEnd).toBe("2026-09-20");
    expect(result.current.lineupsByTeam.get(2)?.unknown_hand_games).toBe(1);
    expect(fetchLineups).toHaveBeenCalledTimes(1);
  });

  it("refresh triggers the backend scrape for the current league and revalidates", async () => {
    const { result } = renderHook(() => useTeamLineups(), { wrapper: swrWrapper });
    await waitFor(() => expect(result.current.lineups).toBeDefined());
    await act(async () => {
      await result.current.refresh();
    });
    expect(refreshLineups).toHaveBeenCalledWith(7);
    expect(fetchLineups).toHaveBeenCalledTimes(2);
  });
});
