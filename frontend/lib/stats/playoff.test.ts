import { describe, it, expect } from "vitest";
import type { HitterDailyStats, PitcherDailyStats } from "../types";
import {
  PLAYOFF_WINDOW_WEIGHT,
  computePlayoffHitterStats,
  computePlayoffPitcherStats,
  formatPlayoffWindow,
  getPlayoffStatsMaps,
  isInPlayoffWindow,
  playoffStartsFor,
  scaleDailyRow,
} from "./playoff";
import { getPlayoffWindow } from "../defaults";

const WINDOW = getPlayoffWindow(2026); // 2026-08-31 .. 2026-09-27

function hitterRow(date: string, overrides: Partial<HitterDailyStats> = {}): HitterDailyStats {
  return {
    player_id: 1,
    date,
    PA: 4, AB: 4, H: 1, "1B": 1, "2B": 0, "3B": 0, HR: 0, SO: 1, GO: 1, FO: 1, GDP: 0,
    BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 0, RBI: 0, SF: 0, SH: 0,
    ...overrides,
  };
}

function pitcherRow(date: string, overrides: Partial<PitcherDailyStats> = {}): PitcherDailyStats {
  return {
    player_id: 9,
    date,
    G: 1, GS: 0, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs: 3, W: 0, L: 0, ER: 0, R: 0,
    BF: 4, H: 1, BB: 0, IBB: 0, HBP: 0, K: 1, HR: 0, WP: 0, BK: 0,
    ...overrides,
  };
}

/** n identical hitter rows, one per day starting at `start`. */
function days(start: string, n: number, make: (date: string) => HitterDailyStats): HitterDailyStats[] {
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    return make(dt.toISOString().slice(0, 10));
  });
}

describe("getPlayoffWindow / isInPlayoffWindow", () => {
  it("2026 window is Aug 31 through Sep 27 inclusive", () => {
    expect(WINDOW).toEqual({ start: "2026-08-31", end: "2026-09-27" });
    expect(isInPlayoffWindow("2026-08-30", WINDOW)).toBe(false);
    expect(isInPlayoffWindow("2026-08-31", WINDOW)).toBe(true);
    expect(isInPlayoffWindow("2026-09-27", WINDOW)).toBe(true);
    expect(isInPlayoffWindow("2026-09-28", WINDOW)).toBe(false);
  });

  it("formats the window for display", () => {
    expect(formatPlayoffWindow(WINDOW)).toBe("Aug 31 – Sep 27");
  });
});

describe("scaleDailyRow", () => {
  it("multiplies counting fields and leaves player_id and date alone", () => {
    const scaled = scaleDailyRow(hitterRow("2026-09-01", { PA: 4, H: 2 }), 3.33);
    expect(scaled.player_id).toBe(1);
    expect(scaled.date).toBe("2026-09-01");
    expect(scaled.PA).toBeCloseTo(13.32);
    expect(scaled.H).toBeCloseTo(6.66);
  });
});

describe("computePlayoffHitterStats", () => {
  it("uses 3.33 as the window weight", () => {
    expect(PLAYOFF_WINDOW_WEIGHT).toBe(3.33);
  });

  it("full-time all year: window counts ~38% of the line", () => {
    // 22 pre-window days at 1-for-4 (.250) and 4 window days at 4-for-4 (1.000)
    const pre = days("2026-08-01", 22, (d) => hitterRow(d, { PA: 4, AB: 4, H: 1, "1B": 1 }));
    const win = days("2026-09-01", 4, (d) => hitterRow(d, { PA: 4, AB: 4, H: 4, "1B": 4, SO: 0, GO: 0, FO: 0 }));
    const { stats, meta } = computePlayoffHitterStats([...pre, ...win], WINDOW);

    const weightedWindowAB = 16 * 3.33;
    const expectedAvg = (22 + 16 * 3.33) / (88 + weightedWindowAB);
    expect(stats.AVG).toBeCloseTo(expectedAvg, 6);
    // Window share of the weighted PA
    expect(weightedWindowAB / (88 + weightedWindowAB)).toBeCloseTo(0.377, 2);
    expect(meta).toEqual({ windowPA: 16, seriesPACap: 6, willPlay: true });
  });

  it("September-only player: the line is exactly his window rates", () => {
    const win = days("2026-09-01", 5, (d) => hitterRow(d, { PA: 4, AB: 3, H: 1, "1B": 0, "2B": 1, BB: 1 }));
    const { stats, meta } = computePlayoffHitterStats(win, WINDOW);
    expect(stats.AVG).toBeCloseTo(1 / 3, 6);
    expect(stats.OBP).toBeCloseTo(2 / 4, 6);
    expect(stats.SLG).toBeCloseTo(2 / 3, 6);
    expect(stats.PA).toBeCloseTo(20 * 3.33, 6);
    expect(meta).toEqual({ windowPA: 20, seriesPACap: 8, willPlay: true });
  });

  it("one week before the window, full window: window dominates (~93%)", () => {
    const pre = days("2026-08-24", 7, (d) => hitterRow(d, { PA: 4, AB: 4, H: 0, "1B": 0 }));
    const win = days("2026-08-31", 28, (d) => hitterRow(d, { PA: 4, AB: 4, H: 4, "1B": 4 }));
    const { stats } = computePlayoffHitterStats([...pre, ...win], WINDOW);
    const share = (112 * 3.33) / (28 + 112 * 3.33);
    expect(share).toBeGreaterThan(0.92);
    expect(stats.AVG).toBeCloseTo(share, 6);
  });

  it("full year, one window week: rates stay near season, cap is tiny", () => {
    const pre = days("2026-04-01", 140, (d) => hitterRow(d, { PA: 4, AB: 4, H: 1, "1B": 1 }));
    const win = days("2026-08-31", 7, (d) => hitterRow(d, { PA: 4, AB: 4, H: 4, "1B": 4 }));
    const { stats, meta } = computePlayoffHitterStats([...pre, ...win], WINDOW);
    const share = (28 * 3.33) / (560 + 28 * 3.33);
    expect(share).toBeLessThan(0.15);
    expect(stats.AVG).toBeCloseTo(0.25 * (1 - share) + 1 * share, 6);
    expect(meta.windowPA).toBe(28);
    expect(meta.seriesPACap).toBe(11); // round(28 * 0.4)
    expect(meta.willPlay).toBe(true);
  });

  it("zero window PA: will not play, season line still computed", () => {
    const pre = days("2026-05-01", 10, (d) => hitterRow(d));
    const { stats, meta } = computePlayoffHitterStats(pre, WINDOW);
    expect(meta).toEqual({ windowPA: 0, seriesPACap: 0, willPlay: false });
    expect(stats.PA).toBe(40);
  });

  it("games after the window end are ignored entirely", () => {
    const rows = [
      hitterRow("2026-09-27", { PA: 4, AB: 4, H: 4, "1B": 4 }),
      hitterRow("2026-09-28", { PA: 4, AB: 4, H: 0, "1B": 0 }), // tiebreaker game, does not count
    ];
    const { stats, meta } = computePlayoffHitterStats(rows, WINDOW);
    expect(stats.AVG).toBe(1);
    expect(meta.windowPA).toBe(4);
  });

  it("no rows: null rates and no playing time", () => {
    const { stats, meta } = computePlayoffHitterStats([], WINDOW);
    expect(stats.AVG).toBeNull();
    expect(meta.willPlay).toBe(false);
  });
});

