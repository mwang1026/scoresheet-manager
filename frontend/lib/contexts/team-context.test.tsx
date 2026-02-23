import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SWRConfig } from "swr";
import { TeamProvider, useTeamContext } from "./team-context";

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
});
