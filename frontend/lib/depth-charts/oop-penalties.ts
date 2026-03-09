/**
 * Out of Position (OOP) penalty calculations.
 *
 * Uses Scoresheet-published OOP base ratings scaled by the player's
 * defensive ability relative to the league average at their source position.
 */

import type { Player } from "../types";
import { DEFENSE_AVERAGES } from "../constants";
import type { DepthChartPosition } from "./types";

/**
 * OOP base ratings: source position → target position → base defense rating.
 * These are published Scoresheet values for an average fielder at the source position.
 */
export const OOP_BASE_RATINGS: Record<string, Record<string, number>> = {
  "1B": { OF: 1.94 },
  "2B": { "3B": 2.53, SS: 4.40, OF: 2.04 },
  "3B": { "2B": 3.97, SS: 4.33, OF: 2.01 },
  SS: { "2B": 4.14, "3B": 2.61, OF: 2.07 },
  C: { "1B": 1.73, OF: 1.93 },
  DH: { "1B": 1.70, OF: 1.90 },
  OF: { "1B": 1.79 },
};

// League average defense at each source position (for multiplier calculation)
export const SOURCE_AVERAGES: Record<string, number> = {
  "1B": 1.85,
  "2B": 4.25,
  "3B": 2.65,
  SS: 4.75,
};

/**
 * Get the player's natural defense rating at a given source position.
 */
function getSourceDefenseRating(player: Player, sourcePos: string): number | null {
  switch (sourcePos) {
    case "1B": return player.eligible_1b;
    case "2B": return player.eligible_2b;
    case "3B": return player.eligible_3b;
    case "SS": return player.eligible_ss;
    case "OF": return player.eligible_of;
    default: return null;
  }
}

/**
 * Get all natural positions a player is eligible at (primary + secondary).
 */
function getNaturalPositions(player: Player): string[] {
  const positions: string[] = [player.primary_position];
  if (player.eligible_1b !== null && player.primary_position !== "1B") positions.push("1B");
  if (player.eligible_2b !== null && player.primary_position !== "2B") positions.push("2B");
  if (player.eligible_3b !== null && player.primary_position !== "3B") positions.push("3B");
  if (player.eligible_ss !== null && player.primary_position !== "SS") positions.push("SS");
  if (player.eligible_of !== null && player.primary_position !== "OF") positions.push("OF");
  return positions;
}

/**
 * Calculate the OOP defense rating for a player at a target position.
 *
 * Formula: OOP_Rating = OOP_base × (Player_def_at_source / Avg_at_source)
 * Picks the best (highest) result across all valid source positions.
 *
 * Returns null if no valid source→target path exists.
 */
export function getOOPRating(player: Player, toPosition: string): number | null {
  const naturalPositions = getNaturalPositions(player);
  let bestRating: number | null = null;

  for (const sourcePos of naturalPositions) {
    // Look up OOP base from source → target
    let baseRating: number | null = null;

    if (OOP_BASE_RATINGS[sourcePos]?.[toPosition] !== undefined) {
      baseRating = OOP_BASE_RATINGS[sourcePos][toPosition];
    }

    // Infielder→1B fallback: if source is 2B/3B/SS and target is 1B
    if (baseRating === null && toPosition === "1B" && ["2B", "3B", "SS"].includes(sourcePos)) {
      baseRating = DEFENSE_AVERAGES["1B"]; // 1.85
    }

    if (baseRating === null) continue;

    // Calculate multiplier
    const sourceAvg = SOURCE_AVERAGES[sourcePos];
    const playerDef = getSourceDefenseRating(player, sourcePos);

    let rating: number;
    if (sourcePos === "C" || sourcePos === "DH" || playerDef === null || sourceAvg === undefined) {
      // C and DH have no defense fields — use base directly
      rating = baseRating;
    } else {
      rating = baseRating * (playerDef / sourceAvg);
    }

    if (bestRating === null || rating > bestRating) {
      bestRating = rating;
    }
  }

  return bestRating;
}

/**
 * Get positions from the OOP penalty table that the player doesn't already
 * naturally qualify for.
 */
export function getValidOOPTargets(player: Player): string[] {
  const naturalPositions = new Set(getNaturalPositions(player));
  const targets = new Set<string>();

  for (const sourcePos of naturalPositions) {
    const oopTargets = OOP_BASE_RATINGS[sourcePos];
    if (oopTargets) {
      for (const target of Object.keys(oopTargets)) {
        if (!naturalPositions.has(target)) {
          targets.add(target);
        }
      }
    }
    // Infielder→1B fallback
    if (["2B", "3B", "SS"].includes(sourcePos) && !naturalPositions.has("1B")) {
      targets.add("1B");
    }
  }

  return Array.from(targets).sort();
}

/**
 * Map depth chart positions back to base positions for OOP lookup.
 */
export function dcPositionToBase(position: DepthChartPosition): string | null {
  switch (position) {
    case "1B": return "1B";
    case "2B": return "2B";
    case "3B": return "3B";
    case "SS": return "SS";
    case "CF": return "OF";
    case "COF": return "OF";
    default: return null;
  }
}
