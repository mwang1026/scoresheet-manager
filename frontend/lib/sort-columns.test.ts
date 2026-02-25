import { describe, it, expect } from "vitest";
import {
  COMPACT_HITTER_SORT_COLUMNS,
  COMPACT_PITCHER_SORT_COLUMNS,
  PLAYERS_HITTER_SORT_COLUMNS,
  PLAYERS_PITCHER_SORT_COLUMNS,
} from "./sort-columns";
import { aggregateHitterStats, aggregatePitcherStats } from "./stats";

/**
 * Invariant: every column in each sort array must be a valid key on
 * AggregatedHitterStats / AggregatedPitcherStats. This catches drift between
 * sort column definitions and the actual stat types.
 */

// Create instances with all keys present so we can check membership at runtime
const dummyHitterStats = aggregateHitterStats([]);
const dummyPitcherStats = aggregatePitcherStats([]);

describe("sort-columns invariant — columns must be valid stat keys", () => {
  it("all COMPACT_HITTER_SORT_COLUMNS are keys of AggregatedHitterStats", () => {
    for (const col of COMPACT_HITTER_SORT_COLUMNS) {
      expect(col in dummyHitterStats, `"${col}" not found on AggregatedHitterStats`).toBe(true);
    }
  });

  it("all COMPACT_PITCHER_SORT_COLUMNS are keys of AggregatedPitcherStats", () => {
    for (const col of COMPACT_PITCHER_SORT_COLUMNS) {
      expect(col in dummyPitcherStats, `"${col}" not found on AggregatedPitcherStats`).toBe(true);
    }
  });

  it("all PLAYERS_HITTER_SORT_COLUMNS are keys of AggregatedHitterStats", () => {
    for (const col of PLAYERS_HITTER_SORT_COLUMNS) {
      expect(col in dummyHitterStats, `"${col}" not found on AggregatedHitterStats`).toBe(true);
    }
  });

  it("all PLAYERS_PITCHER_SORT_COLUMNS are keys of AggregatedPitcherStats", () => {
    // Special cases noted: IP_outs is a real key, K9 is a real key (calculated)
    for (const col of PLAYERS_PITCHER_SORT_COLUMNS) {
      expect(col in dummyPitcherStats, `"${col}" not found on AggregatedPitcherStats`).toBe(true);
    }
  });

  it("COMPACT columns are a strict subset of PLAYERS columns (hitters)", () => {
    const playersSet = new Set(PLAYERS_HITTER_SORT_COLUMNS);
    for (const col of COMPACT_HITTER_SORT_COLUMNS) {
      expect(playersSet.has(col), `COMPACT column "${col}" not in PLAYERS_HITTER_SORT_COLUMNS`).toBe(true);
    }
  });

  it("COMPACT columns are a strict subset of PLAYERS columns (pitchers)", () => {
    const playersSet = new Set(PLAYERS_PITCHER_SORT_COLUMNS);
    for (const col of COMPACT_PITCHER_SORT_COLUMNS) {
      expect(playersSet.has(col), `COMPACT column "${col}" not in PLAYERS_PITCHER_SORT_COLUMNS`).toBe(true);
    }
  });
});
