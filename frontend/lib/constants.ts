export const HITTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "DH"] as const;
export const PITCHER_POSITIONS = ["P", "SR"] as const;
export const ALL_POSITIONS = [...HITTER_POSITIONS, ...PITCHER_POSITIONS] as const;
export type Position = (typeof ALL_POSITIONS)[number];

export function isPitcherPosition(position: string): boolean {
  return (PITCHER_POSITIONS as readonly string[]).includes(position);
}
