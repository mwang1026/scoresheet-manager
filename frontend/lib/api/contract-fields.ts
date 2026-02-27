/**
 * Runtime field maps for Backend* interfaces — one per contract schema.
 *
 * These are tested against contracts/api-schemas.json to catch schema drift.
 * The compile-time assertions below ensure field maps stay in sync with
 * the actual Backend* TypeScript interfaces.
 */

import type {
  BackendPlayer,
  BackendTeam,
  BackendHitterStats,
  BackendPitcherStats,
  BackendHitterProjection,
  BackendPitcherProjection,
} from "./transforms";

// ---------------------------------------------------------------------------
// Compile-time key-matching assertion
// Uses Required<T> to normalize optional keys (e.g. `advanced?:`) into
// required keys so they match the field-map keys.
// ---------------------------------------------------------------------------
type AssertKeysMatch<T, U> =
  Exclude<keyof Required<T>, keyof U> extends never
    ? Exclude<keyof U, keyof Required<T>> extends never
      ? true
      : never
    : never;

// ---------------------------------------------------------------------------
// PlayerListItem ↔ BackendPlayer
// ---------------------------------------------------------------------------
export const BACKEND_PLAYER_FIELDS = {
  id: "number",
  first_name: "string",
  last_name: "string",
  primary_position: "string",
  current_mlb_team: "string | null",
  bats: "string | null",
  throws: "string | null",
  age: "number | null",
  scoresheet_id: "number",
  mlb_id: "number | null",
  name: "string",
  hand: "string | null",
  current_team: "string | null",
  team_id: "number | null",
  eligible_1b: "number | null",
  eligible_2b: "number | null",
  eligible_3b: "number | null",
  eligible_ss: "number | null",
  eligible_of: "number | null",
  osb_al: "number | null",
  ocs_al: "number | null",
  ba_vr: "number | null",
  ob_vr: "number | null",
  sl_vr: "number | null",
  ba_vl: "number | null",
  ob_vl: "number | null",
  sl_vl: "number | null",
} as const satisfies Record<string, string>;
const _checkPlayer: AssertKeysMatch<BackendPlayer, typeof BACKEND_PLAYER_FIELDS> = true;
void _checkPlayer;

// ---------------------------------------------------------------------------
// TeamListItem ↔ BackendTeam
// ---------------------------------------------------------------------------
export const BACKEND_TEAM_FIELDS = {
  id: "number",
  league_id: "number",
  league_name: "string",
  name: "string",
  scoresheet_id: "number",
  is_my_team: "boolean",
} as const satisfies Record<string, string>;
const _checkTeam: AssertKeysMatch<BackendTeam, typeof BACKEND_TEAM_FIELDS> = true;
void _checkTeam;

// ---------------------------------------------------------------------------
// HitterDailyStatsItem ↔ BackendHitterStats
// ---------------------------------------------------------------------------
export const BACKEND_HITTER_STATS_FIELDS = {
  player_id: "number",
  date: "string",
  g: "number",
  pa: "number",
  ab: "number",
  h: "number",
  single: "number",
  double: "number",
  triple: "number",
  hr: "number",
  tb: "number",
  r: "number",
  rbi: "number",
  so: "number",
  go: "number",
  fo: "number",
  ao: "number",
  gdp: "number",
  bb: "number",
  ibb: "number",
  hbp: "number",
  sb: "number",
  cs: "number",
  sf: "number",
  sh: "number",
  lob: "number",
} as const satisfies Record<string, string>;
const _checkHitterStats: AssertKeysMatch<BackendHitterStats, typeof BACKEND_HITTER_STATS_FIELDS> = true;
void _checkHitterStats;

