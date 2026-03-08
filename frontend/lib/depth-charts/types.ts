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

// Starters per position (used in lineup optimizer)
export const STARTERS_PER_POSITION: Record<string, number> = {
  C: 1, "1B": 1, "2B": 1, SS: 1, "3B": 1, CF: 1, COF: 2, DH: 1,
};

// CF eligibility threshold — must have OF defense rating >= this to play CF
export const CF_ELIGIBILITY_THRESHOLD = 2.11;

// Defense baselines (re-export from constants for convenience)
export const POSITION_DEF_BASELINE = DEFENSE_AVERAGES;

// Depth dot configuration per position group
export interface DepthDotConfig {
  label: string;
  positions: DepthChartPosition[];
  thresholds: [number, number]; // [green threshold, amber threshold]
  countAll?: boolean; // If true, count all players (not just starters)
}

export const DEPTH_DOT_CONFIG: DepthDotConfig[] = [
  { label: "C", positions: ["C"], thresholds: [3, 2] },
  { label: "1B", positions: ["1B"], thresholds: [3, 2] },
  { label: "2B", positions: ["2B"], thresholds: [3, 2] },
  { label: "SS", positions: ["SS"], thresholds: [3, 2] },
  { label: "3B", positions: ["3B"], thresholds: [3, 2] },
  { label: "CF", positions: ["CF"], thresholds: [3, 2] },
  { label: "CO", positions: ["COF"], thresholds: [3, 2] },
  { label: "DH", positions: ["DH"], thresholds: [3, 2] },
  { label: "P", positions: ["P-L", "P-R"], thresholds: [9, 6], countAll: true },
  { label: "SR", positions: ["SR-L", "SR-R"], thresholds: [6, 4], countAll: true },
];

// Platoon role — determines border color
export type PlatoonRole = "LR" | "L" | "R" | "bench";

// View mode for the depth chart display
export type ViewMode = "combined" | "vsL" | "vsR";

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
  pickPosition: number | null; // Draft pick order
  roster: Record<DepthChartPosition, DepthChartPlayer[]>;
}
