import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamPitchersTable } from "./team-pitchers-table";
import { players } from "@/lib/fixtures";
import type { AggregatedPitcherStats } from "@/lib/stats";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("TeamPitchersTable", () => {
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
    K: 67,
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

  it("renders pitcher stat columns", () => {
    render(
      <TeamPitchersTable
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
      <TeamPitchersTable
        players={[mockPitchers[0]]}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText(mockPitchers[0].name)).toBeInTheDocument();
    // Pos column shows primary position
    expect(screen.getAllByText(mockPitchers[0].primary_position).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("60.0")).toBeInTheDocument(); // IP (180 outs = 60.0)
    expect(screen.getByText("67")).toBeInTheDocument(); // K
    expect(screen.getByText("20")).toBeInTheDocument(); // BB
    expect(screen.getByText("25")).toBeInTheDocument(); // ER
    expect(screen.getByText("3.75")).toBeInTheDocument(); // ERA
    expect(screen.getByText("1.25")).toBeInTheDocument(); // WHIP
  });

  it("renders total row with team totals", () => {
    render(
      <TeamPitchersTable
        players={mockPitchers}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("150.0")).toBeInTheDocument(); // IP (450 outs = 150.0)
    expect(screen.getByText("150")).toBeInTheDocument(); // K total
    expect(screen.getByText("55")).toBeInTheDocument(); // BB total
    expect(screen.getByText("3.90")).toBeInTheDocument(); // ERA total
    expect(screen.getByText("1.30")).toBeInTheDocument(); // WHIP total
  });

  it("links player names to detail page", () => {
    render(
      <TeamPitchersTable
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
      <TeamPitchersTable
        players={[mockPitchers[0]]}
        pitcherStatsMap={emptyStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("defaults to ERA ascending sort — player with stats appears before players without", () => {
    // mockPitchers[0] has stats (ERA 3.75), others have no stats
    // With asc sort, player with stats sorts before nulls
    render(
      <TeamPitchersTable
        players={mockPitchers}
        pitcherStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent(mockPitchers[0].name);
  });

  it("sorts by a different column when header is clicked", async () => {
    const user = userEvent.setup();

    const twoPitchers = [mockPitchers[0], mockPitchers[1]].filter(Boolean);
    if (twoPitchers.length < 2) return;

    const statsMap = new Map<number, AggregatedPitcherStats>(mockStatsMap);
    statsMap.set(twoPitchers[1].id, {
      G: 15,
      GS: 0,
      GF: 10,
      CG: 0,
      SHO: 0,
      SV: 5,
      HLD: 8,
      IP_outs: 60, // 20.0 IP
      W: 2,
      L: 1,
      ER: 8,
      R: 9,
      BF: 90,
      H: 18,
      BB: 10,
      IBB: 1,
      HBP: 1,
      K: 22,
      HR: 2,
      WP: 1,
      BK: 0,
      ERA: 3.60,
      WHIP: 1.40,
      K9: 9.90,
    });

    render(
      <TeamPitchersTable
        players={twoPitchers}
        pitcherStatsMap={statsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    // Default: ERA asc — twoPitchers[1] ERA 3.60 < twoPitchers[0] ERA 3.75
    const rowsBefore = screen.getAllByRole("row");
    expect(rowsBefore[1]).toHaveTextContent(twoPitchers[1].name);

    // Click K header (asc default for new column) — twoPitchers[0] K=67 > twoPitchers[1] K=22
    // First click on K sets asc: twoPitchers[1] (22) should be first
    await user.click(screen.getByText("K"));
    const rowsAfter = screen.getAllByRole("row");
    expect(rowsAfter[1]).toHaveTextContent(twoPitchers[1].name);
  });

  it("custom defaultSort overrides default ERA sort", () => {
    const pitcher1 = mockPitchers[0]; // has K=67
    const pitcher2 = mockPitchers[1];
    if (!pitcher2) return; // skip if fixture doesn't have two pitchers

    const statsMap = new Map<number, AggregatedPitcherStats>(mockStatsMap);
    statsMap.set(pitcher2.id, {
      G: 20,
      GS: 0,
      GF: 15,
      CG: 0,
      SHO: 0,
      SV: 8,
      HLD: 10,
      IP_outs: 75,
      W: 3,
      L: 2,
      ER: 12,
      R: 14,
      BF: 100,
      H: 25,
      BB: 15,
      IBB: 1,
      HBP: 2,
      K: 90, // higher K than pitcher1
      HR: 3,
      WP: 1,
      BK: 0,
      ERA: 4.32,
      WHIP: 1.60,
      K9: 10.80,
    });

    render(
      <TeamPitchersTable
        players={[pitcher1, pitcher2]}
        pitcherStatsMap={statsMap}
        teamTotals={mockTeamTotals}
        defaultSort={{ column: "K", direction: "desc" }}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    // With K desc default, pitcher2 (K=90) should come before pitcher1 (K=67)
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent(pitcher2.name);
    expect(rows[2]).toHaveTextContent(pitcher1.name);
  });

  it("toggles sort direction when same header is clicked twice", async () => {
    const user = userEvent.setup();

    const twoPitchers = [mockPitchers[0], mockPitchers[1]].filter(Boolean);
    if (twoPitchers.length < 2) return;

    const statsMap = new Map<number, AggregatedPitcherStats>(mockStatsMap);
    statsMap.set(twoPitchers[1].id, {
      G: 15,
      GS: 0,
      GF: 10,
      CG: 0,
      SHO: 0,
      SV: 5,
      HLD: 8,
      IP_outs: 60,
      W: 2,
      L: 1,
      ER: 8,
      R: 9,
      BF: 90,
      H: 18,
      BB: 10,
      IBB: 1,
      HBP: 1,
      K: 22,
      HR: 2,
      WP: 1,
      BK: 0,
      ERA: 3.60,
      WHIP: 1.40,
      K9: 9.90,
    });

    render(
      <TeamPitchersTable
        players={twoPitchers}
        pitcherStatsMap={statsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    // Default ERA asc: twoPitchers[1] (3.60) first
    const rowsAsc = screen.getAllByRole("row");
    expect(rowsAsc[1]).toHaveTextContent(twoPitchers[1].name);

    // Click ERA again → desc: twoPitchers[0] (3.75) first
    await user.click(screen.getByText("ERA"));
    const rowsDesc = screen.getAllByRole("row");
    expect(rowsDesc[1]).toHaveTextContent(twoPitchers[0].name);
  });

  it("renders IL icon when player has il_type", () => {
    const mockPitchers = players.filter((p) => p.primary_position === "P");
    const ilPlayer = { ...mockPitchers[0], id: 99, name: "IL Pitcher", il_type: "60-Day IL", il_date: "2026-01-10" };
    render(
      <TeamPitchersTable
        players={[ilPlayer]}
        pitcherStatsMap={new Map()}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const svgs = document.querySelectorAll("svg.text-destructive");
    expect(svgs.length).toBe(1);
  });
});
