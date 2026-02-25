import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
});
