/**
 * Single source of truth for sortable stat columns per table context.
 *
 * Compact tables (Dashboard roster/watchlist + Opponents) show fewer columns
 * than the Players page. The Settings page sort dropdowns should only offer
 * columns that actually appear in the relevant table.
 */

// Compact tables: Dashboard roster/watchlist + Opponents
export const COMPACT_HITTER_SORT_COLUMNS = [
  "OPS",
  "AVG",
  "OBP",
  "SLG",
  "HR",
  "R",
  "RBI",
  "SB",
] as const;

export const COMPACT_PITCHER_SORT_COLUMNS = [
  "ERA",
  "WHIP",
  "K",
  "IP_outs",
  "G",
  "GS",
  "BB",
  "ER",
  "R",
] as const;

// Players page: full column set (includes PA, AB, H, CS for hitters; K9, SV for pitchers)
export const PLAYERS_HITTER_SORT_COLUMNS = [
  "OPS",
  "AVG",
  "OBP",
  "SLG",
  "HR",
  "R",
  "RBI",
  "SB",
  "PA",
  "AB",
  "H",
  "CS",
] as const;

export const PLAYERS_PITCHER_SORT_COLUMNS = [
  "ERA",
  "WHIP",
  "K9",
  "K",
  "IP_outs",
  "G",
  "GS",
  "SV",
  "BB",
  "ER",
  "R",
] as const;

// Derive union types for table components (Name is always included in every table)
export type CompactHitterSortColumn = "Name" | (typeof COMPACT_HITTER_SORT_COLUMNS)[number];
export type CompactPitcherSortColumn = "Name" | (typeof COMPACT_PITCHER_SORT_COLUMNS)[number];

// Per-page lookup for Settings page sort dropdowns
export const SORT_COLUMNS_BY_PAGE = {
  dashboard: { hitter: COMPACT_HITTER_SORT_COLUMNS, pitcher: COMPACT_PITCHER_SORT_COLUMNS },
  opponents: { hitter: COMPACT_HITTER_SORT_COLUMNS, pitcher: COMPACT_PITCHER_SORT_COLUMNS },
  players: { hitter: PLAYERS_HITTER_SORT_COLUMNS, pitcher: PLAYERS_PITCHER_SORT_COLUMNS },
} as const;
