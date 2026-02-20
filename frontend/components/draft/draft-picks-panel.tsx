"use client";

import { type DraftPick, type Team } from "@/lib/fixtures/types";

interface DraftPicksPanelProps {
  picks: DraftPick[];
  teams: Team[];
  myTeamId: number | undefined;
  filterMode: "all" | "mine";
  onFilterChange: (mode: "all" | "mine") => void;
}

export function DraftPicksPanel({
  picks,
  teams,
  myTeamId,
  filterMode,
  onFilterChange,
}: DraftPicksPanelProps) {
  // Create team lookup
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Filter picks based on mode
  const displayedPicks =
    filterMode === "mine" && myTeamId
      ? picks.filter((p) => p.team_id === myTeamId)
      : picks;

  // Format scheduled time (e.g., "Mar 15, 10:00 (MDT)")
  const formatDateTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const month = date.toLocaleDateString("en-US", { month: "short" });
      const day = date.getDate();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const tz = date.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
      return `${month} ${day}, ${hours}:${minutes} (${tz})`;
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header with filter toggle */}
      <div className="flex-none">
        <h2 className="text-lg font-semibold mb-3">Draft Picks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onFilterChange("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              filterMode === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All Picks
          </button>
          <button
            onClick={() => onFilterChange("mine")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              filterMode === "mine"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            My Picks
          </button>
        </div>
      </div>

      {/* Picks list */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {displayedPicks.map((pick) => {
            const team = teamMap.get(pick.team_id);
            const isMyPick = pick.team_id === myTeamId;

            return (
              <div
                key={pick.pick_number}
                className={`px-3 py-2 text-sm rounded ${
                  isMyPick
                    ? "bg-primary/10 border-l-2 border-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground flex-none">
                      Rd {pick.round}.{pick.pick_in_round}
                    </span>
                    <span
                      className={`truncate ${isMyPick ? "font-semibold" : ""}`}
                    >
                      {team?.name || `Team ${pick.team_id}`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-none">
                    {formatDateTime(pick.scheduled_time)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="flex-none pt-3 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Placeholder — configure draft order in Settings
        </p>
      </div>
    </div>
  );
}
