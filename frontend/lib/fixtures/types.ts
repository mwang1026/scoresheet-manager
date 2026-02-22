/**
 * TypeScript types and fixtures for projection and draft data
 *
 * NOTE: This file contains LEGACY fixture types. Pages using API hooks
 * should import from @/lib/types instead.
 */

// Re-export stats types from @/lib/types (these are the same)
export type {
  HitterDailyStats,
  PitcherDailyStats,
  HitterProjection,
  PitcherProjection,
  Projection,
} from "@/lib/types";

// Legacy Player type for fixtures (position eligibility uses defensive ratings)
export interface Player {
  id: number;
  name: string;
  mlb_id: number;
  scoresheet_id: number;
  primary_position: "P" | "SR" | "C" | "1B" | "2B" | "3B" | "SS" | "OF" | "DH";
  hand: "L" | "R" | "S";
  age: number;
  current_team: string;
  team_id: number | null;
  eligible_1b: number | null;  // Defensive rating
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

// Legacy Team type for fixtures (uses scoresheet_team_id as number)
export interface Team {
  id: number;
  name: string;
  scoresheet_team_id: number;
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

// Typed imports for fixture data
// NOTE: players, teams, hitterStats, pitcherStats are kept for backward compatibility
// with pages that haven't been migrated to API hooks yet. These will be removed once
// all pages are updated.
import playersData from "./players.json";
import teamsData from "./teams.json";
import hitterStatsData from "./hitter-stats.json";
import pitcherStatsData from "./pitcher-stats.json";
import draftOrderData from "./draft-order.json";

// Import types for the fixture data
import type { HitterDailyStats, PitcherDailyStats } from "@/lib/types";

// Export fixture data (backward compatibility - will be removed after full migration)
export const players = playersData as Player[];
export const teams = teamsData as Team[];
export const hitterStats = hitterStatsData as HitterDailyStats[];
export const pitcherStats = pitcherStatsData as PitcherDailyStats[];
export const draftOrder = draftOrderData as DraftPick[];

// Minimal projections fixture for testing
import type { Projection } from "@/lib/types";
export const projections: Projection[] = [
  // Hitter projection for player 1
  {
    player_id: 1,
    source: "PECOTA-50",
    player_type: "hitter",
    PA: 600,
    AB: 520,
    H: 150,
    "1B": 80,
    "2B": 30,
    "3B": 2,
    HR: 38,
    BB: 70,
    IBB: 5,
    HBP: 5,
    SO: 120,
    SB: 10,
    CS: 3,
    R: 95,
    RBI: 100,
    SF: 3,
    SH: 0,
    GO: 140,
    FO: 80,
    GDP: 10,
  },
  // Pitcher projection for player 14
  {
    player_id: 14,
    source: "PECOTA-50",
    player_type: "pitcher",
    G: 30,
    GS: 30,
    GF: 0,
    CG: 1,
    SHO: 0,
    SV: 0,
    HLD: 0,
    IP_outs: 540,
    W: 12,
    L: 8,
    ER: 60,
    R: 65,
    BF: 700,
    H: 150,
    BB: 40,
    IBB: 2,
    HBP: 5,
    K: 200,
    HR: 20,
    WP: 3,
    BK: 0,
  },
];
