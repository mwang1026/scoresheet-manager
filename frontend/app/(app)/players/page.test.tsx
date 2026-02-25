import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayersPage from "./page";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  }),
  usePathname: () => "/players",
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock API hooks
vi.mock("@/lib/hooks/use-players-data", () => ({
  usePlayers: () => ({ players, isLoading: false, error: null }),
  useTeams: () => ({ teams, isLoading: false, error: null }),
  useHitterStats: () => ({ stats: hitterStats, isLoading: false, error: null }),
  usePitcherStats: () => ({ stats: pitcherStats, isLoading: false, error: null }),
  useProjections: () => ({ projections: undefined, isLoading: false, error: null }),
}));

// Mock player lists hook
vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => ({
    watchlist: [],
    queue: [],
    isWatchlisted: () => false,
    isInQueue: () => false,
    toggleWatchlist: vi.fn(),
    toggleQueue: vi.fn(),
    isHydrated: true,
  }),
}));

// Mock usePageDefaults to return in-season defaults (tests run Feb 2026 = preseason)
vi.mock("@/lib/hooks/use-page-defaults", () => ({
  usePageDefaults: () => ({
    statsSource: "actual" as const,
    dateRange: { type: "season", year: 2026 },
    projectionSource: null,
    seasonYear: 2026,
    hitterSort: { column: "OPS", direction: "desc" },
    pitcherSort: { column: "ERA", direction: "asc" },
  }),
}));

// Mock team context (used by use-player-lists)
vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => ({
    teamId: 1,
    teams: [],
    currentTeam: null,
    isLoading: false,
    setTeamId: vi.fn(),
  }),
}));

describe("PlayersPage", () => {
  it("should render Players heading", () => {
    render(<PlayersPage />);
    expect(screen.getByRole("heading", { name: /players/i })).toBeInTheDocument();
  });

  it("should render PlayersTable", () => {
    render(<PlayersPage />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
  });

  it("should render hitter columns including HR, R, RBI, SB, CS", () => {
    render(<PlayersPage />);
    // Default tab is hitters
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("RBI")).toBeInTheDocument();
    expect(screen.getByText("SB")).toBeInTheDocument();
    expect(screen.getByText("CS")).toBeInTheDocument();
    // R appears as a column header and in Hand column values — use getAllByText
    expect(screen.getAllByText("R").length).toBeGreaterThan(0);
  });
});
