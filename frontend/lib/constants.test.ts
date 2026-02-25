import { describe, it, expect } from "vitest";
import {
  HITTER_POSITIONS,
  PITCHER_POSITIONS,
  ALL_POSITIONS,
  isPitcherPosition,
} from "./constants";

describe("position constants", () => {
  it("HITTER_POSITIONS has 7 entries", () => {
    expect(HITTER_POSITIONS).toHaveLength(7);
  });

  it("HITTER_POSITIONS contains expected positions", () => {
    expect(HITTER_POSITIONS).toContain("C");
    expect(HITTER_POSITIONS).toContain("1B");
    expect(HITTER_POSITIONS).toContain("2B");
    expect(HITTER_POSITIONS).toContain("3B");
    expect(HITTER_POSITIONS).toContain("SS");
    expect(HITTER_POSITIONS).toContain("OF");
    expect(HITTER_POSITIONS).toContain("DH");
  });

  it("PITCHER_POSITIONS has 2 entries", () => {
    expect(PITCHER_POSITIONS).toHaveLength(2);
  });

  it("PITCHER_POSITIONS contains P and SR", () => {
    expect(PITCHER_POSITIONS).toContain("P");
    expect(PITCHER_POSITIONS).toContain("SR");
  });

  it("ALL_POSITIONS is union of hitter and pitcher positions", () => {
    expect(ALL_POSITIONS).toHaveLength(
      HITTER_POSITIONS.length + PITCHER_POSITIONS.length
    );
    for (const pos of HITTER_POSITIONS) {
      expect(ALL_POSITIONS).toContain(pos);
    }
    for (const pos of PITCHER_POSITIONS) {
      expect(ALL_POSITIONS).toContain(pos);
    }
  });
});

describe("isPitcherPosition", () => {
  it("returns true for P", () => {
    expect(isPitcherPosition("P")).toBe(true);
  });

  it("returns true for SR", () => {
    expect(isPitcherPosition("SR")).toBe(true);
  });

  it("returns false for hitter positions", () => {
    for (const pos of HITTER_POSITIONS) {
      expect(isPitcherPosition(pos)).toBe(false);
    }
  });

  it("returns false for empty string", () => {
    expect(isPitcherPosition("")).toBe(false);
  });

  it("returns false for unknown position", () => {
    expect(isPitcherPosition("DH2")).toBe(false);
  });
});
