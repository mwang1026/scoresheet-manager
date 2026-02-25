import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      <TeamHittersTable
        players={[mockHitters[0]]}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    expect(screen.getByText(mockHitters[0].name)).toBeInTheDocument();
    // Pos column shows primary position
    expect(screen.getByText(mockHitters[0].primary_position, { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1); // PA
    expect(screen.getByText("11")).toBeInTheDocument(); // R
    expect(screen.getByText("12")).toBeInTheDocument(); // RBI
    expect(screen.getByText("5")).toBeInTheDocument(); // HR
    expect(screen.getByText("3")).toBeInTheDocument(); // SB
    expect(screen.getByText("0.300")).toBeInTheDocument(); // AVG
    expect(screen.getByText("0.370")).toBeInTheDocument(); // OBP
    expect(screen.getByText("0.433")).toBeInTheDocument(); // SLG
    expect(screen.getByText("0.803")).toBeInTheDocument(); // OPS
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
    expect(screen.getAllByText("500").length).toBeGreaterThanOrEqual(1); // PA total
    expect(screen.getAllByText("70").length).toBeGreaterThanOrEqual(1); // R total
    expect(screen.getByText("65")).toBeInTheDocument(); // RBI total
    expect(screen.getByText("0.267")).toBeInTheDocument(); // AVG total
    expect(screen.getByText("0.331")).toBeInTheDocument(); // OBP total
    expect(screen.getByText("0.400")).toBeInTheDocument(); // SLG total
    expect(screen.getByText("0.731")).toBeInTheDocument(); // OPS total
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

  it("defaults to OPS descending sort — player with stats appears before players without", () => {
    // mockHitters[0] has stats (OPS 0.803), others have no stats
    // With desc sort, player with highest OPS should come first
    render(
      <TeamHittersTable
        players={mockHitters}
        hitterStatsMap={mockStatsMap}
        teamTotals={mockTeamTotals}
      />
    );

    const rows = screen.getAllByRole("row");
    // First data row (index 1 after header) should be mockHitters[0]
    expect(rows[1]).toHaveTextContent(mockHitters[0].name);
  });

  it("sorts by a different column when header is clicked", async () => {
    const user = userEvent.setup();

    // Give two players stats so sort order is meaningful
    const twoPlayers = [mockHitters[0], mockHitters[1]].filter(Boolean);
    if (twoPlayers.length < 2) return; // skip if fixture doesn't have two hitters

    const statsMap = new Map<number, AggregatedHitterStats>(mockStatsMap);
    statsMap.set(twoPlayers[1].id, {
      PA: 80,
      AB: 72,
      H: 15,
      "1B": 12,
      "2B": 2,
      "3B": 0,
      HR: 2,
      SO: 25,
      GO: 18,
      FO: 12,
      GDP: 3,
      BB: 6,
      IBB: 0,
      HBP: 1,
      SB: 10,
      CS: 2,
      R: 20,
      RBI: 8,
      SF: 1,
      SH: 0,
      AVG: 0.208,
      OBP: 0.271,
      SLG: 0.292,
      OPS: 0.563,
    });

    render(
      <TeamHittersTable
        players={twoPlayers}
        hitterStatsMap={statsMap}
        teamTotals={mockTeamTotals}
      />
    );

    // Default: OPS desc — twoPlayers[0] (OPS 0.803) should be first
    const rowsBefore = screen.getAllByRole("row");
    expect(rowsBefore[1]).toHaveTextContent(twoPlayers[0].name);

    // Click SB header — SB desc: twoPlayers[1] has SB=10 > twoPlayers[0] SB=3
    await user.click(screen.getByText("SB"));
    const rowsAfter = screen.getAllByRole("row");
    expect(rowsAfter[1]).toHaveTextContent(twoPlayers[1].name);
  });

  it("custom defaultSort overrides default OPS sort", () => {
    // Two players: one with high HR, one with high OPS
    const player1 = mockHitters[0]; // has OPS 0.803, HR 5
    const player2 = mockHitters[1];
    if (!player2) return; // skip if fixture doesn't have two hitters

    const statsMap = new Map<number, AggregatedHitterStats>(mockStatsMap);
    statsMap.set(player2.id, {
      PA: 100,
      AB: 90,
      H: 20,
      "1B": 10,
      "2B": 4,
      "3B": 0,
      HR: 15, // higher HR than player1
      SO: 25,
      GO: 15,
      FO: 10,
      GDP: 2,
      BB: 8,
      IBB: 0,
      HBP: 2,
      SB: 1,
      CS: 0,
      R: 18,
      RBI: 20,
      SF: 0,
      SH: 0,
      AVG: 0.222,
      OBP: 0.29,
      SLG: 0.5,
      OPS: 0.79, // lower OPS than player1
    });

    render(
      <TeamHittersTable
        players={[player1, player2]}
        hitterStatsMap={statsMap}
        teamTotals={mockTeamTotals}
        defaultSort={{ column: "HR", direction: "desc" }}
      />
    );

    // With HR desc default, player2 (HR=15) should come before player1 (HR=5)
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent(player2.name);
    expect(rows[2]).toHaveTextContent(player1.name);
  });

  it("toggles sort direction when same header is clicked twice", async () => {
    const user = userEvent.setup();

    const twoPlayers = [mockHitters[0], mockHitters[1]].filter(Boolean);
    if (twoPlayers.length < 2) return;

    const statsMap = new Map<number, AggregatedHitterStats>(mockStatsMap);
    statsMap.set(twoPlayers[1].id, {
      PA: 80,
      AB: 72,
      H: 15,
      "1B": 12,
      "2B": 2,
      "3B": 0,
      HR: 2,
      SO: 25,
      GO: 18,
      FO: 12,
      GDP: 3,
      BB: 6,
      IBB: 0,
      HBP: 1,
      SB: 10,
      CS: 2,
      R: 20,
      RBI: 8,
      SF: 1,
      SH: 0,
      AVG: 0.208,
      OBP: 0.271,
      SLG: 0.292,
      OPS: 0.563,
    });

    render(
      <TeamHittersTable
        players={twoPlayers}
        hitterStatsMap={statsMap}
        teamTotals={mockTeamTotals}
      />
    );

    // Click OPS (already active desc) → toggles to asc
    await user.click(screen.getByText("OPS"));
    const rowsAsc = screen.getAllByRole("row");
    // asc: lowest OPS first → twoPlayers[1] (0.563)
    expect(rowsAsc[1]).toHaveTextContent(twoPlayers[1].name);

    // Click OPS again → back to desc
    await user.click(screen.getByText("OPS"));
    const rowsDesc = screen.getAllByRole("row");
    expect(rowsDesc[1]).toHaveTextContent(twoPlayers[0].name);
  });
});
