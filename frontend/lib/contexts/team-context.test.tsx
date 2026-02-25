import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { TeamProvider, useTeamContext } from "./team-context";
import { setApiTeamId } from "@/lib/api";

// Mock @/lib/api so we can spy on setApiTeamId while keeping fetchMyTeams real
// (real fetchMyTeams still makes fetch calls intercepted by vitest.setup.ts global mock)
vi.mock("@/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...mod,
    setApiTeamId: vi.fn(),
  };
});

// Global fetch mock (vitest.setup.ts) handles /api/teams returning:
// [{ id: 1, name: "My Team", is_my_team: true }, { id: 2, name: "Other Team", is_my_team: false }]

// Wrapper: fresh SWR cache per test + TeamProvider
const makeWrapper = () =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      createElement(TeamProvider, null, children)
    );

describe("TeamProvider", () => {
  it("initializes with isLoading: true before teams load", () => {
    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });
    // Before teams resolve, isLoading is true
    expect(result.current.isLoading).toBe(true);
  });

  it("fetches teams and sets initial team from is_my_team flag", async () => {
    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentTeam).not.toBeNull();
    });

    expect(result.current.currentTeam?.name).toBe("My Team");
    expect(result.current.teamId).toBe(1);
  });

  it("restores team ID from localStorage", async () => {
    localStorage.setItem("scoresheet-team-id", "2");

    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentTeam).not.toBeNull();
    });

    expect(result.current.teamId).toBe(2);
    expect(result.current.currentTeam?.name).toBe("Other Team");
  });

  it("persists team ID to localStorage on setTeamId()", async () => {
    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setTeamId(2);
    });

    expect(localStorage.getItem("scoresheet-team-id")).toBe("2");
    expect(result.current.teamId).toBe(2);
  });

  it("falls back to is_my_team team when localStorage has stale/invalid team ID", async () => {
    localStorage.setItem("scoresheet-team-id", "999");

    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      // Should fall back to is_my_team (id=1) since 999 is not in teams
      expect(result.current.currentTeam?.id).toBe(1);
    });

    expect(localStorage.getItem("scoresheet-team-id")).toBe("1");
  });

  it("revalidating me/teams after adding a team updates the teams list", async () => {
    // First fetch returns 1 team
    vi.mocked(global.fetch).mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        teams: [
          {
            id: 1,
            name: "My Team",
            scoresheet_id: 1,
            league_id: 1,
            league_name: "Alpha League",
            league_season: 2025,
            role: "owner",
          },
        ],
      }),
    } as Response));

    const { result } = renderHook(
      () => {
        const ctx = useTeamContext();
        const { mutate } = useSWRConfig();
        return { ...ctx, mutate };
      },
      { wrapper: makeWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.teams.length).toBe(1);
    });

    // After adding a team, the UI calls mutate("me/teams") → refetch returns 2 teams
    // (default global mock returns 2 teams now that the once-implementation is consumed)
    await act(async () => {
      await result.current.mutate("me/teams");
    });

    await waitFor(() => {
      expect(result.current.teams.length).toBe(2);
    });
  });

  it("falls back to first remaining team when selected team is deleted", async () => {
    // localStorage has team ID 2 — the team that will be "deleted"
    localStorage.setItem("scoresheet-team-id", "2");

    // API returns only team 1 (team 2 deleted)
    vi.mocked(global.fetch).mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        teams: [
          {
            id: 1,
            name: "My Team",
            scoresheet_id: 1,
            league_id: 1,
            league_name: "Alpha League",
            league_season: 2025,
            role: "owner",
          },
        ],
      }),
    } as Response));

    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      // team 2 is gone → fallback to team 1
      expect(result.current.currentTeam?.id).toBe(1);
    });

    // localStorage is updated to the fallback team
    expect(localStorage.getItem("scoresheet-team-id")).toBe("1");
  });

  it("calls setApiTeamId synchronously on mount when localStorage has a team", () => {
    localStorage.setItem("scoresheet-team-id", "5");

    // Render the hook — the useState initializer runs synchronously during this call
    renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    // setApiTeamId must have been called synchronously during the useState initializer,
    // before any effects or promises resolve
    expect(vi.mocked(setApiTeamId)).toHaveBeenCalledWith(5);
  });

  it("calls setApiTeamId synchronously when setTeamId is called", async () => {
    const { result } = renderHook(() => useTeamContext(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(setApiTeamId).mockClear();

    // Assert INSIDE act() callback — before React flushes effects.
    // This verifies the call is synchronous (in the same stack frame as setTeamId),
    // not deferred to the useEffect that runs after render commit.
    act(() => {
      result.current.setTeamId(2); // team id=2 exists in mock → no fallback effect
      expect(vi.mocked(setApiTeamId)).toHaveBeenCalledWith(2);
      expect(vi.mocked(setApiTeamId)).toHaveBeenCalledTimes(1);
    });
  });
});
