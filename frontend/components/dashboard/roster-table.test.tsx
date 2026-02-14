import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RosterTable } from "./roster-table";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

describe("RosterTable", () => {
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
    team_id: 1,
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

  it("should render roster heading with player count", () => {
    render(
      <RosterTable
        players={[mockHitter]}
        hitterStatsMap={new Map([[mockHitter.id, mockHitterStats]])}
        pitcherStatsMap={new Map()}
      />
    );
    expect(screen.getByText("My Roster (1)")).toBeInTheDocument();
  });

  it("should render hitter with stats", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <RosterTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
      />
    );
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("OF")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument(); // PA
    expect(screen.getByText("0.300")).toBeInTheDocument(); // AVG
    expect(screen.getByText("6")).toBeInTheDocument(); // HR
    expect(screen.getByText("18")).toBeInTheDocument(); // RBI
    expect(screen.getByText("0.903")).toBeInTheDocument(); // OPS
  });

  it("should render pitcher with stats", () => {
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <RosterTable
        players={[mockPitcher]}
        hitterStatsMap={new Map()}
        pitcherStatsMap={pitcherStatsMap}
      />
    );
    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByText("NYY")).toBeInTheDocument();
    expect(screen.getByText("30.0")).toBeInTheDocument(); // IP (90 outs / 3)
    expect(screen.getByText("3-1")).toBeInTheDocument(); // W-L
    expect(screen.getByText("3.00")).toBeInTheDocument(); // ERA - formatAvg returns 2 decimal places
    expect(screen.getByText("35")).toBeInTheDocument(); // K
    expect(screen.getByText("1.10")).toBeInTheDocument(); // WHIP
  });

  it("should separate hitters and pitchers with border", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    const { container } = render(
      <RosterTable
        players={[mockHitter, mockPitcher]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
      />
    );
    const separators = container.querySelectorAll(".border-t-2");
    expect(separators.length).toBeGreaterThan(0);
  });

  it("should link player names to detail page", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    render(
      <RosterTable
        players={[mockHitter]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={new Map()}
      />
    );
    const link = screen.getByRole("link", { name: "Aaron Judge" });
    expect(link).toHaveAttribute("href", "/players/1");
  });

  it("should render both hitters and pitchers with correct headers", () => {
    const hitterStatsMap = new Map([[mockHitter.id, mockHitterStats]]);
    const pitcherStatsMap = new Map([[mockPitcher.id, mockPitcherStats]]);
    render(
      <RosterTable
        players={[mockHitter, mockPitcher]}
        hitterStatsMap={hitterStatsMap}
        pitcherStatsMap={pitcherStatsMap}
      />
    );
    // Both players should be present
    expect(screen.getByText("Aaron Judge")).toBeInTheDocument();
    expect(screen.getByText("Gerrit Cole")).toBeInTheDocument();
    // Check for pitcher-specific headers
    expect(screen.getByText("W-L")).toBeInTheDocument();
  });
});
