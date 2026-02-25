import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayersTableState } from "./use-players-table-state";
import type { ResolvedPageDefaults } from "./use-page-defaults";

// Mock next/navigation.
// IMPORTANT: useSearchParams() must return a stable object reference across renders.
// If it returns a new object each call, the hook's useEffect([searchParams, ...])
// triggers on every render → infinite loop → worker crash.
const { mockReplace, mockSearchParamsStore, mockSearchParamsRef } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const ref = { get: (key: string) => store.get(key) ?? null };
  return { mockReplace: vi.fn(), mockSearchParamsStore: store, mockSearchParamsRef: ref };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParamsRef,
}));

const DEFAULTS: ResolvedPageDefaults = {
  statsSource: "actual",
  dateRange: { type: "season", year: 2026 },
  projectionSource: null,
  seasonYear: 2026,
  hitterSort: { column: "OPS", direction: "desc" },
  pitcherSort: { column: "ERA", direction: "asc" },
};

const AVAILABLE_SOURCES = ["PECOTA-50", "Steamer"];

function renderState(
  defaults = DEFAULTS,
  availableSources = AVAILABLE_SOURCES,
  params: Record<string, string> = {}
) {
  mockSearchParamsStore.clear();
  Object.entries(params).forEach(([k, v]) => mockSearchParamsStore.set(k, v));
  return renderHook(() => usePlayersTableState(defaults, availableSources));
}

describe("usePlayersTableState — initial defaults", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("starts on the hitters tab", () => {
    const { result } = renderState();
    expect(result.current.activeTab).toBe("hitters");
  });

  it("starts with empty search query", () => {
    const { result } = renderState();
    expect(result.current.searchQuery).toBe("");
  });

  it("starts with pageSize 50", () => {
    const { result } = renderState();
    expect(result.current.pageSize).toBe(50);
  });

  it("starts on page 0", () => {
    const { result } = renderState();
    expect(result.current.currentPage).toBe(0);
  });

  it("starts with qualified PA threshold", () => {
    const { result } = renderState();
    expect(result.current.minPA).toBe("qualified");
  });

  it("starts with qualified IP threshold", () => {
    const { result } = renderState();
    expect(result.current.minIP).toBe("qualified");
  });

  it("uses defaults statsSource", () => {
    const { result } = renderState();
    expect(result.current.statsSource).toBe("actual");
  });

  it("uses first available projection source", () => {
    const { result } = renderState();
    expect(result.current.projectionSource).toBe("PECOTA-50");
  });
});

describe("usePlayersTableState — URL param parsing", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("reads tab=pitchers from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { tab: "pitchers" });
    expect(result.current.activeTab).toBe("pitchers");
  });

  it("reads q=Judge from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { q: "Judge" });
    expect(result.current.searchQuery).toBe("Judge");
  });

  it("reads pos=1B,2B from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { pos: "1B,2B" });
    expect(result.current.selectedPositions).toEqual(new Set(["1B", "2B"]));
  });

  it("reads hand=L,R from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { hand: "L,R" });
    expect(result.current.selectedHands).toEqual(new Set(["L", "R"]));
  });

  it("reads status=watchlisted from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { status: "watchlisted" });
    expect(result.current.statusFilter).toBe("watchlisted");
  });

  it("reads status=queued from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { status: "queued" });
    expect(result.current.statusFilter).toBe("queued");
  });

  it("ignores unknown status values", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { status: "badvalue" });
    expect(result.current.statusFilter).toBe("all");
  });

  it("reads source=projected from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { source: "projected" });
    expect(result.current.statsSource).toBe("projected");
  });

  it("reads sort=HR from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { sort: "HR" });
    expect(result.current.sortColumn).toBe("HR");
  });

  it("reads dir=asc from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { dir: "asc" });
    expect(result.current.sortDirection).toBe("asc");
  });

  it("reads minPA=100 from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { minPA: "100" });
    expect(result.current.minPA).toBe(100);
  });

  it("reads minIP=qualified from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { minIP: "qualified" });
    expect(result.current.minIP).toBe("qualified");
  });

  it("reads range=last7 from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { range: "last7" });
    expect(result.current.dateRange).toEqual({ type: "last7" });
  });

  it("reads range=custom with start/end from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, {
      range: "custom",
      start: "2026-05-01",
      end: "2026-05-31",
    });
    expect(result.current.dateRange).toEqual({
      type: "custom",
      start: "2026-05-01",
      end: "2026-05-31",
    });
  });

  it("reads size=20 from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { size: "20" });
    expect(result.current.pageSize).toBe(20);
  });

  it("reads page=3 from URL", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { page: "3" });
    expect(result.current.currentPage).toBe(3);
  });
});

