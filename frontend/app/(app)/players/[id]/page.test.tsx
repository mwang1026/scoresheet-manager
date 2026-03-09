import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import PlayerDetailPage from "./page";
import { useRouter } from "next/navigation";
import { players, teams, hitterStats, pitcherStats, projections } from "@/lib/fixtures";
import { getSeasonYear, getSeasonStartStr, getSeasonEndStr } from "@/lib/defaults";
import type { DateRange } from "@/lib/stats";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Capture ranges passed to hooks for assertions
let capturedHitterRange: DateRange | null = null;
let capturedPitcherRange: DateRange | null = null;

// Mock API hooks — date-range-aware so historical rows get filtered correctly
vi.mock("@/lib/hooks/use-players-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hooks/use-players-data")>();
  return {
    ...actual,
    usePlayers: () => ({ players, isLoading: false, error: null }),
    useTeams: () => ({ teams, isLoading: false, error: null }),
    useHitterStats: (range: DateRange, playerId?: number) => {
      capturedHitterRange = range;
      const { start, end } = actual.getDateRangeBounds(range);
      let filtered = hitterStats.filter((s) => s.date >= start && s.date <= end);
      if (playerId) filtered = filtered.filter((s) => s.player_id === playerId);
      return { stats: filtered, isLoading: false, error: null };
    },
    usePitcherStats: (range: DateRange, playerId?: number) => {
      capturedPitcherRange = range;
      const { start, end } = actual.getDateRangeBounds(range);
      let filtered = pitcherStats.filter((s) => s.date >= start && s.date <= end);
      if (playerId) filtered = filtered.filter((s) => s.player_id === playerId);
      return { stats: filtered, isLoading: false, error: null };
    },
    useProjections: (_source: unknown, playerId?: number) => ({
      projections: playerId ? projections.filter((p) => p.player_id === playerId) : projections,
      isLoading: false,
      error: null,
    }),
  };
});

