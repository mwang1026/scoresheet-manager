/**
 * Backend response interfaces and transform functions.
 *
 * Transforms snake_case backend responses into frontend types.
 */

import type {
  Player,
  Team,
  HitterDailyStats,
  PitcherDailyStats,
  Projection,
  HitterProjection,
  PitcherProjection,
} from "../types";

/**
 * Backend player response (snake_case fields)
 */
export interface BackendPlayer {
  id: number;
  first_name: string;
  last_name: string;
  name: string; // Backend now provides combined name
  mlb_id: number;
  scoresheet_id: number;
  primary_position: string;
  current_mlb_team: string | null;
  current_team: string | null; // Alias provided by backend
  bats: string | null;
  hand: string | null; // Alias provided by backend
  throws: string | null;
  age: number;
  team_id: number | null;
  eligible_1b: number | null;
  eligible_2b: number | null;
  eligible_3b: number | null;
  eligible_ss: number | null;
  eligible_of: number | null;
  osb_al: number | null;
  ocs_al: number | null;
  ba_vr: number | null;
  ob_vr: number | null;
  sl_vr: number | null;
  ba_vl: number | null;
  ob_vl: number | null;
  sl_vl: number | null;
}

/**
 * Backend team response
 */
export interface BackendTeam {
  id: number;
  name: string;
  scoresheet_id: number;
  league_id: number;
  league_name: string;
  is_my_team: boolean;
}

/**
 * Backend hitter stats response (snake_case fields)
 */
export interface BackendHitterStats {
  player_id: number;
  date: string; // ISO format YYYY-MM-DD
  g: number;
  pa: number;
  ab: number;
  h: number;
  single: number;
  double: number;
  triple: number;
  hr: number;
  tb: number;
  r: number;
  rbi: number;
  so: number;
  go: number;
  fo: number;
  ao: number;
  gdp: number;
  bb: number;
  ibb: number;
  hbp: number;
  sb: number;
  cs: number;
  sf: number;
  sh: number;
  lob: number;
  pitches: number;
}

/**
 * Backend pitcher stats response (snake_case fields)
 */
export interface BackendPitcherStats {
  player_id: number;
  date: string; // ISO format YYYY-MM-DD
  g: number;
  gs: number;
  gf: number;
  cg: number;
  sho: number;
  sv: number;
  svo: number;
  bs: number;
  hld: number;
  ip_outs: number;
  w: number;
  l: number;
  er: number;
  r: number;
  bf: number;
  ab: number;
  h: number;
  double: number;
  triple: number;
  hr: number;
  tb: number;
  bb: number;
  ibb: number;
  hbp: number;
  k: number;
  go: number;
  fo: number;
  ao: number;
  sb: number;
  cs: number;
  sf: number;
  sh: number;
  wp: number;
  bk: number;
  pk: number;
  ir: number;
  irs: number;
  pitches: number;
  strikes: number;
}

/**
 * Backend hitter projection response (snake_case fields)
 */
export interface BackendHitterProjection {
  player_id: number;
  source: string;
  player_type: "hitter";
  season: number;
  g: number;
  pa: number;
  ab: number;
  r: number;
  h: number;
  single: number;
  double: number;
  triple: number;
  hr: number;
  rbi: number;
  bb: number;
  ibb: number;
  so: number;
  hbp: number;
  sf: number;
  sh: number;
  sb: number;
  cs: number;
  go: number;
  fo: number;
  gdp: number;
  advanced?: {
    avg?: number;
    obp?: number;
    slg?: number;
    babip?: number;
    drc_plus?: number;
    vorp?: number;
    warp?: number;
  };
}

/**
 * Backend pitcher projection response (snake_case fields)
 */
export interface BackendPitcherProjection {
  player_id: number;
  source: string;
  player_type: "pitcher";
  season: number;
  g: number;
  gs: number;
  gf: number;
  cg: number;
  sho: number;
  w: number;
  l: number;
  sv: number;
  hld: number;
  ip_outs: number;
  h: number;
  r: number;
  er: number;
  hr: number;
  bb: number;
  ibb: number;
  so: number;
  hbp: number;
  wp: number;
  bk: number;
  advanced?: {
    era?: number;
    whip?: number;
    fip?: number;
    dra?: number;
    dra_minus?: number;
    warp?: number;
    gb_percent?: number;
  };
}

export type BackendProjection = BackendHitterProjection | BackendPitcherProjection;

/**
 * Transform backend player to frontend Player type
 */
