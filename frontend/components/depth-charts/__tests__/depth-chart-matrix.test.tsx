import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DepthChartMatrix } from "../depth-chart-matrix";
import type {
  DepthChartTeam,
  DepthChartPlayer,
  DepthChartPosition,
} from "@/lib/depth-charts/types";
import { DEPTH_CHART_POSITIONS } from "@/lib/depth-charts/types";

// Suppress React act() warnings in test output
vi.spyOn(console, "error").mockImplementation(() => {});

function makePlayer(overrides: Partial<DepthChartPlayer> & { id: number; name: string }): DepthChartPlayer {
  return {
    role: "LR",
    isPrimary: true,
    stat: 0.800,
    statVsL: 0.820,
    statVsR: 0.780,
    defRating: null,
    defDiff: null,
    inMaxDEF: false,
    maxDEFPosition: null,
    type: "hitter",
    hand: "R",
    pa: 500,
    hr: 20,
    ops: 0.800,
    opsL: 0.820,
    opsR: 0.780,
    ...overrides,
  };
}

function makeEmptyRoster(): Record<DepthChartPosition, DepthChartPlayer[]> {
  const roster = {} as Record<DepthChartPosition, DepthChartPlayer[]>;
  for (const pos of DEPTH_CHART_POSITIONS) {
    roster[pos] = [];
  }
  return roster;
}

function makeTeam(overrides: Partial<DepthChartTeam> & { id: number; name: string }): DepthChartTeam {
  return {
    isMyTeam: false,
    vL: 0.780,
    vR: 0.750,
    spEra: 3.50,
    defVsL: null,
    defVsR: null,
    defLate: null,
    pickPosition: 5,
    lineupGaps: 0,
    roster: makeEmptyRoster(),
    ...overrides,
  };
}

describe("DepthChartMatrix", () => {
  it("renders all 12 position rows", () => {
    const team = makeTeam({ id: 1, name: "Test Team" });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    // Some position labels also appear in depth dots, so use getAllByText
    for (const pos of DEPTH_CHART_POSITIONS) {
      expect(screen.getAllByText(pos).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders all team columns", () => {
    const teams = [
      makeTeam({ id: 1, name: "Alpha Team" }),
      makeTeam({ id: 2, name: "Beta Team" }),
    ];
    render(<DepthChartMatrix statsSource="projected" teams={teams} viewMode="combined" />);

    expect(screen.getByText("Alpha Team")).toBeDefined();
    expect(screen.getByText("Beta Team")).toBeDefined();
  });

  it("shows OPS for hitters in combined view", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [makePlayer({ id: 1, name: "Witt", stat: 0.895, ops: 0.895 })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    expect(screen.getByText(".895")).toBeDefined();
  });

  it("shows OPS vs LHP in vsL view", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [makePlayer({
      id: 1, name: "Witt", stat: 0.895, statVsL: 0.910,
      role: "LR", ops: 0.895, opsL: 0.910,
    })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="vsL" />);

    expect(screen.getByText(".910")).toBeDefined();
  });

  it("shows ERA for pitchers regardless of view mode", () => {
    const roster = makeEmptyRoster();
    roster["P-R"] = [makePlayer({
      id: 1, name: "Cole", type: "pitcher", stat: 2.85, era: 2.85,
    })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="vsL" />);

    expect(screen.getByText("2.85")).toBeDefined();
  });

  it("hides bench hitters in vsL view", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [
      makePlayer({ id: 1, name: "Starter", role: "LR" }),
      makePlayer({ id: 2, name: "Bench Guy", role: "bench" }),
    ];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="vsL" />);

    expect(screen.getByText("Starter")).toBeDefined();
    expect(screen.queryByText("Bench Guy")).toBeNull();
  });

  it("hides R-only hitters in vsL view", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [
      makePlayer({ id: 1, name: "Both", role: "LR" }),
      makePlayer({ id: 2, name: "R Only", role: "R" }),
    ];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="vsL" />);

    expect(screen.getByText("Both")).toBeDefined();
    expect(screen.queryByText("R Only")).toBeNull();
  });

  it("hides L-only hitters in vsR view", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [
      makePlayer({ id: 1, name: "Both", role: "LR" }),
      makePlayer({ id: 2, name: "L Only", role: "L" }),
    ];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="vsR" />);

    expect(screen.getByText("Both")).toBeDefined();
    expect(screen.queryByText("L Only")).toBeNull();
  });

  it("renders multi-pos duplicate with reduced opacity", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [makePlayer({ id: 1, name: "Multi", isPrimary: false })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    const { container } = render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    const multiPosEntry = container.querySelector(".opacity-45");
    expect(multiPosEntry).not.toBeNull();
  });

  it("renders bench player with muted styling", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [makePlayer({ id: 1, name: "Bench", role: "bench" })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    const { container } = render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    const benchEntry = container.querySelector(".text-muted-foreground");
    expect(benchEntry).not.toBeNull();
  });

  it("shows positive defense diff in teal", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [makePlayer({
      id: 1, name: "Defender", defRating: 5.50, defDiff: 0.75,
    })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    expect(screen.getByText("+0.75")).toBeDefined();
  });

  it("shows negative defense diff in terracotta", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [makePlayer({
      id: 1, name: "Bad D", defRating: 4.00, defDiff: -0.75,
    })];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    expect(screen.getByText("-0.75")).toBeDefined();
  });

  it("shows defense baseline under position label", () => {
    const team = makeTeam({ id: 1, name: "Team" });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    // SS baseline is 4.75
    expect(screen.getByText("4.75")).toBeDefined();
    // 2B baseline is 4.25
    expect(screen.getByText("4.25")).toBeDefined();
  });

  it("renders depth dots in team header", () => {
    const team = makeTeam({ id: 1, name: "Team", pickPosition: 3 });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="combined" />);

    expect(screen.getByText("Pick: 3rd")).toBeDefined();
  });

  it("DEF view shows only player at maxDEFPosition", () => {
    const roster = makeEmptyRoster();
    roster["SS"] = [
      makePlayer({ id: 1, name: "DEF Starter", maxDEFPosition: "SS", inMaxDEF: true }),
      makePlayer({ id: 2, name: "Bench Guy", maxDEFPosition: null, inMaxDEF: false }),
    ];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="def" />);

    expect(screen.getByText("DEF Starter")).toBeDefined();
    expect(screen.queryByText("Bench Guy")).toBeNull();
  });

  it("DEF view hides player at wrong position", () => {
    const roster = makeEmptyRoster();
    // Player's maxDEFPosition is 2B, but they appear in the SS row too
    roster["SS"] = [
      makePlayer({ id: 1, name: "Multi Pos", maxDEFPosition: "2B", inMaxDEF: true }),
    ];
    roster["2B"] = [
      makePlayer({ id: 1, name: "Multi Pos", maxDEFPosition: "2B", inMaxDEF: true }),
    ];

    const team = makeTeam({ id: 1, name: "Team", roster });
    render(<DepthChartMatrix statsSource="projected" teams={[team]} viewMode="def" />);

    // Should appear once (at 2B), not at SS
    const entries = screen.getAllByText("Multi Pos");
    expect(entries.length).toBe(1);
  });
});
