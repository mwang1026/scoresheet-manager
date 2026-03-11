/**
 * Depth chart types and constants for the position matrix view.
 */

import { DEFENSE_AVERAGES } from "../constants";

// Position rows in display order
export const DEPTH_CHART_POSITIONS = [
  "C", "1B", "2B", "SS", "3B", "CF", "COF", "DH",
  "P-L", "P-R", "SR-L", "SR-R",
] as const;
export type DepthChartPosition = (typeof DEPTH_CHART_POSITIONS)[number];

// Position sets for categorization
export const SP_POSITIONS = new Set(["P-L", "P-R"]);
export const SR_POSITIONS = new Set(["SR-L", "SR-R"]);
export const PITCHER_POSITIONS = new Set([...SP_POSITIONS, ...SR_POSITIONS]);
export const NO_DEF_POSITIONS = new Set(["C", "DH", "P-L", "P-R", "SR-L", "SR-R"]);

// Display limits
export const SP_DISPLAY_LIMIT = 5;

// Volume thresholds for filtering low-volume players (shared by dots + available-players)
export const MIN_PROJECTED_PA = 200;
export const MIN_PROJECTED_P_IP = 50;   // Starters: >= 50 IP
export const MIN_PROJECTED_SR_IP = 25;  // Relievers: >= 25 IP

// Starters per position (used in lineup optimizer)
export const STARTERS_PER_POSITION: Record<string, number> = {
  C: 1, "1B": 1, "2B": 1, SS: 1, "3B": 1, CF: 1, COF: 2, DH: 1,
};

// CF eligibility threshold — must have OF defense rating >= this to play CF
export const CF_ELIGIBILITY_THRESHOLD = 2.11;

// CF defense weight — Scoresheet weights CF defense at 1.4x
export const CF_DEF_WEIGHT = 1.4;

// Positions that contribute to team DEF aggregate
export const DEF_POSITIONS: DepthChartPosition[] = ["1B", "2B", "3B", "SS", "CF", "COF"];

// Sum of position averages with CF at 1.4x weight:
// 1.85 + 4.25 + 2.65 + 4.75 + 2.07 + 2.07 + (1.4 × 2.15) = 20.65
export const AVERAGE_DEF_BASELINE = 20.65;

// Defense baselines (re-export from constants for convenience)
export const POSITION_DEF_BASELINE = DEFENSE_AVERAGES;

// Depth dot configuration per position group
export interface DepthDotConfig {
  label: string;
  positions: DepthChartPosition[];
  thresholds: [number, number]; // [green threshold, amber threshold]
}

export const DEPTH_DOT_CONFIG: DepthDotConfig[] = [
  { label: "C", positions: ["C"], thresholds: [3, 2] },
  { label: "1B", positions: ["1B"], thresholds: [3, 2] },
  { label: "2B", positions: ["2B"], thresholds: [3, 2] },
  { label: "SS", positions: ["SS"], thresholds: [3, 2] },
  { label: "3B", positions: ["3B"], thresholds: [3, 2] },
  { label: "CF", positions: ["CF"], thresholds: [2, 1] },
  { label: "CO", positions: ["COF"], thresholds: [6, 3] },
  { label: "DH", positions: ["DH"], thresholds: [3, 2] },
  { label: "P", positions: ["P-L", "P-R"], thresholds: [9, 6] },
  { label: "SR", positions: ["SR-L", "SR-R"], thresholds: [6, 4] },
];

// Platoon role — determines border color
export type PlatoonRole = "LR" | "L" | "R" | "bench";

// View mode for the depth chart display
export type ViewMode = "combined" | "vsL" | "vsR" | "def";

// Processed player for depth chart display
export interface DepthChartPlayer {
  id: number;
  name: string;
  role: PlatoonRole;        // Border color: LR=gold, L=blue, R=red, bench=none
  isPrimary: boolean;       // true = full opacity, false = 45% (multi-pos duplicate)
  stat: number | null;      // OPS (hitters) or ERA (pitchers)
  statVsL: number | null;   // OPS vs LHP
  statVsR: number | null;   // OPS vs RHP
  defRating: number | null; // Raw defense rating at this position
  defDiff: number | null;   // Defense diff vs baseline
  isOOP?: boolean;           // true = placed via custom OOP position
  inMaxDEF: boolean;         // true = selected for max-defense lineup
  maxDEFPosition: DepthChartPosition | null; // which DEF slot this player is assigned to
  type: "hitter" | "pitcher";
  hand: string | null;      // Hand (pitchers: throwing hand, hitters: batting hand)
  // Tooltip data
  pa?: number;
  hr?: number;
  ops?: number;
  opsL?: number;
  opsR?: number;
  ip?: number;
  era?: number;
  whip?: number;
  k?: number;
}

// Processed team for depth chart
export interface DepthChartTeam {
  id: number;
  name: string;
  isMyTeam: boolean;
  vL: number | null;        // Aggregate starter OPS vs LHP
  vR: number | null;        // Aggregate starter OPS vs RHP
  spEra: number | null;     // Average ERA of non-bench P-L + P-R
  defVsL: number | null;    // Starting DEF vs LHP (relative to baseline)
  defVsR: number | null;    // Starting DEF vs RHP (relative to baseline)
  defLate: number | null;   // Late-inning best-available DEF (relative)
  pickPosition: number | null; // Draft pick order
  lineupGaps: number;          // Number of unfilled starter slots (0 = full roster)
  roster: Record<DepthChartPosition, DepthChartPlayer[]>;
}
