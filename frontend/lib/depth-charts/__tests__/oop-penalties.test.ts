import { describe, it, expect } from "vitest";
import {
  getOOPRating,
  getValidOOPTargets,
  OOP_BASE_RATINGS,
} from "../oop-penalties";
import type { Player } from "../../types";

/** Helper to create a minimal Player object for testing */
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    first_name: "Test",
    last_name: "Player",
    name: "Test Player",
    mlb_id: 100,
    scoresheet_id: 100,
    primary_position: "SS",
    hand: "R",
    age: 25,
    current_team: "TST",
    team_id: null,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: 4.75,
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
    oop_positions: [],
    ...overrides,
  };
}

describe("getOOPRating", () => {
  it("returns null when no valid source->target path exists", () => {
    // SS player can't play C via OOP
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.75 });
    expect(getOOPRating(player, "C")).toBeNull();
  });

  it("calculates SS -> OF with multiplier", () => {
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.75 });
    // base = 2.07, multiplier = 4.75 / 4.75 = 1.0
    const rating = getOOPRating(player, "OF");
    expect(rating).toBeCloseTo(2.07, 2);
  });

  it("calculates SS -> OF with above-average defense", () => {
    const player = makePlayer({ primary_position: "SS", eligible_ss: 5.00 });
    // base = 2.07, multiplier = 5.00 / 4.75 = 1.0526
    const rating = getOOPRating(player, "OF");
    expect(rating).toBeCloseTo(2.07 * (5.0 / 4.75), 2);
  });

  it("calculates SS -> OF with below-average defense", () => {
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.00 });
    // base = 2.07, multiplier = 4.00 / 4.75 = 0.8421
    const rating = getOOPRating(player, "OF");
    expect(rating).toBeCloseTo(2.07 * (4.0 / 4.75), 2);
  });

  it("picks best route for multi-position player (SS/3B -> OF)", () => {
    // SS(5.00) also eligible at 3B(2.80)
    const player = makePlayer({
      primary_position: "SS",
      eligible_ss: 5.00,
      eligible_3b: 2.80,
    });
    // Via SS: 2.07 × (5.00 / 4.75) = 2.18
    // Via 3B: 2.01 × (2.80 / 2.65) = 2.12
    const rating = getOOPRating(player, "OF");
    const viaSS = 2.07 * (5.00 / 4.75);
    const via3B = 2.01 * (2.80 / 2.65);
    expect(rating).toBeCloseTo(Math.max(viaSS, via3B), 2);
    expect(rating).toBeCloseTo(viaSS, 2); // SS route should win
  });

  it("handles C -> 1B (no defense fields, uses base directly)", () => {
    const player = makePlayer({ primary_position: "C", eligible_ss: null });
    const rating = getOOPRating(player, "1B");
    expect(rating).toBeCloseTo(1.73, 2);
  });

  it("handles C -> OF (no defense fields, uses base directly)", () => {
    const player = makePlayer({ primary_position: "C", eligible_ss: null });
    const rating = getOOPRating(player, "OF");
    expect(rating).toBeCloseTo(1.93, 2);
  });

  it("handles DH -> 1B (no defense fields)", () => {
    const player = makePlayer({ primary_position: "DH", eligible_ss: null });
    const rating = getOOPRating(player, "1B");
    expect(rating).toBeCloseTo(1.70, 2);
  });

  it("handles infielder -> 1B fallback (no explicit entry in OOP_BASE_RATINGS)", () => {
    // SS -> 1B isn't in the base ratings, but falls back to DEFENSE_AVERAGES["1B"] = 1.85
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.75 });
    const rating = getOOPRating(player, "1B");
    // base = 1.85, multiplier = 4.75 / 4.75 = 1.0
    expect(rating).toBeCloseTo(1.85, 2);
  });

  it("calculates 2B -> SS with multiplier", () => {
    const player = makePlayer({
      primary_position: "2B",
      eligible_2b: 4.25,
      eligible_ss: null,
    });
    const rating = getOOPRating(player, "SS");
    // base = 4.40, multiplier = 4.25 / 4.25 = 1.0
    expect(rating).toBeCloseTo(4.40, 2);
  });

  it("calculates 3B -> 2B with multiplier", () => {
    const player = makePlayer({
      primary_position: "3B",
      eligible_3b: 2.65,
      eligible_ss: null,
    });
    const rating = getOOPRating(player, "2B");
    // base = 3.97, multiplier = 2.65 / 2.65 = 1.0
    expect(rating).toBeCloseTo(3.97, 2);
  });

  it("calculates OF -> 1B with multiplier", () => {
    const player = makePlayer({
      primary_position: "OF",
      eligible_of: 2.07,
      eligible_ss: null,
    });
    const rating = getOOPRating(player, "1B");
    // base = 1.79, OF has no source average in SOURCE_AVERAGES, uses base directly
    expect(rating).toBeCloseTo(1.79, 2);
  });

  it("calculates 1B -> OF with multiplier", () => {
    const player = makePlayer({
      primary_position: "1B",
      eligible_1b: 1.85,
      eligible_ss: null,
    });
    const rating = getOOPRating(player, "OF");
    // base = 1.94, multiplier = 1.85 / 1.85 = 1.0
    expect(rating).toBeCloseTo(1.94, 2);
  });

  it("handles every from->to combination in base ratings", () => {
    // Just verify non-null return for every entry in the base table
    for (const [source, targets] of Object.entries(OOP_BASE_RATINGS)) {
      for (const [target, baseRating] of Object.entries(targets)) {
        const player = makePlayer({
          primary_position: source as Player["primary_position"],
          eligible_1b: source === "1B" ? 1.85 : null,
          eligible_2b: source === "2B" ? 4.25 : null,
          eligible_3b: source === "3B" ? 2.65 : null,
          eligible_ss: source === "SS" ? 4.75 : null,
          eligible_of: source === "OF" ? 2.07 : null,
        });
        const rating = getOOPRating(player, target);
        expect(rating).not.toBeNull();
        expect(rating).toBeGreaterThan(0);
      }
    }
  });
});

describe("getValidOOPTargets", () => {
  it("excludes naturally eligible positions", () => {
    // SS player naturally eligible at SS, should not see SS in OOP targets
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.75 });
    const targets = getValidOOPTargets(player);
    expect(targets).not.toContain("SS");
  });

  it("returns valid OOP targets for SS", () => {
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.75 });
    const targets = getValidOOPTargets(player);
    expect(targets).toContain("2B");
    expect(targets).toContain("3B");
    expect(targets).toContain("OF");
    expect(targets).toContain("1B"); // infielder->1B fallback
  });

  it("excludes multi-eligibility positions", () => {
    // SS/2B player should not see 2B in OOP targets
    const player = makePlayer({
      primary_position: "SS",
      eligible_ss: 4.75,
      eligible_2b: 4.10,
    });
    const targets = getValidOOPTargets(player);
    expect(targets).not.toContain("2B");
    expect(targets).not.toContain("SS");
    expect(targets).toContain("3B");
    expect(targets).toContain("OF");
  });

  it("returns sorted positions", () => {
    const player = makePlayer({ primary_position: "SS", eligible_ss: 4.75 });
    const targets = getValidOOPTargets(player);
    expect(targets).toEqual([...targets].sort());
  });

  it("returns valid targets for C", () => {
    const player = makePlayer({ primary_position: "C", eligible_ss: null });
    const targets = getValidOOPTargets(player);
    expect(targets).toContain("1B");
    expect(targets).toContain("OF");
    expect(targets).not.toContain("2B");
    expect(targets).not.toContain("3B");
    expect(targets).not.toContain("SS");
  });
});
