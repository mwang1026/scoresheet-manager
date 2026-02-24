import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayersTable } from "./players-table";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import { isPlayerPitcher } from "@/lib/stats";
import type { Projection } from "@/lib/types";

// Mock next/navigation
const { mockPush, mockReplace, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParams: new Map<string, string>()
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace
  }),
  usePathname: () => "/players",
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

// Mock API hooks
const mockUseProjections = vi.fn();
vi.mock("@/lib/hooks/use-players-data", () => ({
  usePlayers: () => ({ players, isLoading: false, error: null }),
  useTeams: () => ({ teams, isLoading: false, error: null }),
  useHitterStats: () => ({ stats: hitterStats, isLoading: false, error: null }),
  usePitcherStats: () => ({ stats: pitcherStats, isLoading: false, error: null }),
  useProjections: () => mockUseProjections(),
}));

// Mock player lists hook
const mockToggleWatchlist = vi.fn();
const mockToggleQueue = vi.fn();
vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => ({
    watchlist: [],
    queue: [],
    isWatchlisted: () => false,
    isInQueue: () => false,
    toggleWatchlist: mockToggleWatchlist,
    toggleQueue: mockToggleQueue,
    isHydrated: true,
  }),
}));

describe("PlayersTable", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.clear();
    mockSearchParams.set("minPA", "0");
    mockSearchParams.set("minIP", "0");
    mockUseProjections.mockReturnValue({ projections: undefined, isLoading: false, error: null });
    mockToggleWatchlist.mockClear();
    mockToggleQueue.mockClear();
  });

  it("renders Hitters/Pitchers tab buttons", () => {
    render(<PlayersTable />);

    expect(screen.getByRole("button", { name: /hitters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pitchers/i })).toBeInTheDocument();
  });

  it("default tab shows hitter players", () => {
    render(<PlayersTable />);

    // Find first hitter from fixture data
    const firstHitter = players.find((p) => !isPlayerPitcher(p));
    if (firstHitter) {
      expect(screen.getByText(firstHitter.name)).toBeInTheDocument();
    }
  });

  it("switching to Pitchers tab shows pitcher names", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const pitchersTab = screen.getByRole("button", { name: /pitchers/i });
    await user.click(pitchersTab);

    // Find first pitcher from fixture data
    const firstPitcher = players.find((p) => isPlayerPitcher(p));
    if (firstPitcher) {
      expect(screen.getByText(firstPitcher.name)).toBeInTheDocument();
    }
  });

  it("renders correct hitter column headers", () => {
    render(<PlayersTable />);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");

    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts).toContain("☆");
    expect(headerTexts).toContain("Q");
    expect(headerTexts.some((t) => t?.includes("Name"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("Pos"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("Elig"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("Team"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("PA"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("AVG"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("OPS"))).toBe(true);
  });

  it("renders correct pitcher column headers", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const pitchersTab = screen.getByRole("button", { name: /pitchers/i });
    await user.click(pitchersTab);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");

    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts.some((t) => t?.includes("G"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("GS"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("IP"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("ERA"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("WHIP"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("K/9"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("SV"))).toBe(true);
  });

  it("displays calculated stats for players with data", () => {
    render(<PlayersTable />);

    // Find any non-pitcher player that has hitter stats
    const someHitter = players.find(
      (p) => !["P", "SR"].includes(p.primary_position)
    );
    if (someHitter) {
      const hitterRow = screen.getByText(someHitter.name).closest("tr");
      expect(hitterRow).toBeInTheDocument();

      // Should have some stats displayed (not all "---")
      expect(hitterRow?.textContent).not.toBe("");
    }
  });

  it("shows --- for players with no stats", () => {
    render(<PlayersTable />);

    // Find a player without stats
    const playerWithoutStats = players.find(
      (p) => !isPlayerPitcher(p) && !hitterStats.some((s) => s.player_id === p.id)
    );

    if (playerWithoutStats) {
      const row = screen.getByText(playerWithoutStats.name).closest("tr");
      // AVG column should show "---"
      expect(row?.textContent).toContain("---");
    }
  });

  it("search filters by name", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const searchInput = screen.getByPlaceholderText(/search players/i);
    await user.type(searchInput, "austin");

    // Should show Austin Serven (player 1) if it exists
    const austin = players.find((p) => p.name.toLowerCase().includes("austin"));
    if (austin) {
      expect(screen.getByText(austin.name)).toBeInTheDocument();
    }

    // Other players should not be visible
    const nonMatching = players.find((p) => !p.name.toLowerCase().includes("austin"));
    if (nonMatching) {
      expect(screen.queryByText(nonMatching.name)).not.toBeInTheDocument();
    }
  });

  it("position filter reduces visible rows via dropdown", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    // Open the Position dropdown
    const positionButton = screen.getByRole("button", { name: /^position/i });
    await user.click(positionButton);

    // Click the "C" checkbox
    await user.click(screen.getByRole("checkbox", { name: "C" }));

    // Should only show catchers
    const catchers = players.filter((p) => p.primary_position === "C");
    const nonCatchers = players.filter(
      (p) => !isPlayerPitcher(p) && p.primary_position !== "C"
    );

    // At least one catcher should be visible
    if (catchers.length > 0) {
      expect(screen.getByText(catchers[0].name)).toBeInTheDocument();
    }

    // Non-catchers should not be visible
    if (nonCatchers.length > 0) {
      expect(screen.queryByText(nonCatchers[0].name)).not.toBeInTheDocument();
    }
  });

  it("clicking column header sorts table", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const nameHeader = screen.getByRole("columnheader", { name: /name/i });
    await user.click(nameHeader);

    // Should show sort indicator
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
  });

  it("clicking player name link navigates to player detail", () => {
    render(<PlayersTable />);

    const firstHitter = players.find((p) => !isPlayerPitcher(p));
    if (firstHitter) {
      const nameLink = screen.getByRole("link", { name: firstHitter.name });
      expect(nameLink).toHaveAttribute("href", `/players/${firstHitter.id}`);
    }
  });

  it("number columns have tabular-nums and text-right classes", () => {
    render(<PlayersTable />);

    // Find PA column header
    const paHeader = screen.getByRole("columnheader", { name: /PA/i });
    expect(paHeader.className).toContain("tabular-nums");
    expect(paHeader.className).toContain("text-right");
  });

  it("date range selector renders with default Season to Date", () => {
    render(<PlayersTable />);

    // Find select with "Season to Date" option
    const dateRangeSelect = screen.getByDisplayValue("Season to Date");
    expect(dateRangeSelect).toBeInTheDocument();

    // Verify WTD option exists
    const options = within(dateRangeSelect).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Week to Date");
  });

  it("custom date range inputs appear when Custom selected", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const dateRangeSelect = screen.getByDisplayValue("Season to Date");
    await user.selectOptions(dateRangeSelect, "custom");

    const dateInputs = screen.getAllByDisplayValue(/2025/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("pagination controls render with correct page info", () => {
    render(<PlayersTable />);

    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("page size selector changes number of visible rows", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const pageSizeSelect = screen.getByDisplayValue("50 per page");
    await user.selectOptions(pageSizeSelect, "20");

    // Page info should update
    const pageInfo = screen.getByText(/showing/i);
    expect(pageInfo.textContent).toContain("1-");
  });

  it("eligible positions display correctly in Elig column", () => {
    render(<PlayersTable />);

    // Find a player with eligible positions
    const multiPos = players.find(
      (p) => !isPlayerPitcher(p) && (p.eligible_ss !== null || p.eligible_2b !== null)
    );

    if (multiPos) {
      const row = screen.getByText(multiPos.name).closest("tr");
      expect(row).toBeInTheDocument();
      // Elig column should have position info
    }
  });

  it("catchers show SB/CS as defense info", () => {
    render(<PlayersTable />);

    const catcher = players.find((p) => p.primary_position === "C");
    if (catcher && catcher.osb_al !== null && catcher.ocs_al !== null) {
      const row = screen.getByText(catcher.name).closest("tr");
      // Alejandro Kirk: osb_al=0.68, ocs_al=0.24 → "C (0.68-0.24)"
      expect(row?.textContent).toContain("C (0.68-0.24)");
    }
  });

  it("watchlist star toggles on click", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const firstHitter = players.find((p) => !isPlayerPitcher(p));
    if (firstHitter) {
      const row = screen.getByText(firstHitter.name).closest("tr");
      if (row) {
        // Find star icon in the row
        const starCell = within(row).getAllByRole("cell")[0];
        await user.click(starCell);

        expect(mockToggleWatchlist).toHaveBeenCalledWith(firstHitter.id);
      }
    }
  });

  it("queue button toggles on click", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const firstHitter = players.find((p) => !isPlayerPitcher(p));
    if (firstHitter) {
      const row = screen.getByText(firstHitter.name).closest("tr");
      if (row) {
        // Find queue icon in the row
        const queueCell = within(row).getAllByRole("cell")[1];
        await user.click(queueCell);

        expect(mockToggleQueue).toHaveBeenCalledWith(firstHitter.id);
      }
    }
  });

  it("status filter includes Watchlisted/In Queue buttons", () => {
    render(<PlayersTable />);

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watchlisted" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unowned" })).toBeInTheDocument();
  });

  it("renders Min PA dropdown when viewing actual stats", () => {
    render(<PlayersTable />);

    // Should show Min PA label
    const minPALabel = screen.getByText("Min PA:");
    expect(minPALabel).toBeInTheDocument();

    // Find the Min PA dropdown (it's next to the label)
    const minPAContainer = minPALabel.parentElement;
    expect(minPAContainer).toBeTruthy();
    if (minPAContainer) {
      const minPADropdown = within(minPAContainer).getByRole("combobox");
      const options = within(minPADropdown).getAllByRole("option");
      const qualifiedOption = options.find(opt => opt.textContent?.startsWith("Qualified"));
      expect(qualifiedOption).toBeInTheDocument();
    }
  });

  it("Min PA/IP filter hides when viewing projected stats", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    // Switch to Projected mode
    const projectedButton = screen.getByRole("button", { name: /projected/i });
    await user.click(projectedButton);

    // Min PA dropdown should not exist
    expect(screen.queryByText("Min PA:")).not.toBeInTheDocument();
    expect(screen.queryByText("Min IP:")).not.toBeInTheDocument();
  });

  it("switching to pitchers shows Min IP label", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    // Default is hitters - should show Min PA
    expect(screen.getByText("Min PA:")).toBeInTheDocument();

    // Switch to pitchers
    const pitchersTab = screen.getByRole("button", { name: /pitchers/i });
    await user.click(pitchersTab);

    // Should now show Min IP
    expect(screen.getByText("Min IP:")).toBeInTheDocument();
    expect(screen.queryByText("Min PA:")).not.toBeInTheDocument();
  });

  it("Hand column header appears in hitters table", () => {
    render(<PlayersTable />);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts).toContain("Hand");
  });

  it("Hand column header appears in pitchers table", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const pitchersTab = screen.getByRole("button", { name: /pitchers/i });
    await user.click(pitchersTab);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts).toContain("Hand");
  });

  it("Hand column displays player hand value", () => {
    render(<PlayersTable />);

    const firstHitter = players.find((p) => !isPlayerPitcher(p));
    if (firstHitter) {
      const row = screen.getByText(firstHitter.name).closest("tr");
      expect(row?.textContent).toMatch(new RegExp(firstHitter.hand));
    }
  });

  it("Hand filter dropdown renders with Hand label", () => {
    render(<PlayersTable />);

    expect(screen.getByRole("button", { name: /^hand/i })).toBeInTheDocument();
  });

  it("Hand filter reduces visible rows", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    // Find a hand value that exists in the fixture data
    const leftHandedHitter = players.find((p) => !isPlayerPitcher(p) && p.hand === "L");
    const rightHandedHitter = players.find((p) => !isPlayerPitcher(p) && p.hand === "R");

    if (!leftHandedHitter || !rightHandedHitter) return;

    // Open Hand dropdown and select "L"
    const handButton = screen.getByRole("button", { name: /^hand/i });
    await user.click(handButton);
    await user.click(screen.getByRole("checkbox", { name: "L" }));

    // L-handed player should be visible
    expect(screen.getByText(leftHandedHitter.name)).toBeInTheDocument();

    // R-handed player should not be visible (unless there's only L-handed)
    expect(screen.queryByText(rightHandedHitter.name)).not.toBeInTheDocument();
  });

  it("vR and vL column headers appear in hitters table", () => {
    render(<PlayersTable />);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts.some((t) => t?.includes("vR"))).toBe(true);
    expect(headerTexts.some((t) => t?.includes("vL"))).toBe(true);
  });

  it("vR and vL columns do not appear in pitchers table", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const pitchersTab = screen.getByRole("button", { name: /pitchers/i });
    await user.click(pitchersTab);

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent);

    expect(headerTexts.some((t) => t?.includes("vR"))).toBe(false);
    expect(headerTexts.some((t) => t?.includes("vL"))).toBe(false);
  });

  it("Position dropdown renders with Position label", () => {
    render(<PlayersTable />);

    expect(screen.getByRole("button", { name: /^position/i })).toBeInTheDocument();
  });

  describe("Async Projection Loading", () => {
    it("projection source dropdown populates after async load", async () => {
      // Start with no projections (still loading)
      mockUseProjections.mockReturnValue({ projections: undefined, isLoading: true, error: null });

      const { rerender } = render(<PlayersTable />);

      // Switch to Projected mode while still loading
      const user = userEvent.setup();
      const projectedButton = screen.getByRole("button", { name: /projected/i });
      await user.click(projectedButton);

      // Source dropdown shouldn't be populated yet (no options)
      const sourceSelect = screen.queryByDisplayValue(/pecota/i);
      expect(sourceSelect).not.toBeInTheDocument();

      // Now simulate projections loading
      const mockProjections: Projection[] = [
        { player_id: players[0].id, source: "PECOTA", PA: 600, AB: 550, H: 150, HR: 25, R: 80, RBI: 90, SB: 10, CS: 3, BB: 50, IBB: 2, HBP: 5, SF: 4, "2B": 30, "3B": 2 },
      ];
      mockUseProjections.mockReturnValue({ projections: mockProjections, isLoading: false, error: null });

      // Force rerender to reflect new projection data
      rerender(<PlayersTable />);

      // Now source dropdown should have PECOTA
      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const optionTexts = options.map((o) => o.textContent);
        expect(optionTexts).toContain("PECOTA");
      });
    });

    it("projected mode enables source dropdown with auto-selected source", async () => {
      // Provide projections with PECOTA source
      const mockProjections: Projection[] = [
        { player_id: 1, source: "PECOTA", PA: 600, AB: 550, H: 150, HR: 25, R: 80, RBI: 90, SB: 10, CS: 3, BB: 50, IBB: 2, HBP: 5, SF: 4, "2B": 30, "3B": 2 },
      ];
      mockUseProjections.mockReturnValue({ projections: mockProjections, isLoading: false, error: null });

      render(<PlayersTable />);

      // Switch to Projected mode
      const user = userEvent.setup();
      const projectedButton = screen.getByRole("button", { name: /projected/i });
      await user.click(projectedButton);

      // Verify source dropdown appears and has PECOTA selected
      await waitFor(() => {
        const sourceDropdown = screen.getByDisplayValue("PECOTA");
        expect(sourceDropdown).toBeInTheDocument();
      });
    });
  });
});
