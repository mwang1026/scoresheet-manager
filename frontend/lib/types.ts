/**
 * TypeScript types for API data
 */

export interface Player {
  id: number;
  name: string;
  mlb_id: number;
  scoresheet_id: number; // SSBB - Scoresheet player ID (integer)
  primary_position: "P" | "SR" | "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "DH";
  hand: "L" | "R" | "S"; // Batting hand
  age: number;
  current_team: string;
  team_id: number | null; // Fantasy team ID (null = unowned)
  // Secondary position eligibility (defensive ratings, null if not eligible)
  eligible_1b: number | null;
  eligible_2b: number | null;
  eligible_3b: number | null;
  eligible_ss: number | null;
  eligible_of: number | null;
  // Catcher-specific (null for non-catchers)
  osb_al: number | null; // Opponent SB rate
  ocs_al: number | null; // Opponent CS rate
  // Platoon splits (relative adjustments, null for pitchers)
  ba_vr: number | null; // BA vs RHP (integer delta)
  ob_vr: number | null; // OBP vs RHP (integer delta)
  sl_vr: number | null; // SLG vs RHP (integer delta)
  ba_vl: number | null; // BA vs LHP (integer delta)
  ob_vl: number | null; // OBP vs LHP (integer delta)
  sl_vl: number | null; // SLG vs LHP (integer delta)
}

export interface Team {
  id: number;
  name: string;
  scoresheet_id: number;
  league_id: number;
  league_name: string;
  is_my_team: boolean;
}

export interface DraftPick {
  pick_number: number; // 1-40
  round: number; // 1-4
  pick_in_round: number; // 1-10
  team_id: number; // refs teams.json
  player_id: number | null; // null = upcoming
  scheduled_time: string; // ISO 8601 with timezone, e.g. "2025-03-15T14:00:00-07:00"
}

export interface HitterDailyStats {
  player_id: number;
  /**
   * Game date in ISO format: "YYYY-MM-DD" (e.g., "2025-04-15")
   *
   * Represents the calendar day the game STARTED (not ended).
   * - For delayed/suspended games spanning multiple days: use start date
   * - For doubleheaders: both games share the same date
   *
   * TODO: When integrating MLB Stats API, verify:
   * - API timezone handling (UTC vs local stadium time)
   * - How late-night games crossing midnight are dated
   * - How multi-day suspended games are handled
   */
  date: string;
  PA: number;
  AB: number;
  H: number;
  "1B": number;
  "2B": number;
  "3B": number;
  HR: number;
  SO: number;
  GO: number;
  FO: number;
  GDP: number;
  BB: number;
  IBB: number;
  HBP: number;
  SB: number;
  CS: number;
  R: number;
  RBI: number;
  SF: number;
  SH: number;
}

export interface PitcherDailyStats {
  player_id: number;
  /**
   * Game date in ISO format: "YYYY-MM-DD" (e.g., "2025-04-15")
   *
   * Represents the calendar day the game STARTED (not ended).
   * - For delayed/suspended games spanning multiple days: use start date
   * - For doubleheaders: both games share the same date
   *
   * TODO: When integrating MLB Stats API, verify:
   * - API timezone handling (UTC vs local stadium time)
   * - How late-night games crossing midnight are dated
   * - How multi-day suspended games are handled
   */
  date: string;
  G: number;
  GS: number;
  GF: number;
  CG: number;
  SHO: number;
  SV: number;
  HLD: number;
  IP_outs: number; // Innings pitched as outs (e.g., 18 = 6.0 IP)
  W: number;
  L: number;
  ER: number;
  R: number;
  BF: number;
  H: number;
  BB: number;
  IBB: number;
  HBP: number;
  K: number;
  HR: number;
  WP: number;
  BK: number;
}

export interface HitterProjection {
  player_id: number;
  source: string;
  player_type: "hitter";
  PA: number;
  AB: number;
  H: number;
  "1B": number;
  "2B": number;
  "3B": number;
  HR: number;
  BB: number;
  IBB: number;
  HBP: number;
  SO: number;
  SB: number;
  CS: number;
  R: number;
  RBI: number;
  SF: number;
  SH: number;
  GO: number;
  FO: number;
  GDP: number;
}

export interface PitcherProjection {
  player_id: number;
  source: string;
  player_type: "pitcher";
  G: number;
  GS: number;
  GF: number;
  CG: number;
  SHO: number;
  SV: number;
  HLD: number;
  IP_outs: number;
  W: number;
  L: number;
  ER: number;
  R: number;
  BF: number;
  H: number;
  BB: number;
  IBB: number;
  HBP: number;
  K: number;
  HR: number;
  WP: number;
  BK: number;
}

export type Projection = HitterProjection | PitcherProjection;

export interface MyTeam {
  id: number;
  name: string;
  scoresheet_id: number;
  league_id: number;
  league_name: string;
  league_season: number;
  role: string;
}

export interface ScrapedLeague {
  name: string;
  data_path: string;
}

export interface ScrapedTeam {
  scoresheet_id: number;
  owner_name: string;
}
