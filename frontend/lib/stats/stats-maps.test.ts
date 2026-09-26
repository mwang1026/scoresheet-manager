import { describe, it, expect } from "vitest";
import type { HitterDailyStats, PitcherDailyStats, Projection } from "../types";
import {
  aggregateRosterHitters,
  aggregateRosterPitchers,
  buildStatsMaps,
  pickPlayers,
} from "./stats-maps";
import { aggregateHitterStats } from "./aggregation";

function hitterRow(player_id: number, date: string, H: number): HitterDailyStats {
  return {
    player_id, date,
    PA: 4, AB: 4, H, "1B": H, "2B": 0, "3B": 0, HR: 0, SO: 0, GO: 0, FO: 0, GDP: 0,
    BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 0, RBI: 0, SF: 0, SH: 0,
  };
}

function pitcherRow(player_id: number, date: string, ER: number): PitcherDailyStats {
  return {
    player_id, date,
    G: 1, GS: 1, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs: 9, W: 0, L: 0, ER, R: ER,
    BF: 12, H: 2, BB: 1, IBB: 0, HBP: 0, K: 3, HR: 0, WP: 0, BK: 0,
  };
}

const projections: Projection[] = [
  {
    player_id: 1, source: "PECOTA-50", player_type: "hitter",
    PA: 600, AB: 540, H: 150, "1B": 100, "2B": 30, "3B": 2, HR: 18, BB: 50, IBB: 0, HBP: 5,
    SO: 120, SB: 10, CS: 3, R: 80, RBI: 75, SF: 5, SH: 0, GO: 0, FO: 0, GDP: 0,
  } as unknown as Projection,
];

const base = {
  projectionSource: "PECOTA-50",
  projections,
  hitterRows: [hitterRow(1, "2026-05-01", 1), hitterRow(1, "2026-09-01", 4), hitterRow(2, "2026-09-01", 0)],
  pitcherRows: [pitcherRow(9, "2026-05-01", 3), pitcherRow(9, "2026-09-01", 0)],
  seasonYear: 2026,
};

describe("buildStatsMaps", () => {
  it("actual: plain aggregation, no playoff meta", () => {
    const maps = buildStatsMaps({ ...base, statsSource: "actual" });
    expect(maps.hitterStatsMap.get(1)?.PA).toBe(8);
    expect(maps.hitterStatsMap.get(1)?.AVG).toBeCloseTo(5 / 8, 6);
    expect(maps.pitcherStatsMap.get(9)?.ERA).toBeCloseTo((3 / 6) * 9, 6);
    expect(maps.playoffHitterMeta.size).toBe(0);
    expect(maps.playoffPitcherMeta.size).toBe(0);
  });

  it("projected: uses the projection source, ignores rows", () => {
    const maps = buildStatsMaps({ ...base, statsSource: "projected" });
    expect(maps.hitterStatsMap.get(1)?.PA).toBe(600);
    expect(maps.hitterStatsMap.has(2)).toBe(false);
    expect(maps.pitcherStatsMap.size).toBe(0);
    expect(maps.playoffHitterMeta.size).toBe(0);
  });

  it("playoff: weighted lines plus meta maps", () => {
    const maps = buildStatsMaps({ ...base, statsSource: "playoff" });
    expect(maps.hitterStatsMap.get(1)?.PA).toBeCloseTo(4 + 4 * 3.33, 6);
    expect(maps.playoffHitterMeta.get(1)).toEqual({ windowPA: 4, seriesPACap: 2, willPlay: true });
    expect(maps.playoffHitterMeta.get(2)?.windowPA).toBe(4);
    expect(maps.playoffPitcherMeta.get(9)?.playoffStarts).toBe(1);
    // Window ER=0 weighted, pre ER=3 -> ERA drops below season ERA
    expect(maps.pitcherStatsMap.get(9)!.ERA!).toBeLessThan((3 / 6) * 9);
  });

  it("tolerates undefined inputs", () => {
    const maps = buildStatsMaps({
      statsSource: "actual", projectionSource: "", projections: undefined,
      hitterRows: undefined, pitcherRows: undefined, seasonYear: 2026,
    });
    expect(maps.hitterStatsMap.size).toBe(0);
    expect(buildStatsMaps({ ...base, hitterRows: undefined, statsSource: "playoff" }).hitterStatsMap.size).toBe(0);
  });
});

describe("aggregateRosterHitters / Pitchers", () => {
  it("re-aggregating per-player lines equals aggregating the daily rows", () => {
    const maps = buildStatsMaps({ ...base, statsSource: "actual" });
    const fromMap = aggregateRosterHitters([{ id: 1 }, { id: 2 }, { id: 99 }], maps.hitterStatsMap);
    const fromRows = aggregateHitterStats(base.hitterRows);
    expect(fromMap).toEqual(fromRows);
  });

  it("skips players without stats and handles empty rosters", () => {
    const maps = buildStatsMaps({ ...base, statsSource: "actual" });
    expect(aggregateRosterHitters([{ id: 99 }], maps.hitterStatsMap).PA).toBe(0);
    expect(aggregateRosterPitchers([], maps.pitcherStatsMap).ERA).toBeNull();
    expect(aggregateRosterPitchers([{ id: 9 }], maps.pitcherStatsMap).IP_outs).toBe(18);
  });
});

describe("pickPlayers", () => {
  it("restricts a map to the given players", () => {
    const map = new Map([[1, "a"], [2, "b"], [3, "c"]]);
    const picked = pickPlayers([{ id: 1 }, { id: 3 }, { id: 7 }], map);
    expect([...picked.entries()]).toEqual([[1, "a"], [3, "c"]]);
  });
});
