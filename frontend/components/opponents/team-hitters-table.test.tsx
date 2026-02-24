import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamHittersTable } from "./team-hitters-table";
import { players } from "@/lib/fixtures";
import type { AggregatedHitterStats } from "@/lib/stats";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("TeamHittersTable", () => {
  const mockHitters = players.filter(
    (p) => p.primary_position !== "P" && p.primary_position !== "SR"
  );
  const mockStatsMap = new Map<number, AggregatedHitterStats>();

  mockStatsMap.set(mockHitters[0].id, {
    PA: 100,
    AB: 90,
    H: 27,
    "1B": 18,
    "2B": 6,
    "3B": 1,
    HR: 5,
    SO: 20,
    GO: 15,
    FO: 10,
    GDP: 2,
    BB: 8,
    IBB: 0,
    HBP: 2,
    SB: 3,
    CS: 1,
    R: 11,
    RBI: 12,
    SF: 0,
    SH: 0,
    AVG: 0.3,
    OBP: 0.37,
    SLG: 0.433,
    OPS: 0.803,
  });

  const mockTeamTotals: AggregatedHitterStats = {
    PA: 500,
    AB: 450,
    H: 120,
    "1B": 80,
    "2B": 25,
    "3B": 3,
    HR: 20,
    SO: 100,
    GO: 75,
    FO: 50,
    GDP: 10,
    BB: 40,
    IBB: 2,
    HBP: 8,
    SB: 15,
    CS: 5,
    R: 70,
    RBI: 65,
    SF: 2,
    SH: 0,
    AVG: 0.267,
    OBP: 0.331,
    SLG: 0.4,
    OPS: 0.731,
  };

  it("renders hitter stat columns", () => {
    render(
      <TeamHittersTable
        players={mockHitters}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("RBI")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("SB")).toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByText("OBP")).toBeInTheDocument();
    expect(screen.getByText("SLG")).toBeInTheDocument();
  });

  it("renders player rows with stats", () => {
    render(
      <TeamHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    expect(screen.getByText(mockHitters[0].name)).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument(); // R
    expect(screen.getByText("12")).toBeInTheDocument(); // RBI
    expect(screen.getByText("5")).toBeInTheDocument(); // HR
    expect(screen.getByText("3")).toBeInTheDocument(); // SB
    expect(screen.getByText("0.300")).toBeInTheDocument(); // AVG
    expect(screen.getByText("0.370")).toBeInTheDocument(); // OBP
    expect(screen.getByText("0.433")).toBeInTheDocument(); // SLG
  });

  it("renders total row with team totals", () => {
    render(
      <TeamHittersTable
        players={mockHitters}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("70").length).toBeGreaterThanOrEqual(1); // R total
    expect(screen.getByText("65")).toBeInTheDocument(); // RBI total
    expect(screen.getByText("0.267")).toBeInTheDocument(); // AVG total
    expect(screen.getByText("0.331")).toBeInTheDocument(); // OBP total
    expect(screen.getByText("0.400")).toBeInTheDocument(); // SLG total
  });

  it("links player names to detail page", () => {
    render(
      <TeamHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    const link = screen.getByRole("link", { name: mockHitters[0].name });
    expect(link).toHaveAttribute("href", `/players/${mockHitters[0].id}`);
  });

  it("displays placeholder when stats are missing", () => {
    const emptyStatsMap = new Map<number, AggregatedHitterStats>();

    render(
      <TeamHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={emptyStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });
});
