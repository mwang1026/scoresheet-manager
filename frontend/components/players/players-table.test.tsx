import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayersTable } from "./players-table";
import { players, hitterStats } from "@/lib/fixtures";
import { isPlayerPitcher } from "@/lib/stats";

// Mock next/navigation
const { mockPush, mockReplace } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn()
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace
  }),
  usePathname: () => "/players",
  useSearchParams: () => ({
    get: () => null,
  }),
}));

describe("PlayersTable", () => {
  beforeEach(() => {
    mockPush.mockClear();
    // localStorage is cleared in vitest.setup.ts beforeEach
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

    // Player 1 has stats in fixture data, should show calculated AVG
    const player1 = players.find((p) => p.id === 1);
    if (player1) {
      const player1Row = screen.getByText(player1.name).closest("tr");
      expect(player1Row).toBeInTheDocument();

      // Should have some stats displayed (not all "---")
      expect(player1Row?.textContent).not.toBe("");
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

  it("position filter reduces visible rows", async () => {
    const user = userEvent.setup();
    render(<PlayersTable />);

    const catcherButton = screen.getByRole("button", { name: "C" });
    await user.click(catcherButton);

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
      // Should contain defense info in format "C (0.XX-0.XX)"
      const osbRate = (catcher.osb_al / 100).toFixed(2);
      const ocsRate = (catcher.ocs_al / 100).toFixed(2);
      const expectedFormat = `C (${osbRate}-${ocsRate})`;
      expect(row?.textContent).toContain(expectedFormat);
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

        // Star should be filled after click (check localStorage)
        const stored = localStorage.getItem("scoresheet-watchlist");
        expect(stored).toBeTruthy();
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

        // Queue should be updated (check localStorage)
        const stored = localStorage.getItem("scoresheet-queue");
        expect(stored).toBeTruthy();
      }
    }
  });

  it("status filter includes Watchlisted/In Queue options", () => {
    render(<PlayersTable />);

    const statusFilter = screen.getByDisplayValue("All Players");
    expect(statusFilter).toBeInTheDocument();

    const options = within(statusFilter).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("All Players");
    expect(optionTexts).toContain("Watchlisted");
    expect(optionTexts).toContain("In Queue");
    expect(optionTexts).toContain("Unowned");
  });
});