// ---------------------------------------------------------------------------
// PitcherDailyStatsItem ↔ BackendPitcherStats
// ---------------------------------------------------------------------------
export const BACKEND_PITCHER_STATS_FIELDS = {
  player_id: "number",
  date: "string",
  g: "number",
  gs: "number",
  gf: "number",
  cg: "number",
  sho: "number",
  sv: "number",
  svo: "number",
  bs: "number",
  hld: "number",
  ip_outs: "number",
  w: "number",
  l: "number",
  er: "number",
  r: "number",
  bf: "number",
  ab: "number",
  h: "number",
  double: "number",
  triple: "number",
  hr: "number",
  tb: "number",
  bb: "number",
  ibb: "number",
  hbp: "number",
  k: "number",
  go: "number",
  fo: "number",
  ao: "number",
  sb: "number",
  cs: "number",
  sf: "number",
  sh: "number",
  wp: "number",
  bk: "number",
  pk: "number",
  ir: "number",
  irs: "number",
  pitches: "number",
  strikes: "number",
} as const satisfies Record<string, string>;
const _checkPitcherStats: AssertKeysMatch<BackendPitcherStats, typeof BACKEND_PITCHER_STATS_FIELDS> = true;
void _checkPitcherStats;

// ---------------------------------------------------------------------------
// HitterProjectionItem ↔ BackendHitterProjection
// ---------------------------------------------------------------------------
export const BACKEND_HITTER_PROJECTION_FIELDS = {
  player_id: "number",
  source: "string",
  player_type: "'hitter'",
  season: "number",
  g: "number",
  pa: "number",
  ab: "number",
  r: "number",
  h: "number",
  single: "number",
  double: "number",
  triple: "number",
  hr: "number",
  rbi: "number",
  bb: "number",
  ibb: "number",
  so: "number",
  hbp: "number",
  sf: "number",
  sh: "number",
  sb: "number",
  cs: "number",
  go: "number",
  fo: "number",
  gdp: "number",
  advanced: "HitterProjectionAdvanced | null",
} as const satisfies Record<string, string>;
const _checkHitterProj: AssertKeysMatch<BackendHitterProjection, typeof BACKEND_HITTER_PROJECTION_FIELDS> = true;
void _checkHitterProj;

// ---------------------------------------------------------------------------
// PitcherProjectionItem ↔ BackendPitcherProjection
// ---------------------------------------------------------------------------
export const BACKEND_PITCHER_PROJECTION_FIELDS = {
  player_id: "number",
  source: "string",
  player_type: "'pitcher'",
  season: "number",
  g: "number",
  gs: "number",
  gf: "number",
  cg: "number",
  sho: "number",
  w: "number",
  l: "number",
  sv: "number",
  hld: "number",
  ip_outs: "number",
  h: "number",
  r: "number",
  er: "number",
  hr: "number",
  bb: "number",
  ibb: "number",
  so: "number",
  hbp: "number",
  wp: "number",
  bk: "number",
  advanced: "PitcherProjectionAdvanced | null",
} as const satisfies Record<string, string>;
const _checkPitcherProj: AssertKeysMatch<BackendPitcherProjection, typeof BACKEND_PITCHER_PROJECTION_FIELDS> = true;
void _checkPitcherProj;

// ---------------------------------------------------------------------------
// HitterProjectionAdvanced (nested — no TS interface to assert against)
// ---------------------------------------------------------------------------
export const BACKEND_HITTER_PROJECTION_ADVANCED_FIELDS = {
  avg: "number | null",
  obp: "number | null",
  slg: "number | null",
  babip: "number | null",
  drc_plus: "number | null",
  vorp: "number | null",
  warp: "number | null",
} as const satisfies Record<string, string>;

// ---------------------------------------------------------------------------
// PitcherProjectionAdvanced (nested — no TS interface to assert against)
// ---------------------------------------------------------------------------
export const BACKEND_PITCHER_PROJECTION_ADVANCED_FIELDS = {
  era: "number | null",
  whip: "number | null",
  fip: "number | null",
  dra: "number | null",
  dra_minus: "number | null",
  warp: "number | null",
  gb_percent: "number | null",
} as const satisfies Record<string, string>;