describe("computePlayoffPitcherStats", () => {
  it("weights ER and outs, caps IP at 45% and derives start eligibility", () => {
    const pre = [pitcherRow("2026-06-01", { GS: 1, IP_outs: 18, ER: 6 })]; // 6.0 IP, 6 ER -> 9.00
    const win = [
      pitcherRow("2026-09-01", { GS: 1, IP_outs: 18, ER: 0 }),
      pitcherRow("2026-09-06", { GS: 1, IP_outs: 18, ER: 0 }),
      pitcherRow("2026-09-11", { GS: 1, IP_outs: 27, ER: 0, CG: 1 }),
    ];
    const { stats, meta } = computePlayoffPitcherStats([...pre, ...win], WINDOW);
    const weightedOuts = 18 + 63 * 3.33;
    expect(stats.ERA).toBeCloseTo((6 / (weightedOuts / 3)) * 9, 6);
    expect(meta).toEqual({
      windowIPOuts: 63,
      seriesIPOutsCap: Math.round(63 * 0.45),
      windowGS: 3,
      windowCG: 1,
      playoffStarts: 2,
      willPlay: true,
    });
  });

  it("start eligibility thresholds", () => {
    expect(playoffStartsFor(0)).toBe(0);
    expect(playoffStartsFor(1)).toBe(1);
    expect(playoffStartsFor(2)).toBe(1);
    expect(playoffStartsFor(3)).toBe(2);
    expect(playoffStartsFor(7)).toBe(2);
  });

  it("reliever with no window innings but batters faced still plays", () => {
    const win = [pitcherRow("2026-09-10", { IP_outs: 0, BF: 1, H: 1 })];
    const { meta } = computePlayoffPitcherStats(win, WINDOW);
    expect(meta.willPlay).toBe(true);
    expect(meta.playoffStarts).toBe(0);
  });

  it("no window appearances: will not play", () => {
    const { meta } = computePlayoffPitcherStats([pitcherRow("2026-07-01")], WINDOW);
    expect(meta.willPlay).toBe(false);
    expect(meta.seriesIPOutsCap).toBe(0);
  });
});

describe("getPlayoffStatsMaps", () => {
  it("groups rows by player and returns stats + meta maps", () => {
    const hitters = [
      hitterRow("2026-09-01", { player_id: 1 }),
      hitterRow("2026-05-01", { player_id: 1 }),
      hitterRow("2026-05-01", { player_id: 2 }),
    ];
    const pitchers = [pitcherRow("2026-09-01", { player_id: 9, GS: 1 })];
    const maps = getPlayoffStatsMaps(hitters, pitchers, 2026);

    expect([...maps.hitterStatsMap.keys()].sort()).toEqual([1, 2]);
    expect(maps.hitterMetaMap.get(1)?.willPlay).toBe(true);
    expect(maps.hitterMetaMap.get(2)?.willPlay).toBe(false);
    expect(maps.hitterStatsMap.get(1)?.PA).toBeCloseTo(4 + 4 * 3.33, 6);
    expect(maps.pitcherMetaMap.get(9)?.playoffStarts).toBe(1);
    expect(maps.pitcherStatsMap.get(9)?.GS).toBeCloseTo(3.33, 6);
  });

  it("empty input yields empty maps", () => {
    const maps = getPlayoffStatsMaps([], [], 2026);
    expect(maps.hitterStatsMap.size).toBe(0);
    expect(maps.pitcherMetaMap.size).toBe(0);
  });
});
