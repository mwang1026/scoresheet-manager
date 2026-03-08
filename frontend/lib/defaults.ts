import type { DateRange, StatsSource } from "@/lib/stats";

// Season configuration — update each year with Opening Day and season end dates
interface SeasonDates {
  openingDay: { month: number; day: number }; // 1-indexed months (March = 3)
  seasonEnd: { month: number; day: number };
}

const SEASON_CONFIG: Record<number, SeasonDates> = {
  2026: { openingDay: { month: 3, day: 25 }, seasonEnd: { month: 9, day: 27 } },
};

export type SeasonPeriod = "preseason" | "in-season" | "offseason";

export type DateRangePreset = "season" | "wtd" | "last7" | "last14" | "last30";

export interface SeasonalDefaults {
  statsSource: StatsSource;
  dateRanges: {
    dashboard: DateRange | null;
    players: DateRange | null;
    opponents: DateRange | null;
    draft: DateRange | null;
    "depth-charts": DateRange | null;
  };
  projectionSource: string | null;
  seasonYear: number;
}

export const DEFAULT_HITTER_SORT = { column: "OPS", direction: "desc" as const };
export const DEFAULT_PITCHER_SORT = { column: "ERA", direction: "asc" as const };

/** Returns the season year for a given date. January belongs to the previous season. */
export function getSeasonYear(date: Date): number {
  if (date.getMonth() === 0) {
    // January — still the previous season's offseason
    return date.getFullYear() - 1;
  }
  return date.getFullYear();
}

function getFallbackDates(): SeasonDates {
  // Default fallback when no config entry exists — Mar 25 / Sep 27
  return {
    openingDay: { month: 3, day: 25 },
    seasonEnd: { month: 9, day: 27 },
  };
}

/**
 * Returns the current season period based on the calendar date.
 *
 * Periods:
 * - preseason:  before Opening Day
 * - in-season:  Opening Day through six days after season end (inclusive)
 * - offseason:  seven+ days after season end
 */
export function getSeasonPeriod(date: Date): SeasonPeriod {
  const year = getSeasonYear(date);
  const config = SEASON_CONFIG[year] ?? getFallbackDates();
  const { openingDay, seasonEnd } = config;

  // Build comparison dates in the season year's local timezone
  const openingDayDate = new Date(year, openingDay.month - 1, openingDay.day);
  const seasonEndDate = new Date(year, seasonEnd.month - 1, seasonEnd.day);
  // Offseason starts 7 days after season end
  const offseasonStart = new Date(seasonEndDate);
  offseasonStart.setDate(offseasonStart.getDate() + 7);

  // Strip time from input for date-only comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly < openingDayDate) {
    return "preseason";
  } else if (dateOnly < offseasonStart) {
    return "in-season";
  } else {
    return "offseason";
  }
}

/** Returns the seasonal defaults for stats source, date ranges, and projection source. */
export function getSeasonalDefaults(date: Date): SeasonalDefaults {
  const seasonYear = getSeasonYear(date);
  const period = getSeasonPeriod(date);

  if (period === "preseason") {
    return {
      statsSource: "projected",
      dateRanges: {
        dashboard: null,
        players: null,
        opponents: null,
        draft: null,
        "depth-charts": null,
      },
      projectionSource: "PECOTA-50",
      seasonYear,
    };
  } else if (period === "in-season") {
    return {
      statsSource: "actual",
      dateRanges: {
        dashboard: { type: "wtd" },
        players: { type: "season", year: seasonYear },
        opponents: { type: "wtd" },
        draft: { type: "last30" },
        "depth-charts": { type: "season", year: seasonYear },
      },
      projectionSource: null,
      seasonYear,
    };
  } else {
    // offseason
    return {
      statsSource: "actual",
      dateRanges: {
        dashboard: { type: "season", year: seasonYear },
        players: { type: "season", year: seasonYear },
        opponents: { type: "season", year: seasonYear },
        draft: { type: "last30" },
        "depth-charts": { type: "season", year: seasonYear },
      },
      projectionSource: null,
      seasonYear,
    };
  }
}

/** Converts a date range preset string to a concrete DateRange object. */
export function resolvePresetToDateRange(preset: DateRangePreset, seasonYear: number): DateRange {
  switch (preset) {
    case "season":
      return { type: "season", year: seasonYear };
    case "wtd":
      return { type: "wtd" };
    case "last7":
      return { type: "last7" };
    case "last14":
      return { type: "last14" };
    case "last30":
      return { type: "last30" };
  }
}

/**
 * Returns the season's opening day as a "YYYY-MM-DD" string.
 * Used to set the season start date for stats queries.
 */
export function getSeasonStartStr(year: number): string {
  const config = SEASON_CONFIG[year] ?? getFallbackDates();
  const { month, day } = config.openingDay;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Returns the number of days in the season from opening day through season end (inclusive).
 * Used to calculate qualified PA/IP thresholds.
 */
export function getSeasonDays(year: number): number {
  const config = SEASON_CONFIG[year] ?? getFallbackDates();
  const { openingDay, seasonEnd } = config;
  const start = new Date(year, openingDay.month - 1, openingDay.day);
  const end = new Date(year, seasonEnd.month - 1, seasonEnd.day);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Returns the season's opening day as a Date object.
 * Used to calculate days elapsed for qualified stats thresholds.
 */
export function getSeasonStartDate(year: number): Date {
  const config = SEASON_CONFIG[year] ?? getFallbackDates();
  const { month, day } = config.openingDay;
  return new Date(year, month - 1, day);
}

/**
 * Returns the season's end date as a "YYYY-MM-DD" string.
 * Used to set the season end date for custom date defaults.
 */
export function getSeasonEndStr(year: number): string {
  const config = SEASON_CONFIG[year] ?? getFallbackDates();
  const { month, day } = config.seasonEnd;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Returns true if the current season year has no entry in SEASON_CONFIG,
 * meaning the app will fall back to default dates and the admin should update
 * SEASON_CONFIG in defaults.ts.
 */
export function needsSeasonConfigUpdate(date: Date): boolean {
  const year = getSeasonYear(date);
  return !(year in SEASON_CONFIG);
}
