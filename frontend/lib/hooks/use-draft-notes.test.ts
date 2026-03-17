import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDraftNotes } from "./use-draft-notes";

// Mock team context
const mockTeamId = { current: 1 as number | null };
vi.mock("../contexts/team-context", () => ({
  useTeamContext: () => ({ teamId: mockTeamId.current }),
}));

// Mock fetchers
const mockFetchDraftNote = vi.fn();
const mockSaveDraftNoteAPI = vi.fn();
vi.mock("../api", () => ({
  fetchDraftNote: (...args: unknown[]) => mockFetchDraftNote(...args),
  saveDraftNoteAPI: (...args: unknown[]) => mockSaveDraftNoteAPI(...args),
}));

describe("useDraftNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamId.current = 1;
    mockFetchDraftNote.mockResolvedValue("My draft strategy");
    mockSaveDraftNoteAPI.mockResolvedValue(undefined);
  });

  it("returns content from API", async () => {
    const { result } = renderHook(() => useDraftNotes());

    await waitFor(() => {
      expect(result.current.content).toBe("My draft strategy");
    });

    expect(mockFetchDraftNote).toHaveBeenCalled();
  });

  it("returns empty string when no teamId", () => {
    mockTeamId.current = null;
    const { result } = renderHook(() => useDraftNotes());

    expect(result.current.content).toBe("");
    expect(mockFetchDraftNote).not.toHaveBeenCalled();
  });

  it("save calls API with content", async () => {
    const { result } = renderHook(() => useDraftNotes());

    await waitFor(() => {
      expect(result.current.content).toBe("My draft strategy");
    });

    await act(async () => {
      await result.current.save("Updated strategy");
    });

    expect(mockSaveDraftNoteAPI).toHaveBeenCalledWith("Updated strategy");
  });

  it("reverts on save error", async () => {
    mockSaveDraftNoteAPI.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useDraftNotes());

    await waitFor(() => {
      expect(result.current.content).toBe("My draft strategy");
    });

    await act(async () => {
      await result.current.save("Will fail");
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to save draft note:", expect.any(Error));
    consoleSpy.mockRestore();
  });
});
