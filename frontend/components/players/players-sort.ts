/**
 * Pure comparator functions for sorting the players table.
 *
 * Extracted from the sortedPlayers useMemo in players-table.tsx.
 * No React dependencies — pure TypeScript.
 */

import type { Player } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";
import { calculatePlatoonOPS } from "@/lib/stats";

type SortDirection = "asc" | "desc";

function applyDirection(comparison: number, direction: SortDirection): number {
  return direction === "asc" ? comparison : -comparison;
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  // Null values always sort to bottom regardless of direction
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  let comparison = 0;
  if (typeof a === "string" && typeof b === "string") {
    comparison = a.localeCompare(b);
  } else if (typeof a === "number" && typeof b === "number") {
    comparison = a - b;
  }

  return applyDirection(comparison, direction);
}

export function compareHitters(
  a: Player,
  b: Player,
  aStats: AggregatedHitterStats | undefined,
  bStats: AggregatedHitterStats | undefined,
  column: string,
  direction: SortDirection
): number {
  let aValue: unknown;
  let bValue: unknown;

  switch (column) {
    case "name":
      aValue = a.name;
      bValue = b.name;
      break;
    case "team":
      aValue = a.current_team;
      bValue = b.current_team;
      break;
    case "PA":
    case "AB":
    case "H":
    case "HR":
    case "R":
    case "RBI":
    case "SB":
    case "CS":
      aValue = aStats?.[column] ?? 0;
      bValue = bStats?.[column] ?? 0;
      break;
    case "AVG":
    case "OBP":
    case "SLG":
    case "OPS":
      aValue = aStats?.[column] ?? null;
      bValue = bStats?.[column] ?? null;
      break;
    case "vR":
      aValue = calculatePlatoonOPS(aStats?.OPS ?? null, a.ob_vr, a.sl_vr);
      bValue = calculatePlatoonOPS(bStats?.OPS ?? null, b.ob_vr, b.sl_vr);
      break;
    case "vL":
      aValue = calculatePlatoonOPS(aStats?.OPS ?? null, a.ob_vl, a.sl_vl);
      bValue = calculatePlatoonOPS(bStats?.OPS ?? null, b.ob_vl, b.sl_vl);
      break;
    default:
      aValue = 0;
      bValue = 0;
  }

  return compareValues(aValue, bValue, direction);
}

export function comparePitchers(
  a: Player,
  b: Player,
  aStats: AggregatedPitcherStats | undefined,
  bStats: AggregatedPitcherStats | undefined,
  column: string,
  direction: SortDirection
): number {
  let aValue: unknown;
  let bValue: unknown;

  switch (column) {
    case "name":
      aValue = a.name;
      bValue = b.name;
      break;
    case "team":
      aValue = a.current_team;
      bValue = b.current_team;
      break;
    case "G":
    case "GS":
    case "IP_outs":
    case "W":
    case "L":
    case "K":
    case "ER":
    case "R":
    case "BB":
    case "SV":
      aValue = aStats?.[column] ?? 0;
      bValue = bStats?.[column] ?? 0;
      break;
    case "ERA":
    case "WHIP":
    case "K9":
      aValue = aStats?.[column] ?? null;
      bValue = bStats?.[column] ?? null;
      break;
    default:
      aValue = 0;
      bValue = 0;
  }

  return compareValues(aValue, bValue, direction);
}
