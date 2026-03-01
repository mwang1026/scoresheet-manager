import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RosterHittersTable } from "./roster-hitters-table";
import { players } from "@/lib/fixtures";
import type { AggregatedHitterStats } from "@/lib/stats";

describe("RosterHittersTable", () => {
  const mockHitters = players.filter((p) => p.primary_position !== "P");
  const mockStatsMap = new Map<number, AggregatedHitterStats>();

  mockStatsMap.set(mockHitters[0].id, {
    PA: 100,
    AB: 90,
    H: 27,
    "1B": 18,
    "2B": 6,
    "3B": 1,
    HR: 2,
    SO: 20,
    GO: 15,
    FO: 10,
    GDP: 2,
    BB: 8,
    IBB: 0,
    HBP: 2,
    SB: 3,
    CS: 1,
    R: 15,
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
    HR: 12,
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

  it("renders heading with player count", () => {
    render(
      <RosterHittersTable
        players={mockHitters}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("My Hitters")).toBeInTheDocument();
    // Badge count is rendered as a separate span inside SectionPanel header
    const badge = screen.getByText("My Hitters").querySelector(".font-mono");
    expect(badge).toHaveTextContent(`${mockHitters.length}`);
  });

  it("renders hitter stat columns", () => {
    render(
      <RosterHittersTable
        players={mockHitters}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Pos")).toBeInTheDocument();
    expect(screen.getByText("PA")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("RBI")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("SB")).toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByText("OBP")).toBeInTheDocument();
    expect(screen.getByText("SLG")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();
  });

  it("renders player rows with stats", () => {
    render(
      <RosterHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText(mockHitters[0].name)).toBeInTheDocument();
    expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1); // PA
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(1); // R (also total SB)
    expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1); // RBI
    expect(screen.getByText("2")).toBeInTheDocument(); // HR
    expect(screen.getByText("3")).toBeInTheDocument(); // SB
    expect(screen.getByText("0.300")).toBeInTheDocument(); // AVG
    expect(screen.getByText("0.370")).toBeInTheDocument(); // OBP
    expect(screen.getByText("0.433")).toBeInTheDocument(); // SLG
    expect(screen.getByText("0.803")).toBeInTheDocument(); // OPS
  });

  it("renders total row with team totals", () => {
    render(
      <RosterHittersTable
        players={mockHitters}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getAllByText("500").length).toBeGreaterThanOrEqual(1); // PA total
    expect(screen.getByText("70")).toBeInTheDocument(); // R
    expect(screen.getByText("65")).toBeInTheDocument(); // RBI
    expect(screen.getByText("0.267")).toBeInTheDocument(); // AVG
    expect(screen.getByText("0.331")).toBeInTheDocument(); // OBP
    expect(screen.getByText("0.400")).toBeInTheDocument(); // SLG
    expect(screen.getByText("0.731")).toBeInTheDocument(); // OPS
  });

  it("links player names to detail page", () => {
    render(
      <RosterHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: mockHitters[0].name });
    expect(link).toHaveAttribute("href", `/players/${mockHitters[0].id}`);
  });

  it("displays placeholder when stats are missing", () => {
    const emptyStatsMap = new Map<number, AggregatedHitterStats>();

    render(
      <RosterHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={emptyStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    // Should show "—" for missing numeric stats
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("renders IL icon when player has il_type", () => {
    const ilPlayer = { ...mockHitters[0], id: 99, name: "IL Hitter", il_type: "10-Day IL", il_date: "2026-02-14" };
    render(
      <RosterHittersTable
        players={[ilPlayer]}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
        getNote={vi.fn(() => "")}
        saveNote={vi.fn()}
      />
    );

    const svgs = document.querySelectorAll("svg.text-destructive");
    expect(svgs.length).toBe(1);
  });
});
