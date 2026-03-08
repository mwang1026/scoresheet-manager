import { describe, it, expect } from "vitest";
import { getTopAvailableByPosition } from "./available-players";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import { makeHitter, makePitcher, makeHitterStats, makePitcherStats } from "./__test-helpers__";

describe("getTopAvailableByPosition", () => {
  it("returns top 5 hitters by OPS desc for hitter positions", () => {
    // 7 free agent outfielders — should return top 5 by OPS
    const players = Array.from({ length: 7 }, (_, i) =>
      makeHitter({
        id: i + 1,
        name: `OF-${i + 1}`,
        team_id: null,
        eligible_of: 2.50,
      }),
    );

    const hitterStats = new Map<number, AggregatedHitterStats>();
    players.forEach((p, i) => hitterStats.set(p.id, makeHitterStats(0.700 + i * 0.020)));

    const result = getTopAvailableByPosition(players, hitterStats, new Map());
    const cof = result.get("COF")!;

    expect(cof).toHaveLength(5);
    // Sorted desc: OF-7 (.840), OF-6 (.820), OF-5 (.800), OF-4 (.780), OF-3 (.760)
    expect(cof[0].name).toBe("OF-7");
    expect(cof[4].name).toBe("OF-3");
  });

  it("returns top 5 pitchers by ERA asc for pitcher positions", () => {
    const players = Array.from({ length: 7 }, (_, i) =>
      makePitcher({
        id: i + 1,
        name: `SP-${i + 1}`,
        team_id: null,
        hand: "R",
      }),
    );

    const pitcherStats = new Map<number, AggregatedPitcherStats>();
    players.forEach((p, i) => pitcherStats.set(p.id, makePitcherStats(2.50 + i * 0.30)));

    const result = getTopAvailableByPosition(players, new Map(), pitcherStats);
    const pr = result.get("P-R")!;

    expect(pr).toHaveLength(5);
    // Sorted asc: SP-1 (2.50), SP-2 (2.80), SP-3 (3.10), SP-4 (3.40), SP-5 (3.70)
    expect(pr[0].name).toBe("SP-1");
    expect(pr[4].name).toBe("SP-5");
  });

  it("excludes rostered players (team_id !== null)", () => {
    const players = [
      makeHitter({ id: 1, name: "Rostered", team_id: 5, primary_position: "C" }),
      makeHitter({ id: 2, name: "Free Agent", team_id: null, primary_position: "C" }),
    ];

    const hitterStats = new Map<number, AggregatedHitterStats>();
    hitterStats.set(1, makeHitterStats(0.900));
    hitterStats.set(2, makeHitterStats(0.700));

    const result = getTopAvailableByPosition(players, hitterStats, new Map());
    const catchers = result.get("C")!;

    expect(catchers).toHaveLength(1);
    expect(catchers[0].name).toBe("Free Agent");
  });

  it("respects position eligibility (SS-eligible not in 2B)", () => {
    const players = [
      makeHitter({
        id: 1,
        name: "SS Only",
        team_id: null,
        primary_position: "SS",
        eligible_ss: 4.80,
      }),
    ];

    const hitterStats = new Map<number, AggregatedHitterStats>();
    hitterStats.set(1, makeHitterStats(0.800));

    const result = getTopAvailableByPosition(players, hitterStats, new Map());

    expect(result.get("SS")!).toHaveLength(1);
    expect(result.get("2B")!).toHaveLength(0);
  });

  it("respects CF threshold", () => {
    const players = [
      makeHitter({ id: 1, name: "Good CF", team_id: null, eligible_of: 3.50 }),
      makeHitter({ id: 2, name: "Bad CF", team_id: null, eligible_of: 2.00 }),
    ];

    const hitterStats = new Map<number, AggregatedHitterStats>();
    hitterStats.set(1, makeHitterStats(0.800));
    hitterStats.set(2, makeHitterStats(0.750));

    const result = getTopAvailableByPosition(players, hitterStats, new Map());

    const cf = result.get("CF")!;
    expect(cf).toHaveLength(1);
    expect(cf[0].name).toBe("Good CF");

    // Bad CF should still appear in COF
    const cof = result.get("COF")!;
    expect(cof.map((p) => p.name)).toContain("Bad CF");
  });

  it("pitcher positions filter by hand and role (P-L gets only LHP starters)", () => {
    const players = [
      makePitcher({ id: 1, name: "LHP-SP", team_id: null, hand: "L", primary_position: "P" }),
      makePitcher({ id: 2, name: "RHP-SP", team_id: null, hand: "R", primary_position: "P" }),
      makePitcher({ id: 3, name: "LHP-RP", team_id: null, hand: "L", primary_position: "SR" }),
      makePitcher({ id: 4, name: "RHP-RP", team_id: null, hand: "R", primary_position: "SR" }),
    ];

    const pitcherStats = new Map<number, AggregatedPitcherStats>();
    players.forEach((p) => pitcherStats.set(p.id, makePitcherStats(3.50)));

    const result = getTopAvailableByPosition(players, new Map(), pitcherStats);

    expect(result.get("P-L")!.map((p) => p.name)).toEqual(["LHP-SP"]);
    expect(result.get("P-R")!.map((p) => p.name)).toEqual(["RHP-SP"]);
    expect(result.get("SR-L")!.map((p) => p.name)).toEqual(["LHP-RP"]);
    expect(result.get("SR-R")!.map((p) => p.name)).toEqual(["RHP-RP"]);
  });

  it("returns empty array when no eligible free agents", () => {
    const result = getTopAvailableByPosition([], new Map(), new Map());

    expect(result.get("C")!).toHaveLength(0);
    expect(result.get("SS")!).toHaveLength(0);
    expect(result.get("P-L")!).toHaveLength(0);
    expect(result.get("SR-R")!).toHaveLength(0);
  });

  it("hitter entries include correct opsVsL and opsVsR", () => {
    const players = [
      makeHitter({
        id: 1,
        name: "Splits Guy",
        team_id: null,
        primary_position: "1B",
        eligible_1b: 1.90,
        ob_vl: 20,
        sl_vl: 30,
        ob_vr: -10,
        sl_vr: -15,
      }),
    ];

    const hitterStats = new Map<number, AggregatedHitterStats>();
    hitterStats.set(1, makeHitterStats(0.800));

    const result = getTopAvailableByPosition(players, hitterStats, new Map());
    const fb = result.get("1B")!;

    expect(fb).toHaveLength(1);
    const entry = fb[0];
    expect(entry.type).toBe("hitter");
    if (entry.type === "hitter") {
      // opsVsL = 0.800 + (20 + 30) / 1000 = 0.850
      expect(entry.opsVsL).toBeCloseTo(0.850, 3);
      // opsVsR = 0.800 + (-10 + -15) / 1000 = 0.775
      expect(entry.opsVsR).toBeCloseTo(0.775, 3);
    }
  });

  it("excludes pitchers from hitter positions", () => {
    const players = [
      makePitcher({ id: 1, name: "Starter", team_id: null }),
      makePitcher({ id: 2, name: "Reliever", team_id: null, primary_position: "SR" }),
      makeHitter({ id: 3, name: "Real Hitter", team_id: null, primary_position: "DH" }),
    ];

    const hitterStats = new Map<number, AggregatedHitterStats>();
    hitterStats.set(1, makeHitterStats(0.600));
    hitterStats.set(2, makeHitterStats(0.500));
    hitterStats.set(3, makeHitterStats(0.750));

    const result = getTopAvailableByPosition(players, hitterStats, new Map());
    const dh = result.get("DH")!;

    // Only the real hitter should appear at DH, not pitchers
    expect(dh).toHaveLength(1);
    expect(dh[0].name).toBe("Real Hitter");
  });
});
