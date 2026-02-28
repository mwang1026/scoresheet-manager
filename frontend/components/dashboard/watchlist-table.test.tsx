import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchlistTable } from "./watchlist-table";
import type { Player } from "@/lib/fixtures";
import type { Team } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

describe("WatchlistTable", () => {
  const mockTeam: Team = {
    id: 1,
    name: "Power Hitters",
    scoresheet_id: 1,
    league_id: 1,
    league_name: "Test League",
    is_my_team: true,
  };

  const mockHitter: Player = {
    id: 1,
    name: "Aaron Judge",
    mlb_id: 592450,
    scoresheet_id: 100,
    primary_position: "OF",
    hand: "R",
    age: 33,
    current_team: "NYY",
    team_id: 1,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: 5,
    osb_al: null,
    ocs_al: null,
    ba_vr: 0,
    ob_vr: 0,
    sl_vr: 0,
    ba_vl: 0,
    ob_vl: 0,
    sl_vl: 0,
    il_type: null,
    il_date: null,
  };

  const mockPitcher: Player = {
    id: 2,
    name: "Gerrit Cole",
    mlb_id: 543037,
    scoresheet_id: 200,
    primary_position: "P",
    hand: "R",
    age: 35,
    current_team: "NYY",
    team_id: null,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: null,
    osb_al: null,
    ocs_al: null,
    ba_vr: null,
    ob_vr: null,
    sl_vr: null,
    ba_vl: null,
    ob_vl: null,
    sl_vl: null,
    il_type: null,
    il_date: null,
  };

  const mockHitterStats: AggregatedHitterStats = {
    PA: 100,
    AB: 90,
    H: 27,
    "1B": 15,
    "2B": 5,
    "3B": 1,
    HR: 6,
    R: 15,
    RBI: 18,
    BB: 8,
    SO: 25,
    GO: 10,
    FO: 8,
    GDP: 2,
    IBB: 0,
    HBP: 1,
    SF: 1,
    SH: 0,
    SB: 2,
    CS: 0,
    AVG: 0.3,
    OBP: 0.37,
    SLG: 0.533,
    OPS: 0.903,
  };

  const mockPitcherStats: AggregatedPitcherStats = {
    G: 5,
    GS: 5,
    GF: 0,
    CG: 1,
    SHO: 0,
    IP_outs: 90,
    W: 3,
    L: 1,
    K: 35,
    ER: 10,
    R: 12,
    H: 25,
    BB: 8,
    IBB: 0,
    HBP: 2,
    SV: 0,
    HLD: 0,
    WP: 1,
    BK: 0,
    HR: 3,
    BF: 120,
    ERA: 3.0,
    WHIP: 1.1,
    K9: 10.5,
  };

  const defaultProps = {
    teams: [mockTeam],
    hitterStatsMap: new Map(),
    pitcherStatsMap: new Map(),
    queue: [],
    getQueuePosition: vi.fn(() => null),
    onRemove: vi.fn(),
    isHydrated: true,
    getNote: vi.fn(() => ""),
    saveNote: vi.fn(),
  };

  it("should render empty state when no players", () => {
    render(<WatchlistTable {...defaultProps} players={[]} />);

    expect(screen.getByText("Watchlist")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No players on your watchlist yet. Browse the Players page to add players."
      )
    ).toBeInTheDocument();
  });

  it("should render hitter watchlist heading with player count", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getByText("Watchlist - Hitters (1)")).toBeInTheDocument();
  });

  it("should render pitcher watchlist heading with player count", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockPitcher]}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getByText("Watchlist - Pitchers (1)")).toBeInTheDocument();
  });

  it("should render Q# column header", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getByText("Q#")).toBeInTheDocument();
  });

  it("should display queue position when player is in queue", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const getQueuePosition = vi.fn((id: number) => (id === 1 ? 3 : null));

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        queue={[99, 88, 1]}
        getQueuePosition={getQueuePosition}
      />
    );

    expect(screen.getByText("3")).toBeInTheDocument(); // Queue position
  });

  it("should not display queue position when player is not in queue", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const getQueuePosition = vi.fn(() => null);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        getQueuePosition={getQueuePosition}
      />
    );

    // Q# column should be empty (no queue position shown)
    const queueCells = document.querySelectorAll("td.tabular-nums");
    const queueCell = Array.from(queueCells).find((cell) =>
      cell.textContent?.trim() === ""
    );
    expect(queueCell).toBeDefined();
  });

  it("should render hitter with stats and fantasy team", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("OF")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument(); // R
    expect(screen.getByText("0.300")).toBeInTheDocument(); // AVG
    expect(screen.getByText("6")).toBeInTheDocument(); // HR
    expect(screen.getByText("18")).toBeInTheDocument(); // RBI
    expect(screen.getByText("0.903")).toBeInTheDocument(); // OPS
  });

  it("should render pitcher with stats", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockPitcher]}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("30.0")).toBeInTheDocument(); // IP
    expect(screen.getByText("8")).toBeInTheDocument(); // BB
    expect(screen.getByText("3.00")).toBeInTheDocument(); // ERA
    expect(screen.getByText("35")).toBeInTheDocument(); // K
    expect(screen.getByText("1.10")).toBeInTheDocument(); // WHIP
  });

  it("should show em dash for unowned players", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockPitcher]}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    // mockPitcher has team_id: null, should show em dash
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("should link player names to detail page", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    const link = screen.getByRole("link", { name: "Aaron Judge" });
    expect(link).toHaveAttribute("href", "/players/1");
  });

  it("should open confirm dialog when star button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
      />
    );

    const removeButton = screen.getByLabelText("Remove Aaron Judge from watchlist");
    await user.click(removeButton);

    // Should show confirmation dialog
    expect(
      screen.getByText("Remove Aaron Judge from watchlist?")
    ).toBeInTheDocument();
  });

  it("should call onRemove when confirm button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
      />
    );

    // Click star to open dialog
    const removeButton = screen.getByLabelText("Remove Aaron Judge from watchlist");
    await user.click(removeButton);

    // Click confirm button
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("should show queue position info in confirm dialog when player is in queue", async () => {
    const user = userEvent.setup();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const getQueuePosition = vi.fn((id: number) => (id === 1 ? 2 : null));

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        queue={[99, 1]}
        getQueuePosition={getQueuePosition}
      />
    );

    const removeButton = screen.getByLabelText("Remove Aaron Judge from watchlist");
    await user.click(removeButton);

    // Should show queue position info in description
    expect(
      screen.getByText(/This will also remove them from your draft queue \(position #2\)/)
    ).toBeInTheDocument();
  });

  it("should not call onRemove when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        onRemove={onRemove}
      />
    );

    // Click star to open dialog
    const removeButton = screen.getByLabelText("Remove Aaron Judge from watchlist");
    await user.click(removeButton);

    // Click cancel button
    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    expect(onRemove).not.toHaveBeenCalled();
  });

  it("should not render remove buttons when not hydrated", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        isHydrated={false}
      />
    );

    expect(
      screen.queryByLabelText("Remove Aaron Judge from watchlist")
    ).not.toBeInTheDocument();
  });

  it("should render both hitters and pitchers sections", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter, mockPitcher]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    // Both sections should be present
    expect(screen.getByText("Watchlist - Hitters (1)")).toBeInTheDocument();
    expect(screen.getByText("Watchlist - Pitchers (1)")).toBeInTheDocument();

    // Both players should be present
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();

    // Check for pitcher-specific headers
    expect(screen.getByText("BB")).toBeInTheDocument();
  });

  it("should only render hitters section when no pitchers", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    expect(screen.getByText("Watchlist - Hitters (1)")).toBeInTheDocument();
    expect(screen.queryByText(/Watchlist - Pitchers/)).not.toBeInTheDocument();
  });

  it("should only render pitchers section when no hitters", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);

    render(
      <WatchlistTable
        {...defaultProps}
        players={[mockPitcher]}
        pitcherStatsMap={pitcherStatsMap}
      />
    );

    expect(screen.getByText("Watchlist - Pitchers (1)")).toBeInTheDocument();
    expect(screen.queryByText(/Watchlist - Hitters/)).not.toBeInTheDocument();
  });

  it("should render IL icon when player has il_type", () => {
    const ilHitter = { ...mockHitter, id: 99, name: "IL Hitter", il_type: "10-Day IL", il_date: "2026-02-14" };
    const hitterStatsMap = new Map([[ilHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        {...defaultProps}
        players={[ilHitter]}
        hitterStatsMap={hitterStatsMap}
      />
    );

    const svgs = document.querySelectorAll("svg.text-red-500");
    expect(svgs.length).toBe(1);
  });
});
