import { describe, it, expect } from "vitest";
import {
  STATS_SOURCE_LABELS,
  STATS_SOURCE_OPTIONS,
  isStatsSource,
  usesDailyStats,
  usesDateRange,
} from "./sources";

describe("stats sources", () => {
  it("lists the three sources in toggle order", () => {
    expect(STATS_SOURCE_OPTIONS.map((o) => o.value)).toEqual(["actual", "projected", "playoff"]);
    expect(STATS_SOURCE_LABELS).toEqual({ actual: "Actual", projected: "Projected", playoff: "Playoff" });
  });

  it("actual and playoff need daily rows; only actual takes a date range", () => {
    expect(usesDailyStats("actual")).toBe(true);
    expect(usesDailyStats("playoff")).toBe(true);
    expect(usesDailyStats("projected")).toBe(false);
    expect(usesDateRange("actual")).toBe(true);
    expect(usesDateRange("playoff")).toBe(false);
    expect(usesDateRange("projected")).toBe(false);
  });

  it("isStatsSource guards URL and settings values", () => {
    expect(isStatsSource("playoff")).toBe(true);
    expect(isStatsSource("actual")).toBe(true);
    expect(isStatsSource("default")).toBe(false);
    expect(isStatsSource(null)).toBe(false);
    expect(isStatsSource(42)).toBe(false);
  });
});
