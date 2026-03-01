/**
 * Muted placeholder components for empty stat cells.
 *
 * - Dash: for counting stats (PA, HR, etc.) — renders "—"
 * - RateDash: for rate stats (AVG, ERA, etc.) — renders "---"
 */

export function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export function RateDash() {
  return <span className="text-muted-foreground">---</span>;
}
