import { describe, it, expect } from "vitest";
import {
  getSeasonPeriod,
  getSeasonYear,
  getSeasonalDefaults,
  resolvePresetToDateRange,
  needsSeasonConfigUpdate,
} from "./defaults";

// Helper to build a Date without time-of-day complications
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("getSeasonYear", () => {
  it("returns the current year for Feb–Dec", () => {
    expect(getSeasonYear(d(2026, 2, 24))).toBe(2026);
    expect(getSeasonYear(d(2026, 7, 15))).toBe(2026);
    expect(getSeasonYear(d(2026, 11, 15))).toBe(2026);
    expect(getSeasonYear(d(2026, 12, 31))).toBe(2026);
  });

  it("returns the previous year for January (offseason)", () => {
    expect(getSeasonYear(d(2027, 1, 1))).toBe(2026);
    expect(getSeasonYear(d(2027, 1, 31))).toBe(2026);
  });
});

describe("getSeasonPeriod", () => {
  // 2026 config: openingDay = Mar 25, seasonEnd = Sep 27, offseasonStart = Oct 4

  it("Feb 1 → preseason", () => {
    expect(getSeasonPeriod(d(2026, 2, 1))).toBe("preseason");
  });

  it("Feb 24 → preseason (today's date)", () => {
    expect(getSeasonPeriod(d(2026, 2, 24))).toBe("preseason");
  });

  it("Mar 24 → preseason (day before Opening Day)", () => {
    expect(getSeasonPeriod(d(2026, 3, 24))).toBe("preseason");
  });

  it("Mar 25 → in-season (Opening Day)", () => {
    expect(getSeasonPeriod(d(2026, 3, 25))).toBe("in-season");
  });

  it("Jun 15 → in-season", () => {
    expect(getSeasonPeriod(d(2026, 6, 15))).toBe("in-season");
  });

  it("Sep 27 → in-season (season end, still within buffer)", () => {
    expect(getSeasonPeriod(d(2026, 9, 27))).toBe("in-season");
  });

  it("Oct 3 → in-season (within 7-day buffer)", () => {
    expect(getSeasonPeriod(d(2026, 10, 3))).toBe("in-season");
  });

  it("Oct 4 → offseason (7 days after Sep 27)", () => {
    expect(getSeasonPeriod(d(2026, 10, 4))).toBe("offseason");
  });

  it("Nov 15 → offseason", () => {
    expect(getSeasonPeriod(d(2026, 11, 15))).toBe("offseason");
  });

  it("Dec 31 → offseason", () => {
    expect(getSeasonPeriod(d(2026, 12, 31))).toBe("offseason");
  });

  it("Jan 1 2027 → offseason (season year = 2026)", () => {
    expect(getSeasonPeriod(d(2027, 1, 1))).toBe("offseason");
  });

  it("Jan 31 2027 → offseason", () => {
    expect(getSeasonPeriod(d(2027, 1, 31))).toBe("offseason");
  });
});

describe("getSeasonalDefaults — preseason", () => {
  const date = d(2026, 2, 24); // Feb 24 2026

  it("statsSource is projected", () => {
    expect(getSeasonalDefaults(date).statsSource).toBe("projected");
  });

  it("all dateRanges are null", () => {
    const { dateRanges } = getSeasonalDefaults(date);
    expect(dateRanges.dashboard).toBeNull();
    expect(dateRanges.players).toBeNull();
    expect(dateRanges.opponents).toBeNull();
    expect(dateRanges.draft).toBeNull();
  });

  it("projectionSource is PECOTA-50", () => {
    expect(getSeasonalDefaults(date).projectionSource).toBe("PECOTA-50");
  });

  it("seasonYear is 2026", () => {
    expect(getSeasonalDefaults(date).seasonYear).toBe(2026);
  });
});

describe("getSeasonalDefaults — in-season", () => {
  const date = d(2026, 6, 15); // Jun 15 2026

  it("statsSource is actual", () => {
    expect(getSeasonalDefaults(date).statsSource).toBe("actual");
  });

  it("dashboard dateRange is wtd", () => {
    expect(getSeasonalDefaults(date).dateRanges.dashboard).toEqual({ type: "wtd" });
  });

  it("players dateRange is season", () => {
    expect(getSeasonalDefaults(date).dateRanges.players).toEqual({ type: "season", year: 2026 });
  });

  it("opponents dateRange is wtd", () => {
    expect(getSeasonalDefaults(date).dateRanges.opponents).toEqual({ type: "wtd" });
  });

  it("draft dateRange is last30", () => {
    expect(getSeasonalDefaults(date).dateRanges.draft).toEqual({ type: "last30" });
  });

  it("projectionSource is null", () => {
    expect(getSeasonalDefaults(date).projectionSource).toBeNull();
  });
});

describe("getSeasonalDefaults — offseason", () => {
  const date = d(2026, 11, 15); // Nov 15 2026

  it("statsSource is actual", () => {
    expect(getSeasonalDefaults(date).statsSource).toBe("actual");
  });

  it("all main page dateRanges are season", () => {
    const { dateRanges } = getSeasonalDefaults(date);
    expect(dateRanges.dashboard).toEqual({ type: "season", year: 2026 });
    expect(dateRanges.players).toEqual({ type: "season", year: 2026 });
    expect(dateRanges.opponents).toEqual({ type: "season", year: 2026 });
  });

  it("draft dateRange is last30", () => {
    expect(getSeasonalDefaults(date).dateRanges.draft).toEqual({ type: "last30" });
  });

  it("projectionSource is null", () => {
    expect(getSeasonalDefaults(date).projectionSource).toBeNull();
  });
});

describe("resolvePresetToDateRange", () => {
  it("season + year 2026 → { type: 'season', year: 2026 }", () => {
    expect(resolvePresetToDateRange("season", 2026)).toEqual({ type: "season", year: 2026 });
  });

  it("wtd → { type: 'wtd' }", () => {
    expect(resolvePresetToDateRange("wtd", 2026)).toEqual({ type: "wtd" });
  });

  it("last7 → { type: 'last7' }", () => {
    expect(resolvePresetToDateRange("last7", 2026)).toEqual({ type: "last7" });
  });

  it("last14 → { type: 'last14' }", () => {
    expect(resolvePresetToDateRange("last14", 2026)).toEqual({ type: "last14" });
  });

  it("last30 → { type: 'last30' }", () => {
    expect(resolvePresetToDateRange("last30", 2026)).toEqual({ type: "last30" });
  });
});

describe("needsSeasonConfigUpdate", () => {
  it("returns false for year 2026 (has config)", () => {
    expect(needsSeasonConfigUpdate(d(2026, 6, 15))).toBe(false);
  });

  it("returns false for Feb 2026 preseason (season year 2026 has config)", () => {
    expect(needsSeasonConfigUpdate(d(2026, 2, 15))).toBe(false);
  });

  it("returns true for year 2027 (no config entry)", () => {
    // Feb 2027: season year = 2027
    expect(needsSeasonConfigUpdate(d(2027, 2, 15))).toBe(true);
  });

  it("returns true for year 2028 (no config entry)", () => {
    expect(needsSeasonConfigUpdate(d(2028, 6, 1))).toBe(true);
  });
});
