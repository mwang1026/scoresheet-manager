import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
      />
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
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
      />
    );

    expect(screen.getByText(mockPitchers[0].name)).toBeInTheDocument();
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
      />
    );

    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });
});