describe("usePlayersTableState — handleSort", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("toggles direction when clicking the current sort column", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { sort: "HR", dir: "asc" });
    act(() => result.current.handleSort("HR"));
    expect(result.current.sortDirection).toBe("desc");
  });

  it("sets new column and resets to asc when clicking a different column", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { sort: "HR", dir: "asc" });
    act(() => result.current.handleSort("RBI"));
    expect(result.current.sortColumn).toBe("RBI");
    expect(result.current.sortDirection).toBe("asc");
  });
});

describe("usePlayersTableState — handleTabChange", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("switches tab, sort column, and direction together", () => {
    const { result } = renderState();
    act(() => result.current.handleTabChange("pitchers", "ERA", "asc"));
    expect(result.current.activeTab).toBe("pitchers");
    expect(result.current.sortColumn).toBe("ERA");
    expect(result.current.sortDirection).toBe("asc");
  });
});

describe("usePlayersTableState — filter handlers", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("handlePositionsChange updates selectedPositions", () => {
    const { result } = renderState();
    act(() => result.current.handlePositionsChange(new Set(["1B", "OF"])));
    expect(result.current.selectedPositions).toEqual(new Set(["1B", "OF"]));
  });

  it("handleHandsChange updates selectedHands", () => {
    const { result } = renderState();
    act(() => result.current.handleHandsChange(new Set(["L"])));
    expect(result.current.selectedHands).toEqual(new Set(["L"]));
  });

  it("setStatusFilter updates statusFilter", () => {
    const { result } = renderState();
    act(() => result.current.setStatusFilter("queued"));
    expect(result.current.statusFilter).toBe("queued");
  });
});

describe("usePlayersTableState — setDateRange", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("sets last7 range", () => {
    const { result } = renderState();
    act(() => result.current.setDateRange({ type: "last7" }));
    expect(result.current.dateRange).toEqual({ type: "last7" });
  });

  it("sets last14 range", () => {
    const { result } = renderState();
    act(() => result.current.setDateRange({ type: "last14" }));
    expect(result.current.dateRange).toEqual({ type: "last14" });
  });

  it("sets last30 range", () => {
    const { result } = renderState();
    act(() => result.current.setDateRange({ type: "last30" }));
    expect(result.current.dateRange).toEqual({ type: "last30" });
  });

  it("sets wtd range", () => {
    const { result } = renderState();
    act(() => result.current.setDateRange({ type: "wtd" }));
    expect(result.current.dateRange).toEqual({ type: "wtd" });
  });

  it("sets season range", () => {
    const { result } = renderState();
    act(() => result.current.setDateRange({ type: "season", year: 2026 }));
    expect(result.current.dateRange).toEqual({ type: "season", year: 2026 });
  });

  it("sets custom range directly", () => {
    const { result } = renderState();
    act(() => result.current.setDateRange({ type: "custom", start: "2026-06-01", end: "2026-06-30" }));
    expect(result.current.dateRange).toEqual({
      type: "custom",
      start: "2026-06-01",
      end: "2026-06-30",
    });
  });
});

describe("usePlayersTableState — projectionSource", () => {
  beforeEach(() => {
    mockSearchParamsStore.clear();
    mockReplace.mockClear();
  });

  it("initializes to first available source", () => {
    const { result } = renderState(DEFAULTS, ["ZiPS", "Steamer"]);
    expect(result.current.projectionSource).toBe("ZiPS");
  });

  it("reads projSource from URL when it is in available sources", () => {
    const { result } = renderState(DEFAULTS, AVAILABLE_SOURCES, { projSource: "Steamer" });
    expect(result.current.projectionSource).toBe("Steamer");
  });
});