export function transformPlayer(backendPlayer: BackendPlayer): Player {
  return {
    id: backendPlayer.id,
    name: backendPlayer.name, // Backend provides combined name
    mlb_id: backendPlayer.mlb_id,
    scoresheet_id: backendPlayer.scoresheet_id,
    primary_position: backendPlayer.primary_position as Player["primary_position"],
    hand: (() => { const raw = backendPlayer.hand || backendPlayer.bats; return (raw === "B" ? "S" : raw) as Player["hand"]; })(), // Prefer hand alias, fallback to bats; map "B" (Both) → "S" (Switch)
    age: backendPlayer.age,
    current_team: backendPlayer.current_team || backendPlayer.current_mlb_team || "",
    team_id: backendPlayer.team_id,
    eligible_1b: backendPlayer.eligible_1b,
    eligible_2b: backendPlayer.eligible_2b,
    eligible_3b: backendPlayer.eligible_3b,
    eligible_ss: backendPlayer.eligible_ss,
    eligible_of: backendPlayer.eligible_of,
    osb_al: backendPlayer.osb_al,
    ocs_al: backendPlayer.ocs_al,
    ba_vr: backendPlayer.ba_vr,
    ob_vr: backendPlayer.ob_vr,
    sl_vr: backendPlayer.sl_vr,
    ba_vl: backendPlayer.ba_vl,
    ob_vl: backendPlayer.ob_vl,
    sl_vl: backendPlayer.sl_vl,
  };
}

/**
 * Transform backend team to frontend Team type
 */
export function transformTeam(backendTeam: BackendTeam): Team {
  return {
    id: backendTeam.id,
    name: backendTeam.name,
    scoresheet_id: backendTeam.scoresheet_id,
    league_id: backendTeam.league_id,
    league_name: backendTeam.league_name,
    is_my_team: backendTeam.is_my_team,
  };
}

/**
 * Transform backend hitter stats to frontend HitterDailyStats type
 */
export function transformHitterStats(backendStats: BackendHitterStats): HitterDailyStats {
  return {
    player_id: backendStats.player_id,
    date: backendStats.date,
    PA: backendStats.pa,
    AB: backendStats.ab,
    H: backendStats.h,
    "1B": backendStats.single,
    "2B": backendStats.double,
    "3B": backendStats.triple,
    HR: backendStats.hr,
    SO: backendStats.so,
    GO: backendStats.go,
    FO: backendStats.fo,
    GDP: backendStats.gdp,
    BB: backendStats.bb,
    IBB: backendStats.ibb,
    HBP: backendStats.hbp,
    SB: backendStats.sb,
    CS: backendStats.cs,
    R: backendStats.r,
    RBI: backendStats.rbi,
    SF: backendStats.sf,
    SH: backendStats.sh,
  };
}

/**
 * Transform backend pitcher stats to frontend PitcherDailyStats type
 */
export function transformPitcherStats(backendStats: BackendPitcherStats): PitcherDailyStats {
  return {
    player_id: backendStats.player_id,
    date: backendStats.date,
    G: backendStats.g,
    GS: backendStats.gs,
    GF: backendStats.gf,
    CG: backendStats.cg,
    SHO: backendStats.sho,
    SV: backendStats.sv,
    HLD: backendStats.hld,
    IP_outs: backendStats.ip_outs,
    W: backendStats.w,
    L: backendStats.l,
    ER: backendStats.er,
    R: backendStats.r,
    BF: backendStats.bf,
    H: backendStats.h,
    BB: backendStats.bb,
    IBB: backendStats.ibb,
    HBP: backendStats.hbp,
    K: backendStats.k,
    HR: backendStats.hr,
    WP: backendStats.wp,
    BK: backendStats.bk,
  };
}

/**
 * Transform backend projection to frontend Projection type
 */
export function transformProjection(backendProj: BackendProjection): Projection {
  if (backendProj.player_type === "hitter") {
    const hitterProj: HitterProjection = {
      player_id: backendProj.player_id,
      source: backendProj.source,
      player_type: "hitter",
      PA: backendProj.pa,
      AB: backendProj.ab,
      H: backendProj.h,
      "1B": backendProj.single,
      "2B": backendProj.double,
      "3B": backendProj.triple,
      HR: backendProj.hr,
      BB: backendProj.bb,
      IBB: backendProj.ibb,
      HBP: backendProj.hbp,
      SO: backendProj.so,
      SB: backendProj.sb,
      CS: backendProj.cs,
      R: backendProj.r,
      RBI: backendProj.rbi,
      SF: backendProj.sf,
      SH: backendProj.sh,
      GO: backendProj.go,
      FO: backendProj.fo,
      GDP: backendProj.gdp,
    };
    return hitterProj;
  } else {
    const pitcherProj: PitcherProjection = {
      player_id: backendProj.player_id,
      source: backendProj.source,
      player_type: "pitcher",
      G: backendProj.g,
      GS: backendProj.gs,
      GF: backendProj.gf,
      CG: backendProj.cg,
      SHO: backendProj.sho,
      SV: backendProj.sv,
      HLD: backendProj.hld,
      IP_outs: backendProj.ip_outs,
      W: backendProj.w,
      L: backendProj.l,
      ER: backendProj.er,
      R: backendProj.r,
      BF: 0, // Not provided by backend
      H: backendProj.h,
      BB: backendProj.bb,
      IBB: backendProj.ibb,
      HBP: backendProj.hbp,
      K: backendProj.so,
      HR: backendProj.hr,
      WP: backendProj.wp,
      BK: backendProj.bk,
    };
    return pitcherProj;
  }
}
