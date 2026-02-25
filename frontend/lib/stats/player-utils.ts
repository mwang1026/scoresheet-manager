/**
 * Player position eligibility and display utilities
 */

import { isPitcherPosition } from "../constants";

/**
 * Check if player is a pitcher (P or SR)
 */
export function isPlayerPitcher(player: {
  primary_position: string;
}): boolean {
  return isPitcherPosition(player.primary_position);
}

/**
 * Check if player is eligible at a position
 */
export function isEligibleAt(
  player: {
    primary_position: string;
    eligible_1b: boolean | number | null;
    eligible_2b: boolean | number | null;
    eligible_3b: boolean | number | null;
    eligible_ss: boolean | number | null;
    eligible_of: boolean | number | null;
  },
  position: string
): boolean {
  // Check primary position
  if (player.primary_position === position) {
    return true;
  }

  // Check secondary eligibility
  // NOTE: Uses Boolean() to handle both legacy (number|null) and API (boolean) types
  switch (position) {
    case "1B":
      return Boolean(player.eligible_1b);
    case "2B":
      return Boolean(player.eligible_2b);
    case "3B":
      return Boolean(player.eligible_3b);
    case "SS":
      return Boolean(player.eligible_ss);
    case "OF":
      return Boolean(player.eligible_of);
    default:
      // C, DH, P, SR have no secondary eligibility fields
      return false;
  }
}

/**
 * Get eligible positions with defense ratings for a player
 */
export function getEligiblePositions(player: {
  primary_position: string;
  eligible_1b: boolean | number | null;
  eligible_2b: boolean | number | null;
  eligible_3b: boolean | number | null;
  eligible_ss: boolean | number | null;
  eligible_of: boolean | number | null;
}): string[] {
  const positions: string[] = [];

  // Map of position name to eligible field value
  const eligibilityMap: [string, number | boolean | null][] = [
    ["1B", player.eligible_1b],
    ["2B", player.eligible_2b],
    ["3B", player.eligible_3b],
    ["SS", player.eligible_ss],
    ["OF", player.eligible_of],
  ];

  // Find the primary position's eligible value
  const primaryEligEntry = eligibilityMap.find(([pos]) => pos === player.primary_position);
  const primaryEligValue = primaryEligEntry?.[1];

  // Add primary position with rating if available (numeric), plain otherwise
  if (typeof primaryEligValue === "number") {
    positions.push(`${player.primary_position}(${primaryEligValue.toFixed(2)})`);
  } else {
    positions.push(player.primary_position);
  }

  // Add remaining eligible positions (excluding primary)
  for (const [pos, value] of eligibilityMap) {
    if (pos !== player.primary_position && Boolean(value)) {
      // For numeric values, show rating; for booleans, show position only
      if (typeof value === "number") {
        positions.push(`${pos}(${value.toFixed(2)})`);
      } else {
        positions.push(pos);
      }
    }
  }

  return positions;
}

/**
 * Get defense display string for a player
 * Catchers show SB/CS rates, field players show eligible positions with ratings
 */
export function getDefenseDisplay(player: {
  primary_position: string;
  eligible_1b: boolean | number | null;
  eligible_2b: boolean | number | null;
  eligible_3b: boolean | number | null;
  eligible_ss: boolean | number | null;
  eligible_of: boolean | number | null;
  osb_al: number | null;
  ocs_al: number | null;
}): string {
  if (player.primary_position === "C") {
    // Catchers: show opponent SB/CS rates in format "C (0.75-0.25)"
    if (player.osb_al !== null && player.ocs_al !== null) {
      const osbRate = player.osb_al.toFixed(2);
      const ocsRate = player.ocs_al.toFixed(2);
      return `C (${osbRate}-${ocsRate})`;
    }
    return "C";
  }

  // Field players: show eligible positions with defense ratings
  const positions = getEligiblePositions(player);
  return positions.join(", ");
}

/**
 * Get slash-separated eligible positions for a player (no defense ratings)
 * e.g., "SS/2B" for a shortstop also eligible at 2B
 */
export function getPositionsList(player: {
  primary_position: string;
  eligible_1b: number | null;
  eligible_2b: number | null;
  eligible_3b: number | null;
  eligible_ss: number | null;
  eligible_of: number | null;
}): string {
  const pos = [player.primary_position];
  if (player.eligible_1b !== null && player.primary_position !== "1B") pos.push("1B");
  if (player.eligible_2b !== null && player.primary_position !== "2B") pos.push("2B");
  if (player.eligible_3b !== null && player.primary_position !== "3B") pos.push("3B");
  if (player.eligible_ss !== null && player.primary_position !== "SS") pos.push("SS");
  if (player.eligible_of !== null && player.primary_position !== "OF") pos.push("OF");
  return pos.join("/");
}

/**
 * Calculate platoon OPS split from base OPS and integer deltas
 * obDelta and slDelta are integer adjustments (e.g., +5 means +0.005)
 */
export function calculatePlatoonOPS(
  baseOPS: number | null,
  obDelta: number | null,
  slDelta: number | null
): number | null {
  if (baseOPS === null || obDelta === null || slDelta === null) return null;
  return baseOPS + (obDelta + slDelta) / 1000;
}
