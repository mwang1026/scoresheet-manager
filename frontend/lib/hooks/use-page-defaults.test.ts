import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { SettingsProvider } from "@/lib/contexts/settings-context";
import { usePageDefaults } from "./use-page-defaults";
import { DEFAULT_HITTER_SORT, DEFAULT_PITCHER_SORT } from "@/lib/defaults";

// We mock `new Date()` via vi.setSystemTime so we can test different season periods.

const makeWrapper = () =>
  ({ children }: { children: React.ReactNode }) =>
    createElement(SettingsProvider, null, children);

// Helper to set the system date to a specific date
function setDate(year: number, month: number, day: number) {
  vi.setSystemTime(new Date(year, month - 1, day));
}

describe("usePageDefaults — preseason (Feb 24 2026)", () => {
  beforeEach(() => {
    localStorage.clear();
    setDate(2026, 2, 24);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("dashboard defaults to projected statsSource", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.statsSource).toBe("projected");
  });

  it("players defaults to projected statsSource", () => {
    const { result } = renderHook(() => usePageDefaults("players"), { wrapper: makeWrapper() });
    expect(result.current.statsSource).toBe("projected");
  });

  it("dashboard dateRange falls back to season (preseason has null seasonal default)", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "season", year: 2026 });
  });

  it("draft dateRange falls back to season (preseason has null seasonal default)", () => {
    const { result } = renderHook(() => usePageDefaults("draft"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "season", year: 2026 });
  });

  it("seasonYear is 2026", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.seasonYear).toBe(2026);
  });

  it("projectionSource is PECOTA-50", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.projectionSource).toBe("PECOTA-50");
  });
});

describe("usePageDefaults — in-season (Jun 15 2026)", () => {
  beforeEach(() => {
    localStorage.clear();
    setDate(2026, 6, 15);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("statsSource is actual", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.statsSource).toBe("actual");
  });

  it("dashboard dateRange is wtd", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "wtd" });
  });

  it("players dateRange is season 2026", () => {
    const { result } = renderHook(() => usePageDefaults("players"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "season", year: 2026 });
  });

  it("opponents dateRange is wtd", () => {
    const { result } = renderHook(() => usePageDefaults("opponents"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "wtd" });
  });

  it("draft dateRange is last30", () => {
    const { result } = renderHook(() => usePageDefaults("draft"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "last30" });
  });

  it("projectionSource is null", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.projectionSource).toBeNull();
  });
});

describe("usePageDefaults — user settings overrides", () => {
  beforeEach(() => {
    localStorage.clear();
    // Preseason — so default would be projected
    setDate(2026, 2, 24);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("statsSource override 'actual' during preseason wins over seasonal 'projected'", () => {
    // Store override in localStorage before rendering
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "actual",
        dateRange: "default",
        projectionSource: "default",
        rosterHittersSort: null,
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.statsSource).toBe("actual");
    // Players still uses seasonal default
  });

  it("dateRange override 'last7' returns { type: 'last7' } regardless of season", () => {
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "default",
        dateRange: "last7",
        projectionSource: "default",
        rosterHittersSort: null,
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.dateRange).toEqual({ type: "last7" });
  });
});

describe("usePageDefaults — sort defaults", () => {
  beforeEach(() => {
    localStorage.clear();
    setDate(2026, 6, 15); // in-season
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("hitterSort defaults to DEFAULT_HITTER_SORT when no override", () => {
    const { result } = renderHook(() => usePageDefaults("players"), { wrapper: makeWrapper() });
    expect(result.current.hitterSort).toEqual(DEFAULT_HITTER_SORT);
  });

  it("pitcherSort defaults to DEFAULT_PITCHER_SORT when no override", () => {
    const { result } = renderHook(() => usePageDefaults("players"), { wrapper: makeWrapper() });
    expect(result.current.pitcherSort).toEqual(DEFAULT_PITCHER_SORT);
  });

  it("sort override returns the override value", () => {
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        rosterHittersSort: null,
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: { column: "HR", direction: "desc" },
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("players"), { wrapper: makeWrapper() });
    expect(result.current.hitterSort).toEqual({ column: "HR", direction: "desc" });
  });

  it("dashboard provides rosterHittersSort, rosterPitchersSort, watchlistHittersSort, watchlistPitchersSort", () => {
    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.rosterHittersSort).toEqual(DEFAULT_HITTER_SORT);
    expect(result.current.rosterPitchersSort).toEqual(DEFAULT_PITCHER_SORT);
    expect(result.current.watchlistHittersSort).toEqual(DEFAULT_HITTER_SORT);
    expect(result.current.watchlistPitchersSort).toEqual(DEFAULT_PITCHER_SORT);
  });

  it("opponents hitter sort override is applied", () => {
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        rosterHittersSort: null,
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: { column: "HR", direction: "desc" },
        pitchersSort: null,
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("opponents"), { wrapper: makeWrapper() });
    expect(result.current.hitterSort).toEqual({ column: "HR", direction: "desc" });
  });

  it("opponents pitcher sort override is applied", () => {
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        rosterHittersSort: null,
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: { column: "WHIP", direction: "asc" },
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("opponents"), { wrapper: makeWrapper() });
    expect(result.current.pitcherSort).toEqual({ column: "WHIP", direction: "asc" });
  });

  it("dashboard rosterHittersSort override is applied", () => {
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        rosterHittersSort: { column: "HR", direction: "desc" },
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("dashboard"), { wrapper: makeWrapper() });
    expect(result.current.rosterHittersSort).toEqual({ column: "HR", direction: "desc" });
  });

  it("resolveSort handles direction 'default' by using fallback direction", () => {
    const storedSettings = {
      version: 1,
      dashboard: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        rosterHittersSort: null,
        rosterPitchersSort: null,
        watchlistHittersSort: null,
        watchlistPitchersSort: null,
      },
      players: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: { column: "HR", direction: "default" },
        pitchersSort: null,
      },
      opponents: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
        hittersSort: null,
        pitchersSort: null,
      },
      draft: {
        statsSource: "default",
        dateRange: "default",
        projectionSource: "default",
      },
    };
    localStorage.setItem("scoresheet-settings", JSON.stringify(storedSettings));

    const { result } = renderHook(() => usePageDefaults("players"), { wrapper: makeWrapper() });
    // direction "default" falls back to DEFAULT_HITTER_SORT.direction = "desc"
    expect(result.current.hitterSort).toEqual({ column: "HR", direction: "desc" });
  });
});
