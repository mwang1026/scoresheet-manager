import { describe, it, expect } from "vitest";
import { buildRoleMap } from "./roles";
import { computeStarterHitterTotals, computeStarterPitcherTotals, computeStarterTotals } from "./starter-totals";
import { aggregateHitterStats, aggregatePitcherStats } from "../stats/aggregation";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import type { TeamLineup } from "../types";

function hitterLine(PA: number, H: number): AggregatedHitterStats {
  return aggregateHitterStats([{
    player_id: 0, date: "2026-05-01",
    PA, AB: PA, H, "1B": H, "2B": 0, "3B": 0, HR: 0, SO: 0, GO: 0, FO: 0, GDP: 0,
    BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 0, RBI: 0, SF: 0, SH: 0,
  }]);
}

function pitcherLine(IP_outs: number, ER: number): AggregatedPitcherStats {
  return aggregatePitcherStats([{
    player_id: 0, date: "2026-05-01",
    G: 1, GS: 1, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs, W: 0, L: 0, ER, R: ER,
    BF: IP_outs, H: 0, BB: 0, IBB: 0, HBP: 0, K: 0, HR: 0, WP: 0, BK: 0,
  }]);
}

const lineup: TeamLineup = {
  team_id: 1, games: 6, unknown_hand_games: 0,
  vs_rhp: [
    { slot: 0, position: "SS", pin: 1, player_id: 1 },
    { slot: 1, position: "1B", pin: 2, player_id: 2 },
  ],
  vs_lhp: null,
  rotation: [1, 2, 3, 4, 5].map((n) => ({ pin: n, player_id: 20 + n, games: 1 })),
  relievers: [{ pin: 9, player_id: 30, games: 2 }],
};
const roles = buildRoleMap(lineup);

describe("computeStarterHitterTotals", () => {
  const hitters = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const map = new Map([
    [1, hitterLine(400, 100)], // .250
    [2, hitterLine(400, 200)], // .500
    [3, hitterLine(400, 400)], // bench: ignored
  ]);

  it("outside playoff mode: sums starters' lines", () => {
    const { stats, count } = computeStarterHitterTotals(hitters, roles, map);
    expect(count).toBe(2);
    expect(stats.PA).toBe(800);
    expect(stats.AVG).toBeCloseTo(300 / 800, 6);
  });

  it("playoff mode: weights each starter by his series PA cap", () => {
    const meta = new Map([
      [1, { windowPA: 100, seriesPACap: 40, willPlay: true }],
      [2, { windowPA: 25, seriesPACap: 10, willPlay: true }],
    ]);
    const { stats, count } = computeStarterHitterTotals(hitters, roles, map, meta);
    expect(count).toBe(2);
    expect(stats.PA).toBeCloseTo(50, 6);
    // AVG = (40*.25 + 10*.5) / 50 = .300
    expect(stats.AVG).toBeCloseTo(0.3, 6);
  });

  it("playoff mode: a starter who will not play contributes nothing", () => {
    const meta = new Map([
      [1, { windowPA: 100, seriesPACap: 40, willPlay: true }],
      [2, { windowPA: 0, seriesPACap: 0, willPlay: false }],
    ]);
    const { stats } = computeStarterHitterTotals(hitters, roles, map, meta);
    expect(stats.PA).toBeCloseTo(40, 6);
    expect(stats.AVG).toBeCloseTo(0.25, 6);
  });

  it("no roles or stats: empty aggregate", () => {
    const { stats, count } = computeStarterHitterTotals(hitters, new Map(), map);
    expect(count).toBe(0);
    expect(stats.AVG).toBeNull();
    expect(computeStarterHitterTotals([{ id: 1 }], roles, new Map()).count).toBe(0);
  });
});

describe("computeStarterPitcherTotals", () => {
  const pitchers = [21, 22, 23, 24, 25, 30, 31].map((id) => ({ id }));
  const map = new Map([
    [21, pitcherLine(90, 10)], [22, pitcherLine(90, 10)], [23, pitcherLine(90, 10)], [24, pitcherLine(90, 10)],
    [25, pitcherLine(90, 0)], // fifth starter: excluded (four-man playoff rotation)
    [30, pitcherLine(30, 0)], // reliever
    [31, pitcherLine(30, 20)], // not in lineup
  ]);

  it("uses the first four starters plus relievers", () => {
    const { stats, count } = computeStarterPitcherTotals(pitchers, roles, map);
    expect(count).toBe(5);
    expect(stats.IP_outs).toBe(390);
    expect(stats.ER).toBe(40);
  });

  it("playoff mode: scales each pitcher to his series IP cap", () => {
    const meta = new Map(
      [21, 22, 23, 24, 30].map((id) => [id, {
        windowIPOuts: 60, seriesIPOutsCap: id === 30 ? 6 : 27, windowGS: 3, windowCG: 0,
        playoffStarts: 2 as const, willPlay: true,
      }])
    );
    const { stats } = computeStarterPitcherTotals(pitchers, roles, map, meta);
    expect(stats.IP_outs).toBeCloseTo(4 * 27 + 6, 6);
    // Each SP: 10 ER over 90 outs scaled to 27 outs = 3 ER
    expect(stats.ER).toBeCloseTo(12, 6);
    expect(stats.ERA).toBeCloseTo((12 / (114 / 3)) * 9, 6);
  });
});

describe("computeStarterTotals", () => {
  it("combines both sides", () => {
    const totals = computeStarterTotals(
      [{ id: 1 }], [{ id: 21 }], roles,
      new Map([[1, hitterLine(10, 5)]]), new Map([[21, pitcherLine(30, 1)]])
    );
    expect(totals.hitterCount).toBe(1);
    expect(totals.pitcherCount).toBe(1);
    expect(totals.hitters.AVG).toBeCloseTo(0.5, 6);
    expect(totals.pitchers.ERA).toBeCloseTo(0.9, 6);
  });
});
