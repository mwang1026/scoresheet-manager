import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RosterPitchersTable } from "./roster-pitchers-table";
import { players } from "@/lib/fixtures";
import type { AggregatedPitcherStats } from "@/lib/stats";

describe("RosterPitchersTable", () => {
  const mockPitchers = players.filter((p) => p.primary_position === "P");
  const mockStatsMap = new Map<number, AggregatedPitcherStats>();

  mockStatsMap.set(mockPitchers[0].id, {
    G: 10,
    GS: 10,
    GF: 0,
    CG: 1,
    SHO: 0,
    SV: 0,
    HLD: 0,
    IP_outs: 180, // 60.0 IP
    W: 6,
    L: 3,
    ER: 25,
    R: 28,
    BF: 250,
    H: 55,
    BB: 20,
    IBB: 0,
    HBP: 3,
    K: 65,
    HR: 8,
    WP: 2,
    BK: 0,
    ERA: 3.75,
    WHIP: 1.25,
    K9: 9.75,
  });

  const mockTeamTotals: AggregatedPitcherStats = {
    G: 50,
    GS: 30,
    GF: 20,
    CG: 2,
    SHO: 1,
    SV: 10,
    HLD: 15,
    IP_outs: 450, // 150.0 IP
    W: 25,
    L: 15,
    ER: 65,
    R: 72,
    BF: 650,
    H: 140,
    BB: 55,
    IBB: 2,
    HBP: 8,
    K: 150,
    HR: 18,
    WP: 6,
    BK: 1,
    ERA: 3.9,
    WHIP: 1.3,
    K9: 9.0,
  };

  it("renders heading with player count", () => {
    render(
      <RosterPitchersTable
        players={mockPitchers}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("My Pitchers")).toBeInTheDocument();
    expect(screen.getByText(`${mockPitchers.length}`)).toBeInTheDocument();
  });

  it("renders pitcher stat columns", () => {
    render(
      <RosterPitchersTable
        players={mockPitchers}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Pos")).toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("GS")).toBeInTheDocument();
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
    expect(screen.getByText("BB")).toBeInTheDocument();
    expect(screen.getByText("ER")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("ERA")).toBeInTheDocument();
    expect(screen.getByText("WHIP")).toBeInTheDocument();
  });

  it("renders player rows with stats", () => {
    render(
      <RosterPitchersTable
        players={[mockPitchers[0]]}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText(mockPitchers[0].name)).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(2); // G=10, GS=10
    expect(screen.getByText("60.0")).toBeInTheDocument(); // IP (180 outs = 60.0)
    expect(screen.getByText("20")).toBeInTheDocument(); // BB
    expect(screen.getByText("25")).toBeInTheDocument(); // ER
    expect(screen.getByText("28")).toBeInTheDocument(); // R
    expect(screen.getByText("3.75")).toBeInTheDocument(); // ERA
    expect(screen.getAllByText("65").length).toBeGreaterThanOrEqual(1); // K (also total ER)
    expect(screen.getByText("1.25")).toBeInTheDocument(); // WHIP
  });

  it("renders total row with team totals", () => {
    render(
      <RosterPitchersTable
        players={mockPitchers}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument(); // total G
    expect(screen.getByText("30")).toBeInTheDocument(); // total GS
    expect(screen.getByText("150.0")).toBeInTheDocument(); // IP (450 outs = 150.0)
    expect(screen.getByText("55")).toBeInTheDocument(); // total BB
    expect(screen.getAllByText("65").length).toBeGreaterThanOrEqual(1); // total ER (also player K)
    expect(screen.getByText("72")).toBeInTheDocument(); // total R
    expect(screen.getByText("3.90")).toBeInTheDocument(); // ERA
    expect(screen.getByText("150")).toBeInTheDocument(); // K
    expect(screen.getByText("1.30")).toBeInTheDocument(); // WHIP
  });

  it("links player names to detail page", () => {
    render(
      <RosterPitchersTable
        players={[mockPitchers[0]]}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: mockPitchers[0].name });
    expect(link).toHaveAttribute("href", `/players/${mockPitchers[0].id}`);
  });

  it("displays placeholder when stats are missing", () => {
    const emptyStatsMap = new Map<number, AggregatedPitcherStats>();

    render(
      <RosterPitchersTable
        players={[mockPitchers[0]]}
        pitcherStatsMap={emptyStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    // Should show "—" for missing stats
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("renders IL icon when player has il_type", () => {
    const ilPlayer = { ...mockPitchers[0], id: 99, name: "IL Pitcher", il_type: "60-Day IL", il_date: "2026-01-10" };
    render(
      <RosterPitchersTable
        players={[ilPlayer]}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const svgs = document.querySelectorAll("svg.text-destructive");
    expect(svgs.length).toBe(1);
  });

  it("playoff column set shows window IP, series cap, starts, and eligibility", () => {
    const playoffMeta = new Map([
      [mockPitchers[0].id, { windowIPOuts: 60, seriesIPOutsCap: 27, windowGS: 3, windowCG: 0, playoffStarts: 2 as const, willPlay: true }],
      [mockPitchers[1].id, { windowIPOuts: 0, seriesIPOutsCap: 0, windowGS: 0, windowCG: 0, playoffStarts: 0 as const, willPlay: false }],
    ]);
    render(
      <RosterPitchersTable
        players={[mockPitchers[0], mockPitchers[1]]}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
        columnSet="playoff"
        playoffMeta={playoffMeta}
      />
    );

    expect(screen.getByRole("columnheader", { name: /Sep IP/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Ser IP/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Starts/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^GS/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^ER\b/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /ERA/ })).toBeInTheDocument();

    const eligibleRow = screen.getByText(mockPitchers[0].name).closest("tr")!;
    expect(eligibleRow).toHaveTextContent("20.0"); // 60 outs window IP
    expect(eligibleRow).toHaveTextContent("9.0"); // 27 outs series cap
    expect(screen.getByText("OUT")).toBeInTheDocument();
    const ineligibleRow = screen.getByText(mockPitchers[1].name).closest("tr")!;
    expect(ineligibleRow.className).toContain("opacity-50");
  });

  it("lineupRoles shows rotation numbers and relievers with a Starters row", () => {
    const roles = new Map([
      [mockPitchers[0].id, { source: "scoresheet" as const, slotVsR: null, slotVsL: null, positionVsR: null, positionVsL: null, rotationNo: 2, isReliever: false }],
      [mockPitchers[1].id, { source: "scoresheet" as const, slotVsR: null, slotVsL: null, positionVsR: null, positionVsL: null, rotationNo: null, isReliever: true }],
    ]);
    render(
      <RosterPitchersTable
        players={[mockPitchers[0], mockPitchers[1]]}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        starterTotals={{ ...mockTeamTotals, ERA: 2.5 }}
        lineupRoles={roles}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );
    expect(screen.getByRole("columnheader", { name: /Lineup/ })).toBeInTheDocument();
    expect(screen.getByText("SP2")).toBeInTheDocument();
    expect(screen.getByText("RP")).toBeInTheDocument();
    expect(screen.getByText("Starters").closest("tr")).toHaveTextContent("2.50");
  });
});
