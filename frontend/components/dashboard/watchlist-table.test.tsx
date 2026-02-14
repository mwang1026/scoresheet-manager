import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WatchlistTable } from "./watchlist-table";
import type { Player, Team } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

describe("WatchlistTable", () => {
  const mockTeam: Team = {
    id: 1,
    name: "Power Hitters",
    is_my_team: true,
  };

  const mockHitter: Player = {
    id: 1,
    name: "Aaron Judge",
    current_team: "NYY",
    primary_position: "OF",
    defense: { OF: 9 },
    team_id: 1,
  };

  const mockPitcher: Player = {
    id: 2,
    name: "Gerrit Cole",
    current_team: "NYY",
    primary_position: "P",
    defense: {},
    team_id: null,
  };

  const mockHitterStats: AggregatedHitterStats = {
    PA: 100,
    AB: 90,
    H: 27,
    "2B": 5,
    "3B": 1,
    HR: 6,
    R: 15,
    RBI: 18,
    BB: 8,
    K: 25,
    HBP: 1,
    SF: 1,
    SB: 2,
    CS: 0,
    AVG: 0.300,
    OBP: 0.370,
    SLG: 0.533,
    OPS: 0.903,
  };

  const mockPitcherStats: AggregatedPitcherStats = {
    G: 5,
    GS: 5,
    IP_outs: 90,
    W: 3,
    L: 1,
    K: 35,
    ER: 10,
    R: 12,
    H: 25,
    BB: 8,
    HBP: 2,
    SV: 0,
    BS: 0,
    HLD: 0,
    ERA: 3.00,
    WHIP: 1.10,
    K9: 10.50,
  };

  it("should render empty state when no players", () => {
    const onRemove = vi.fn();
    render(
      <WatchlistTable
        players={[]}
        teams={[mockTeam]}
        hitterStatsMap={new Map()}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Watchlist (0)")).toBeInTheDocument();
    expect(
      screen.getByText("No players on your watchlist yet. Browse the Players page to add players.")
    ).toBeInTheDocument();
  });

  it("should render watchlist heading with player count", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        players={[mockHitter]}
        teams={[mockTeam]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Watchlist (1)")).toBeInTheDocument();
  });

  it("should render hitter with stats and fantasy team", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        players={[mockHitter]}
        teams={[mockTeam]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("OF")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument(); // PA
    expect(screen.getByText("0.300")).toBeInTheDocument(); // AVG
    expect(screen.getByText("6")).toBeInTheDocument(); // HR
    expect(screen.getByText("18")).toBeInTheDocument(); // RBI
    expect(screen.getByText("0.903")).toBeInTheDocument(); // OPS
  });

  it("should render pitcher with stats", () => {
    const onRemove = vi.fn();
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <WatchlistTable
        players={[mockPitcher]}
        teams={[mockTeam]}
        hitterStatsMap={new Map()}
        pitcherStatsMap={pitcherStatsMap}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("30.0")).toBeInTheDocument(); // IP
    expect(screen.getByText("3-1")).toBeInTheDocument(); // W-L
    expect(screen.getByText("3.00")).toBeInTheDocument(); // ERA - formatAvg returns 2 decimal places
    expect(screen.getByText("35")).toBeInTheDocument(); // K
    expect(screen.getByText("1.10")).toBeInTheDocument(); // WHIP
  });

  it("should show em dash for unowned players", () => {
    const onRemove = vi.fn();
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <WatchlistTable
        players={[mockPitcher]}
        teams={[mockTeam]}
        hitterStatsMap={new Map()}
        pitcherStatsMap={pitcherStatsMap}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    // mockPitcher has team_id: null, should show em dash
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("should link player names to detail page", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        players={[mockHitter]}
        teams={[mockTeam]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    const link = screen.getByRole("link", { name: "Aaron Judge" });
    expect(link).toHaveAttribute("href", "/players/1");
  });

  it("should call onRemove when star button clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        players={[mockHitter]}
        teams={[mockTeam]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    const removeButton = screen.getByLabelText("Remove Aaron Judge from watchlist");
    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("should not render remove buttons when not hydrated", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <WatchlistTable
        players={[mockHitter]}
        teams={[mockTeam]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
        onRemove={onRemove}
        isHydrated={false}
      />
    );
    expect(screen.queryByLabelText("Remove Aaron Judge from watchlist")).not.toBeInTheDocument();
  });

  it("should render both hitters and pitchers with correct headers", () => {
    const onRemove = vi.fn();
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <WatchlistTable
        players={[mockHitter, mockPitcher]}
        teams={[mockTeam]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
        onRemove={onRemove}
        isHydrated={true}
      />
    );
    // Both players should be present
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    // Check for pitcher-specific headers
    expect(screen.getByText("W-L")).toBeInTheDocument();
  });
});
