import type { StatsSource } from "@/lib/stats";
import type { DateRangePreset as BaseDateRangePreset } from "@/lib/defaults";

// Extends the base presets from defaults.ts to add "default" (meaning "use seasonal default").
export type DateRangePreset = "default" | BaseDateRangePreset;

export interface SortPreference {
  column: string;
  direction: "asc" | "desc" | "default";
}

export interface PageSettings {
  statsSource: "default" | StatsSource;
  dateRange: DateRangePreset;
  projectionSource: "default" | string;
}

export interface UserSettings {
  version: 1;
  dashboard: PageSettings & {
    rosterHittersSort: SortPreference | null;
    rosterPitchersSort: SortPreference | null;
    watchlistHittersSort: SortPreference | null;
    watchlistPitchersSort: SortPreference | null;
  };
  players: PageSettings & {
    hittersSort: SortPreference | null;
    pitchersSort: SortPreference | null;
  };
  opponents: PageSettings & {
    hittersSort: SortPreference | null;
    pitchersSort: SortPreference | null;
  };
  draft: PageSettings;
}

export function getDefaultSettings(): UserSettings {
  return {
    version: 1,
    dashboard: {
      statsSource: "default",
      dateRange: "default",
      projectionSource: "default",
      rosterHittersSort: null,
      rosterPitchersSort: null,
      watchlistHittersSort: null,
      watchlistPitchersSort: null,
    },
    players: {
      statsSource: "default",
      dateRange: "default",
      projectionSource: "default",
      hittersSort: null,
      pitchersSort: null,
    },
    opponents: {
      statsSource: "default",
      dateRange: "default",
      projectionSource: "default",
      hittersSort: null,
      pitchersSort: null,
    },
    draft: {
      statsSource: "default",
      dateRange: "default",
      projectionSource: "default",
    },
  };
}
