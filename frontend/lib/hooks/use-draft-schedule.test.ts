import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDraftSchedule } from "./use-draft-schedule";
import type { DraftScheduleData } from "../types";

// Mock team context
const mockTeamId = { current: 1 as number | null };
vi.mock("../contexts/team-context", () => ({
  useTeamContext: () => ({ teamId: mockTeamId.current }),
}));

// Mock fetchers
const mockFetchDraftSchedule = vi.fn();
const mockRefreshDraftSchedule = vi.fn();
vi.mock("../api", () => ({
  fetchDraftSchedule: (...args: unknown[]) => mockFetchDraftSchedule(...args),
  refreshDraftSchedule: (...args: unknown[]) => mockRefreshDraftSchedule(...args),
}));

const sampleSchedule: DraftScheduleData = {
  league_id: 1,
  draft_complete: false,
  last_scraped_at: "2026-02-26T10:00:00Z",
  picks: [
    { round: 1, pick_in_round: 1, team_id: 2, team_name: "Sluggers", from_team_name: null, scheduled_time: "2026-03-15T14:00:00-07:00" },
  ],
};

describe("useDraftSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamId.current = 1;
    mockFetchDraftSchedule.mockResolvedValue(sampleSchedule);
  });

  it("returns schedule data when teamId is set", async () => {
    const { result } = renderHook(() => useDraftSchedule());

    await waitFor(() => {
      expect(result.current.schedule).toBeDefined();
    });

    expect(result.current.schedule?.league_id).toBe(1);
    expect(result.current.schedule?.picks).toHaveLength(1);
    expect(mockFetchDraftSchedule).toHaveBeenCalled();
  });

  it("returns undefined schedule when no teamId", async () => {
    mockTeamId.current = null;
    const { result } = renderHook(() => useDraftSchedule());

    // SWR should not fetch when key is null
    expect(result.current.schedule).toBeUndefined();
    expect(mockFetchDraftSchedule).not.toHaveBeenCalled();
  });

  it("refresh calls POST endpoint and returns result", async () => {
    const refreshedSchedule = { ...sampleSchedule, last_scraped_at: "2026-02-26T11:00:00Z" };
    mockRefreshDraftSchedule.mockResolvedValue({ ...refreshedSchedule, cooldown_skipped: false });

    const { result } = renderHook(() => useDraftSchedule());

    await waitFor(() => {
      expect(result.current.schedule).toBeDefined();
    });

    const refreshResult = await result.current.refresh();

    expect(mockRefreshDraftSchedule).toHaveBeenCalledOnce();
    expect(refreshResult.cooldown_skipped).toBe(false);
  });
});
