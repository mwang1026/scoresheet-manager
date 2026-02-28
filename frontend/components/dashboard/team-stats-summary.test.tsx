import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamStatsSummary } from "./team-stats-summary";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

describe("TeamStatsSummary", () => {
  const mockHitterStats: AggregatedHitterStats = {
    PA: 1000,
    AB: 900,
    H: 250,
    "1B": 165,
    "2B": 50,
    "3B": 5,
    HR: 30,
    SO: 200,
    GO: 150,
    FO: 120,
    GDP: 15,
    R: 120,
    RBI: 115,
    BB: 80,
    IBB: 5,
    HBP: 10,
    SF: 5,
    SH: 0,
    SB: 25,
    CS: 8,
    AVG: 0.278,
    OBP: 0.350,
    SLG: 0.456,
    OPS: 0.806,
  };

  const mockPitcherStats: AggregatedPitcherStats = {
    G: 162,
    GS: 32,
    GF: 50,
    CG: 2,
    SHO: 1,
    IP_outs: 288 * 3, // 288.0 IP
    W: 15,
    L: 12,
    K: 250,
    ER: 100,
    R: 110,
    BF: 3600,
    H: 280,
    BB: 80,
    IBB: 5,
    HBP: 10,
    SV: 10,
    HLD: 20,
    WP: 8,
    BK: 1,
    HR: 25,
    ERA: 3.13,
    WHIP: 1.25,
    K9: 7.81,
  };

  it("should render team stats summary heading", () => {
    render(<TeamStatsSummary hitterStats={mockHitterStats} pitcherStats={mockPitcherStats} />);
    expect(screen.getByText("Team Stats Summary")).toBeInTheDocument();
  });

  it("should render hitting section heading", () => {
    render(<TeamStatsSummary hitterStats={mockHitterStats} pitcherStats={mockPitcherStats} />);
    expect(screen.getByText("Hitting")).toBeInTheDocument();
  });

  it("should render pitching section heading", () => {
    render(<TeamStatsSummary hitterStats={mockHitterStats} pitcherStats={mockPitcherStats} />);
    expect(screen.getByText("Pitching")).toBeInTheDocument();
  });

  it("should display hitter stats with correct formatting", () => {
    render(<TeamStatsSummary hitterStats={mockHitterStats} pitcherStats={mockPitcherStats} />);
    expect(screen.getByText("0.278")).toBeInTheDocument();
    expect(screen.getByText("0.350")).toBeInTheDocument();
    expect(screen.getByText("0.806")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument(); // HR
    expect(screen.getByText("25")).toBeInTheDocument(); // SB
    expect(screen.getByText("120")).toBeInTheDocument(); // R
    expect(screen.getByText("115")).toBeInTheDocument(); // RBI
  });

  it("should display pitcher stats with correct formatting", () => {
    render(<TeamStatsSummary hitterStats={mockHitterStats} pitcherStats={mockPitcherStats} />);
    expect(screen.getByText("3.13")).toBeInTheDocument(); // ERA
    expect(screen.getByText("1.25")).toBeInTheDocument(); // WHIP
    expect(screen.getByText("7.81")).toBeInTheDocument(); // K9
    expect(screen.getByText("288.0")).toBeInTheDocument(); // IP
    expect(screen.getByText("15-12")).toBeInTheDocument(); // W-L
    expect(screen.getByText("10")).toBeInTheDocument(); // SV
  });
});
