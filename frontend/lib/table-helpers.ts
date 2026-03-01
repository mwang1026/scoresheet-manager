import type { Team } from "./types";

/** Fixed widths (px) for pinned columns across all tables */
export const PIN_WIDTHS = {
  star: 40,
  queue: 40,
  name: 160,
  hand: 48,
  pos: 56,
} as const;

/**
 * Format a fantasy team as "Team ##" using the team's scoresheet_id.
 * Returns "—" for null (unowned).
 */
export function formatFantasyTeamAbbr(team: Team | undefined): string {
  if (!team) return "—";
  return `Team ${team.scoresheet_id}`;
}
