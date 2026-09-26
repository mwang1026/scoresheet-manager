"use client";

import { formatLineupRole, type PlayerLineupRole } from "@/lib/lineups";

/** Table cell showing a player's lineup role; inferred roles are marked with a dotted underline. */
export function LineupRoleCell({ role }: { role: PlayerLineupRole | undefined }) {
  const label = formatLineupRole(role);
  const inferred = role?.source === "inferred";
  const isBench = label === "B";
  return (
    <td
      className={`py-1.5 px-2 font-mono tabular-nums whitespace-nowrap ${isBench ? "text-muted-foreground" : ""} ${inferred ? "underline decoration-dotted" : ""}`}
      title={inferred ? "Inferred from the depth chart (no scraped lineup for this team)" : undefined}
    >
      {label}
    </td>
  );
}

/** Label cell for the starters totals row. */
export function StarterTotalsLabel({ label }: { label?: string }) {
  return <span title="Lineup starters only. In playoff mode each starter is weighted by his series playing-time cap.">{label ?? "Starters"}</span>;
}
