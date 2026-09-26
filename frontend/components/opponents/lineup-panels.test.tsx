import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BattingOrderPanel, PitchingPanel } from "./lineup-panels";
import { players } from "@/lib/fixtures";
import { aggregateHitterStats, aggregatePitcherStats } from "@/lib/stats";
import type { Player } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const hitters = players.filter((p) => p.primary_position !== "P").slice(0, 3);
const pitchers = players.filter((p) => p.primary_position === "P").slice(0, 5);
const playerMap = new Map<number, Player>([
  ...hitters.map((p): [number, Player] => [p.id, { ...p, team_id: 1 }]),
  ...pitchers.map((p, i): [number, Player] => [p.id, { ...p, team_id: i === 4 ? 2 : 1 }]),
]);

const hitterStatsMap = new Map([[hitters[0].id, aggregateHitterStats([{
  player_id: hitters[0].id, date: "2026-06-01",
  PA: 10, AB: 10, H: 5, "1B": 5, "2B": 0, "3B": 0, HR: 0, SO: 0, GO: 0, FO: 0, GDP: 0,
  BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 0, RBI: 0, SF: 0, SH: 0,
}])]]);
const pitcherStatsMap = new Map([[pitchers[0].id, aggregatePitcherStats([{
  player_id: pitchers[0].id, date: "2026-06-01",
  G: 1, GS: 1, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs: 27, W: 0, L: 0, ER: 3, R: 3,
  BF: 36, H: 6, BB: 3, IBB: 0, HBP: 0, K: 9, HR: 1, WP: 0, BK: 0,
}])]]);

describe("BattingOrderPanel", () => {
  const slots = [
    { slot: 0, position: "SS", pin: 1, player_id: hitters[0].id },
    { slot: 1, position: "LF", pin: 2201, player_id: null },
    { slot: 2, position: "DH", pin: 3, player_id: hitters[1].id },
  ];

  it("renders slots with position, linked names, OPS, and AAA fill-ins", () => {
    render(<BattingOrderPanel title="vs RHP" slots={slots} teamId={1} playerMap={playerMap} hitterStatsMap={hitterStatsMap} />);
    expect(screen.getByText("vs RHP")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("SS")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", `/players/${hitters[0].id}`);
    expect(within(rows[0]).getByText("1.000")).toBeInTheDocument();
    expect(within(rows[1]).getByText("AAA fill-in")).toBeInTheDocument();
    expect(within(rows[2]).getByText("---")).toBeInTheDocument(); // no stats
    expect(screen.queryByText("Ser PA")).not.toBeInTheDocument();
  });

  it("shows series PA caps and OUT in playoff mode", () => {
    const meta = new Map([
      [hitters[0].id, { windowPA: 100, seriesPACap: 40, willPlay: true }],
      [hitters[1].id, { windowPA: 0, seriesPACap: 0, willPlay: false }],
    ]);
    render(<BattingOrderPanel title="vs RHP" slots={slots} teamId={1} playerMap={playerMap} hitterStatsMap={hitterStatsMap} playoffMeta={meta} />);
    expect(screen.getByText("Ser PA")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("OUT")).toBeInTheDocument();
    expect(screen.getByText(hitters[1].name).closest("tr")!.className).toContain("opacity-50");
  });

  it("explains a missing lineup for one hand", () => {
    render(<BattingOrderPanel title="vs LHP" slots={null} teamId={1} playerMap={playerMap} hitterStatsMap={hitterStatsMap} />);
    expect(screen.getByText(/No games against this hand/)).toBeInTheDocument();
  });
});

describe("PitchingPanel", () => {
  const rotation = pitchers.map((p, i) => ({ pin: 100 + i, player_id: p.id, games: i === 0 ? 2 : 1 }));

  it("renders the rotation, mutes the fifth starter, and flags moved players", () => {
    render(<PitchingPanel title="Rotation" pitchers={rotation} isRotation teamId={1} playerMap={playerMap} pitcherStatsMap={pitcherStatsMap} emptyMessage="none" />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText("2")).toBeInTheDocument(); // games
    expect(within(rows[0]).getByText("1.00")).toBeInTheDocument(); // ERA 3 ER / 9 IP
    expect(rows[4].className).toContain("opacity-50");
    expect(within(rows[4]).getByText("moved")).toBeInTheDocument();
    expect(screen.queryByText("Starts")).not.toBeInTheDocument();
  });

  it("adds Ser IP and Starts columns in playoff mode", () => {
    const meta = new Map([[pitchers[0].id, { windowIPOuts: 60, seriesIPOutsCap: 27, windowGS: 3, windowCG: 0, playoffStarts: 2 as const, willPlay: true }]]);
    render(<PitchingPanel title="Rotation" pitchers={rotation.slice(0, 1)} isRotation teamId={1} playerMap={playerMap} pitcherStatsMap={pitcherStatsMap} playoffMeta={meta} emptyMessage="none" />);
    expect(screen.getByText("Ser IP")).toBeInTheDocument();
    expect(screen.getByText("Starts")).toBeInTheDocument();
    expect(screen.getByText("9.0")).toBeInTheDocument();
  });

  it("shows the empty message for an empty bullpen", () => {
    render(<PitchingPanel title="Bullpen" pitchers={[]} isRotation={false} teamId={1} playerMap={playerMap} pitcherStatsMap={pitcherStatsMap} emptyMessage="No relievers" />);
    expect(screen.getByText("No relievers")).toBeInTheDocument();
  });
});
