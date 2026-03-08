import { useMemo } from "react";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import {
  getSeasonalDefaults,
  resolvePresetToDateRange,
  DEFAULT_HITTER_SORT,
  DEFAULT_PITCHER_SORT,
  type DateRangePreset,
} from "@/lib/defaults";
import type { DateRange } from "@/lib/stats";
import type { StatsSource } from "@/lib/stats";
import type { SortPreference } from "@/lib/settings-types";

function resolveSort(
  pref: SortPreference | null,
  fallback: { column: string; direction: "asc" | "desc" }
): { column: string; direction: "asc" | "desc" } {
  if (!pref) return fallback;
  return {
    column: pref.column,
    direction: pref.direction === "default" ? fallback.direction : pref.direction,
  };
}

type Page = "dashboard" | "players" | "opponents" | "draft" | "depth-charts";

export interface ResolvedPageDefaults {
  statsSource: StatsSource;
  dateRange: DateRange;
  projectionSource: string | null;
  seasonYear: number;
  hitterSort: { column: string; direction: "asc" | "desc" };
  pitcherSort: { column: string; direction: "asc" | "desc" };
  // Dashboard-specific sort overrides
  rosterHittersSort?: { column: string; direction: "asc" | "desc" };
  rosterPitchersSort?: { column: string; direction: "asc" | "desc" };
  watchlistHittersSort?: { column: string; direction: "asc" | "desc" };
  watchlistPitchersSort?: { column: string; direction: "asc" | "desc" };
}

/**
 * Resolves page defaults by merging seasonal logic with user settings overrides.
 * "default" values fall through to the seasonal computation.
 */
export function usePageDefaults(page: Page): ResolvedPageDefaults {
  const { settings } = useSettingsContext();

  return useMemo(() => {
    const pageSettings = settings[page] ?? { statsSource: "default", dateRange: "default", projectionSource: "default" };
    const seasonal = getSeasonalDefaults(new Date());
    const seasonYear = seasonal.seasonYear;

    // Resolve statsSource
    const statsSource: StatsSource =
      pageSettings.statsSource === "default"
        ? seasonal.statsSource
        : (pageSettings.statsSource as StatsSource);

    // Resolve dateRange — fall back to season if seasonal returns null (preseason)
    const dateRange: DateRange =
      pageSettings.dateRange === "default"
        ? (seasonal.dateRanges[page] ?? { type: "season", year: seasonYear })
        : resolvePresetToDateRange(pageSettings.dateRange as DateRangePreset, seasonYear);

    // Resolve projectionSource
    const projectionSource: string | null =
      pageSettings.projectionSource === "default"
        ? seasonal.projectionSource
        : pageSettings.projectionSource;

    const result: ResolvedPageDefaults = {
      statsSource,
      dateRange,
      projectionSource,
      seasonYear,
      hitterSort: DEFAULT_HITTER_SORT,
      pitcherSort: DEFAULT_PITCHER_SORT,
    };

    // Page-specific sort overrides
    if (page === "dashboard") {
      const ds = settings.dashboard;
      result.rosterHittersSort = resolveSort(ds.rosterHittersSort, DEFAULT_HITTER_SORT);
      result.rosterPitchersSort = resolveSort(ds.rosterPitchersSort, DEFAULT_PITCHER_SORT);
      result.watchlistHittersSort = resolveSort(ds.watchlistHittersSort, DEFAULT_HITTER_SORT);
      result.watchlistPitchersSort = resolveSort(ds.watchlistPitchersSort, DEFAULT_PITCHER_SORT);
    } else if (page === "players") {
      const ps = settings.players;
      result.hitterSort = resolveSort(ps.hittersSort, DEFAULT_HITTER_SORT);
      result.pitcherSort = resolveSort(ps.pitchersSort, DEFAULT_PITCHER_SORT);
    } else if (page === "opponents") {
      const os = settings.opponents;
      result.hitterSort = resolveSort(os.hittersSort, DEFAULT_HITTER_SORT);
      result.pitcherSort = resolveSort(os.pitchersSort, DEFAULT_PITCHER_SORT);
    }

    return result;
  }, [settings, page]);
}
