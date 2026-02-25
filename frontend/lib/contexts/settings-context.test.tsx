import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SettingsProvider, useSettingsContext } from "./settings-context";
import { getDefaultSettings } from "@/lib/settings-types";

const makeWrapper = () =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(SettingsProvider, null, children);

describe("SettingsProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns all-defaults when no localStorage entry exists", () => {
    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });
    expect(result.current.settings).toEqual(getDefaultSettings());
  });

  it("parses valid localStorage JSON on mount", () => {
    const customSettings = {
      ...getDefaultSettings(),
      dashboard: {
        ...getDefaultSettings().dashboard,
        statsSource: "actual" as const,
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(customSettings));

    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });
    expect(result.current.settings.dashboard.statsSource).toBe("actual");
  });

  it("falls back to defaults when localStorage contains invalid JSON", () => {
    localStorage.setItem("scoresheet-settings", "not valid json {{{");
    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });
    expect(result.current.settings).toEqual(getDefaultSettings());
  });

  it("falls back to defaults when localStorage schema version is wrong", () => {
    const wrongVersion = { ...getDefaultSettings(), version: 99 };
    localStorage.setItem("scoresheet-settings", JSON.stringify(wrongVersion));
    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });
    expect(result.current.settings).toEqual(getDefaultSettings());
  });

  it("updatePageSettings updates only the specified page and persists to localStorage", () => {
    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    act(() => {
      result.current.updatePageSettings("dashboard", { statsSource: "actual" });
    });

    expect(result.current.settings.dashboard.statsSource).toBe("actual");
    // Other pages unchanged
    expect(result.current.settings.players.statsSource).toBe("default");
    expect(result.current.settings.opponents.statsSource).toBe("default");
    expect(result.current.settings.draft.statsSource).toBe("default");

    // Persisted to localStorage
    const stored = JSON.parse(localStorage.getItem("scoresheet-settings") ?? "{}");
    expect(stored.dashboard.statsSource).toBe("actual");
  });

  it("updatePageSettings merges partial updates (doesn't overwrite other fields)", () => {
    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    act(() => {
      result.current.updatePageSettings("dashboard", { statsSource: "actual" });
    });
    act(() => {
      result.current.updatePageSettings("dashboard", { dateRange: "last7" });
    });

    expect(result.current.settings.dashboard.statsSource).toBe("actual");
    expect(result.current.settings.dashboard.dateRange).toBe("last7");
  });

  it("resetSettings clears all overrides back to defaults", () => {
    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    act(() => {
      result.current.updatePageSettings("dashboard", { statsSource: "actual" });
      result.current.updatePageSettings("players", { dateRange: "last30" });
    });

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings).toEqual(getDefaultSettings());
    // localStorage cleared
    expect(localStorage.getItem("scoresheet-settings")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // API sync tests
  // ---------------------------------------------------------------------------

  it("API load on mount overwrites localStorage when API returns valid settings", async () => {
    const apiSettings = {
      ...getDefaultSettings(),
      dashboard: { ...getDefaultSettings().dashboard, statsSource: "projected" as const },
    };

    // Override global fetch for this test
    vi.mocked(global.fetch).mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ settings_json: apiSettings, updated_at: new Date().toISOString() }),
    } as Response));

    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.settings.dashboard.statsSource).toBe("projected");
    });

    // Also written to localStorage
    const stored = JSON.parse(localStorage.getItem("scoresheet-settings") ?? "{}");
    expect(stored.dashboard.statsSource).toBe("projected");
  });

  it("falls back to localStorage when API fetch fails", async () => {
    const localSettings = {
      ...getDefaultSettings(),
      players: { ...getDefaultSettings().players, statsSource: "actual" as const },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(localSettings));

    vi.mocked(global.fetch).mockImplementationOnce(async () => {
      throw new Error("Network error");
    });

    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    // Should immediately load from localStorage
    expect(result.current.settings.players.statsSource).toBe("actual");
  });

  it("updatePageSettings triggers a debounced API save", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    // Consume the initial GET fetch call
    await vi.runAllTimersAsync();
    vi.clearAllMocks();

    act(() => {
      result.current.updatePageSettings("draft", { statsSource: "actual" });
    });

    // No PUT yet — debounce hasn't fired
    const putCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/api/me/settings")
    );
    expect(putCalls.length).toBe(0);

    // Advance time past debounce
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const putCallsAfter = vi.mocked(global.fetch).mock.calls.filter(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/api/me/settings") &&
        (init as RequestInit)?.method === "PUT"
    );
    expect(putCallsAfter.length).toBe(1);

    vi.useRealTimers();
  });

  it("resetSettings saves defaults to API immediately", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useSettingsContext(), { wrapper: makeWrapper() });

    // Consume initial GET
    await vi.runAllTimersAsync();
    vi.clearAllMocks();

    act(() => {
      result.current.resetSettings();
    });

    // PUT should fire immediately (no debounce on reset)
    const putCalls = vi.mocked(global.fetch).mock.calls.filter(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/api/me/settings") &&
        (init as RequestInit)?.method === "PUT"
    );
    expect(putCalls.length).toBe(1);

    vi.useRealTimers();
  });
});
