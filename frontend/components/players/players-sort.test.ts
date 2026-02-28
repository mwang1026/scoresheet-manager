import { describe, it, expect } from "vitest";
import { compareHitters, comparePitchers } from "./players-sort";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

// Minimal player stubs
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    name: "Test Player",
    mlb_id: 1,
    scoresheet_id: 1,
    primary_position: "1B",
    hand: "R",
    age: 28,
    current_team: "NYY",
    team_id: null,
    eligible_1b: 1.0,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: null,
    osb_al: null,
    ocs_al: null,
    ba_vr: null,
    ob_vr: null,
    sl_vr: null,
    ba_vl: null,
    ob_vl: null,
    sl_vl: null,
    il_type: null,
    il_date: null,
    ...overrides,
  };
}

function makeHitterStats(overrides: Partial<AggregatedHitterStats> = {}): AggregatedHitterStats {
  return {
    PA: 0, AB: 0, H: 0, "1B": 0, "2B": 0, "3B": 0, HR: 0, SO: 0, GO: 0, FO: 0,
    GDP: 0, BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 0, RBI: 0, SF: 0, SH: 0,
    AVG: null, OBP: null, SLG: null, OPS: null,
    ...overrides,
  };
}

function makePitcherStats(overrides: Partial<AggregatedPitcherStats> = {}): AggregatedPitcherStats {
  return {
    G: 0, GS: 0, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs: 0,
    W: 0, L: 0, ER: 0, R: 0, BF: 0, H: 0, BB: 0, IBB: 0, HBP: 0,
    K: 0, HR: 0, WP: 0, BK: 0, ERA: null, WHIP: null, K9: null,
    ...overrides,
  };
}

describe("compareHitters", () => {
  it("sorts by name ascending", () => {
    const a = makePlayer({ name: "Aaron Judge" });
    const b = makePlayer({ name: "Zach Neto" });
    expect(compareHitters(a, b, undefined, undefined, "name", "asc")).toBeLessThan(0);
    expect(compareHitters(b, a, undefined, undefined, "name", "asc")).toBeGreaterThan(0);
  });

  it("reverses order when direction is desc", () => {
    const a = makePlayer({ name: "Aaron Judge" });
    const b = makePlayer({ name: "Zach Neto" });
    expect(compareHitters(a, b, undefined, undefined, "name", "desc")).toBeGreaterThan(0);
  });

  it("sorts by numeric stat (PA) ascending", () => {
    const a = makePlayer({ id: 1 });
    const b = makePlayer({ id: 2 });
    const aStats = makeHitterStats({ PA: 100 });
    const bStats = makeHitterStats({ PA: 200 });
    expect(compareHitters(a, b, aStats, bStats, "PA", "asc")).toBeLessThan(0);
    expect(compareHitters(b, a, bStats, aStats, "PA", "asc")).toBeGreaterThan(0);
  });

  it("sorts by numeric stat (HR) descending", () => {
    const a = makePlayer({ id: 1 });
    const b = makePlayer({ id: 2 });
    const aStats = makeHitterStats({ HR: 30 });
    const bStats = makeHitterStats({ HR: 10 });
    // desc: higher HR first → a before b
    expect(compareHitters(a, b, aStats, bStats, "HR", "desc")).toBeLessThan(0);
  });

  it("null stats sort to bottom regardless of direction", () => {
    const a = makePlayer({ id: 1 });
    const b = makePlayer({ id: 2 });
    const aStats = makeHitterStats({ OPS: 0.800 });
    // b has no stats
    expect(compareHitters(a, b, aStats, undefined, "OPS", "desc")).toBeLessThan(0);
    expect(compareHitters(b, a, undefined, aStats, "OPS", "desc")).toBeGreaterThan(0);
  });

  it("null values sort to bottom — both null returns 0", () => {
    const a = makePlayer({ id: 1 });
    const b = makePlayer({ id: 2 });
    const aStats = makeHitterStats({ OPS: null });
    const bStats = makeHitterStats({ OPS: null });
    expect(compareHitters(a, b, aStats, bStats, "OPS", "desc")).toBe(0);
  });

  it("handles unknown column gracefully", () => {
    const a = makePlayer({ id: 1 });
    const b = makePlayer({ id: 2 });
    // Unknown column → both values are 0 → equal
    expect(compareHitters(a, b, undefined, undefined, "UNKNOWN", "asc")).toBe(0);
  });
});

describe("comparePitchers", () => {
  it("sorts by ERA ascending (lower is better when sorted asc)", () => {
    const a = makePlayer({ id: 1, primary_position: "P" });
    const b = makePlayer({ id: 2, primary_position: "P" });
    const aStats = makePitcherStats({ ERA: 2.50 });
    const bStats = makePitcherStats({ ERA: 4.00 });
    expect(comparePitchers(a, b, aStats, bStats, "ERA", "asc")).toBeLessThan(0);
  });

  it("sorts by K descending", () => {
    const a = makePlayer({ id: 1, primary_position: "P" });
    const b = makePlayer({ id: 2, primary_position: "P" });
    const aStats = makePitcherStats({ K: 200 });
    const bStats = makePitcherStats({ K: 150 });
    // desc: higher K first → a before b
    expect(comparePitchers(a, b, aStats, bStats, "K", "desc")).toBeLessThan(0);
  });

  it("null ERA sorts to bottom", () => {
    const a = makePlayer({ id: 1, primary_position: "P" });
    const b = makePlayer({ id: 2, primary_position: "P" });
    const aStats = makePitcherStats({ ERA: 3.00 });
    const bStats = makePitcherStats({ ERA: null });
    expect(comparePitchers(a, b, aStats, bStats, "ERA", "asc")).toBeLessThan(0);
    expect(comparePitchers(b, a, bStats, aStats, "ERA", "asc")).toBeGreaterThan(0);
  });

  it("sorts by name", () => {
    const a = makePlayer({ id: 1, name: "Ace Pitcher", primary_position: "P" });
    const b = makePlayer({ id: 2, name: "Zeke Pitcher", primary_position: "P" });
    expect(comparePitchers(a, b, undefined, undefined, "name", "asc")).toBeLessThan(0);
  });
});
