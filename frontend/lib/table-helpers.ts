import type { Team } from "./types";

/** Fixed widths (px) for pinned columns across all tables */
export const PIN_WIDTHS = {
  star: 40,
  queue: 40,
  name: 160,
  hand: 48,
  pos: 56,
} as const;

/** Mobile pin widths — only the name column is pinned on small screens */
export const MOBILE_PIN_WIDTHS = {
  star: 0,
  queue: 0,
  name: 140,
  hand: 0,
  pos: 0,
} as const;

/** Get pin widths based on mobile/desktop state */
export function getPinWidths(isMobile: boolean) {
  return isMobile ? MOBILE_PIN_WIDTHS : PIN_WIDTHS;
}

/**
 * Format a fantasy team as "Team ##" using the team's scoresheet_id.
 * Returns "—" for null (unowned).
 */
export function formatFantasyTeamAbbr(team: Team | undefined): string {
  if (!team) return "—";
  return `Team ${team.scoresheet_id}`;
}