// Mock player lists hook
vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => ({
    isWatchlisted: () => false,
    isInQueue: () => false,
    toggleWatchlist: vi.fn(),
    toggleQueue: vi.fn(),
    isHydrated: true,
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

function renderWithSuspense(ui: React.ReactElement) {
  return render(<Suspense fallback={<div>Loading</div>}>{ui}</Suspense>);
}

describe("PlayerDetailPage", () => {
  const mockRouter = {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedHitterRange = null;
    capturedPitcherRange = null;
    sessionStorage.clear();
    vi.mocked(useRouter).mockReturnValue(mockRouter as Partial<AppRouterInstance> as AppRouterInstance);
  });

  it("renders back button", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it("navigates back when back button is clicked", async () => {
    const user = userEvent.setup();
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    const backButton = screen.getByRole("button", { name: /back/i });
    await user.click(backButton);

    expect(mockRouter.back).toHaveBeenCalledOnce();
  });

  it("shows 'Back to Dashboard' when previous path is /", async () => {
    sessionStorage.setItem("previousPath", "/");
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    expect(screen.getByRole("button", { name: /back to dashboard/i })).toBeInTheDocument();
  });

  it("shows 'Back to Players' when previous path is /players", async () => {
    sessionStorage.setItem("previousPath", "/players");
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    expect(screen.getByRole("button", { name: /back to players/i })).toBeInTheDocument();
  });

  it("shows 'Back to Draft' when previous path is /draft", async () => {
    sessionStorage.setItem("previousPath", "/draft");
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    expect(screen.getByRole("button", { name: /back to draft/i })).toBeInTheDocument();
  });

  it("shows 'Back' when no previous path stored", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("renders player header for hitter", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(screen.getByText("Bryce Harper")).toBeInTheDocument();
    expect(screen.getByText(/Position:/)).toBeInTheDocument();
    expect(screen.getByText(/Eligible:/)).toBeInTheDocument();
    expect(screen.getByText(/MLB Team:/)).toBeInTheDocument();
    expect(screen.getByText(/Fantasy Team:/)).toBeInTheDocument();
  });

  it("renders player header for pitcher", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "14" })} />);
    });

    expect(screen.getByText("Cade Cavalli")).toBeInTheDocument();
    expect(screen.getByText(/Position:/)).toBeInTheDocument();
    expect(screen.getByText(/MLB Team:/)).toBeInTheDocument();
  });

  it("renders stats table for hitter", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Check for hitter stat columns
    expect(screen.getByText("PA")).toBeInTheDocument();
    expect(screen.getByText("AB")).toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();

    // Check for date range rows
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("Last 30")).toBeInTheDocument();
    expect(screen.getByText("Last 14")).toBeInTheDocument();
    expect(screen.getByText("Last 7")).toBeInTheDocument();
  });

  it("renders custom date range pickers", async () => {
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    const fromInput = screen.getByLabelText(/from:/i);
    const toInput = screen.getByLabelText(/to:/i);

    expect(fromInput).toBeInTheDocument();
    expect(toInput).toBeInTheDocument();
    expect(fromInput).toHaveValue(`${seasonYear}-04-01`);
    expect(toInput).toHaveValue(`${seasonYear}-09-30`);
  });

  it("renders custom date range row in stats table", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Custom row should show with formatted date range (flexible matching)
    expect(screen.getByText(/Custom/)).toBeInTheDocument();
  });

  it("updates custom date range when inputs change", async () => {
    const user = userEvent.setup();
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    const fromInput = screen.getByLabelText(/from:/i);
    const toInput = screen.getByLabelText(/to:/i);

    await user.clear(fromInput);
    await user.type(fromInput, "2025-05-01");

    await user.clear(toInput);
    await user.type(toInput, "2025-08-31");

    expect(fromInput).toHaveValue("2025-05-01");
    expect(toInput).toHaveValue("2025-08-31");
    // Check that custom text is still present (date format updated)
    expect(screen.getByText(/Custom/)).toBeInTheDocument();
  });

  it("renders projection rows for hitter with projections", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Player 1 has a Steamer projection
    expect(screen.getByText("Proj (PECOTA-50)")).toBeInTheDocument();
  });

  it("renders projection rows for pitcher with projections", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "14" })} />);
    });

    // Player 14 (Garrett Crochet) has a Steamer projection
    expect(screen.getByText("Proj (PECOTA-50)")).toBeInTheDocument();
  });

  it("does not render projection rows for players without projections", async () => {
    // Player 4 or another player without projections in fixtures
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "4" })} />);
    });

    // Should not have any projection rows
    expect(screen.queryByText(/Proj \(/)).not.toBeInTheDocument();
  });

  it("renders historical season rows", async () => {
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(screen.getByText(String(seasonYear - 1))).toBeInTheDocument();
    expect(screen.getByText(String(seasonYear - 2))).toBeInTheDocument();
    expect(screen.getByText(String(seasonYear - 3))).toBeInTheDocument();
  });

  it("renders stats rows in correct order", async () => {
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    const rows = screen.getAllByRole("row");
    const rowTexts = rows.map((row) => row.textContent);

    // Find indices of key rows (skip header row at index 0)
    const customIndex = rowTexts.findIndex((text) => text?.includes("Custom"));
    const last7Index = rowTexts.findIndex((text) => text?.includes("Last 7"));
    const last14Index = rowTexts.findIndex((text) => text?.includes("Last 14"));
    const last30Index = rowTexts.findIndex((text) => text?.includes("Last 30"));
    const seasonIndex = rowTexts.findIndex((text) => text === "Season" || text?.startsWith("Season"));
    const projIndex = rowTexts.findIndex((text) => text?.includes("Proj ("));
    const y1Index = rowTexts.findIndex((text) => text === String(seasonYear - 1) || text?.startsWith(String(seasonYear - 1)));
    const y2Index = rowTexts.findIndex((text) => text === String(seasonYear - 2) || text?.startsWith(String(seasonYear - 2)));
    const y3Index = rowTexts.findIndex((text) => text === String(seasonYear - 3) || text?.startsWith(String(seasonYear - 3)));

    // Verify order: Custom < Last 7 < Last 14 < Last 30 < Season < Proj < (year-1) < (year-2) < (year-3)
    expect(customIndex).toBeLessThan(last7Index);
    expect(last7Index).toBeLessThan(last14Index);
    expect(last14Index).toBeLessThan(last30Index);
    expect(last30Index).toBeLessThan(seasonIndex);
    expect(seasonIndex).toBeLessThan(projIndex);
    expect(projIndex).toBeLessThan(y1Index);
    expect(y1Index).toBeLessThan(y2Index);
    expect(y2Index).toBeLessThan(y3Index);
  });

  it("renders stats table for pitcher", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "14" })} />);
    });

    // Check for pitcher stat columns
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.getByText("ERA")).toBeInTheDocument();
    expect(screen.getByText("WHIP")).toBeInTheDocument();
    expect(screen.getByText("K/9")).toBeInTheDocument();

    // Check for date range rows
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("Last 30")).toBeInTheDocument();
    expect(screen.getByText("Last 14")).toBeInTheDocument();
    expect(screen.getByText("Last 7")).toBeInTheDocument();
  });

  it("renders watchlist toggle button", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    expect(screen.getByRole("button", { name: /add to watchlist/i })).toBeInTheDocument();
  });

  it("renders queue toggle button", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });
    expect(screen.getByRole("button", { name: /add to queue/i })).toBeInTheDocument();
  });

  it("shows not found message for invalid player ID", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "9999" })} />);
    });
    expect(screen.getByText("Player not found")).toBeInTheDocument();
  });

  it("fetches stats spanning 4 years (current + 3 historical)", async () => {
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(capturedHitterRange).toEqual({
      type: "custom",
      start: getSeasonStartStr(seasonYear - 3),
      end: getSeasonEndStr(seasonYear),
    });
    expect(capturedPitcherRange).toEqual({
      type: "custom",
      start: getSeasonStartStr(seasonYear - 3),
      end: getSeasonEndStr(seasonYear),
    });
  });

  it("historical row with data shows stats, not dashes", async () => {
    // Fixture data has 2025 dates; seasonYear-1 = 2025
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Find the row labeled with the previous season year (e.g. "2025")
    const rows = screen.getAllByRole("row");
    const histRow = rows.find((row) => {
      const cells = within(row).queryAllByRole("cell");
      return cells.length > 0 && cells[0].textContent === String(seasonYear - 1);
    });
    expect(histRow).toBeDefined();

    // The row should contain numeric stat values, not all dashes
    const cells = within(histRow!).getAllByRole("cell");
    // PA cell (index 1) should be a number, not "—"
    expect(cells[1].textContent).not.toBe("—");
    expect(Number(cells[1].textContent)).toBeGreaterThan(0);
  });

  it("historical row without data shows dashes", async () => {
    // No fixture data for 2024; seasonYear-2 = 2024
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Find the row labeled with two seasons ago (e.g. "2024")
    const rows = screen.getAllByRole("row");
    const histRow = rows.find((row) => {
      const cells = within(row).queryAllByRole("cell");
      return cells.length > 0 && cells[0].textContent === String(seasonYear - 2);
    });
    expect(histRow).toBeDefined();

    // All stat cells should show dashes (— or ---)
    const cells = within(histRow!).getAllByRole("cell");
    // Skip cell[0] (the label). Check remaining cells are all dashes.
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i].textContent).toMatch(/^(—|---)$/);
    }
  });

  it("shows 'Bats:' with correct hand value for hitter", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(screen.getByText("Bats:")).toBeInTheDocument();
    // Player 1 (Bryce Harper) has hand="L"
    expect(screen.getByText("Bats:").parentElement!.textContent).toContain("L");
  });

  it("shows 'Throws:' with correct hand value for pitcher", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "14" })} />);
    });

    expect(screen.getByText("Throws:")).toBeInTheDocument();
    // Player 14 (Cade Cavalli) has hand="R"
    expect(screen.getByText("Throws:").parentElement!.textContent).toContain("R");
  });

  it("shows vR and vL headers for hitter stats table", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    expect(screen.getByText("vR")).toBeInTheDocument();
    expect(screen.getByText("vL")).toBeInTheDocument();
  });

  it("does not show vR and vL headers for pitcher stats table", async () => {
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "14" })} />);
    });

    expect(screen.queryByText("vR")).not.toBeInTheDocument();
    expect(screen.queryByText("vL")).not.toBeInTheDocument();
  });

  it("shows formatted vR/vL values for rows with stats data", async () => {
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Find the historical row with data (seasonYear-1 has fixture data)
    const rows = screen.getAllByRole("row");
    const histRow = rows.find((row) => {
      const cells = within(row).queryAllByRole("cell");
      return cells.length > 0 && cells[0].textContent === String(seasonYear - 1);
    });
    expect(histRow).toBeDefined();

    const cells = within(histRow!).getAllByRole("cell");
    // vR and vL are the last two cells (after OPS)
    const vrCell = cells[cells.length - 2];
    const vlCell = cells[cells.length - 1];
    // Should be formatted as a numeric average (e.g. ".800" or "1.050")
    expect(vrCell.textContent).toMatch(/^\d*\.\d{3}$/);
    expect(vlCell.textContent).toMatch(/^\d*\.\d{3}$/);
  });

  it("shows '---' for vR/vL in rows without stats data", async () => {
    const seasonYear = getSeasonYear(new Date());
    await act(async () => {
      renderWithSuspense(<PlayerDetailPage params={Promise.resolve({ id: "1" })} />);
    });

    // Find the historical row without data (seasonYear-2 has no fixture data)
    const rows = screen.getAllByRole("row");
    const histRow = rows.find((row) => {
      const cells = within(row).queryAllByRole("cell");
      return cells.length > 0 && cells[0].textContent === String(seasonYear - 2);
    });
    expect(histRow).toBeDefined();

    const cells = within(histRow!).getAllByRole("cell");
    // vR and vL are the last two cells
    const vrCell = cells[cells.length - 2];
    const vlCell = cells[cells.length - 1];
    expect(vrCell.textContent).toBe("---");
    expect(vlCell.textContent).toBe("---");
  });
});
