"use client";

import { useMemo } from "react";
import { SectionPanel } from "@/components/ui/section-panel";
import type { DraftPick, Team } from "@/lib/types";
import { formatDateTime, isWithinHours } from "@/lib/format";

interface DraftPicksPanelProps {
  teams: Team[];
  picks: DraftPick[];
  myTeamId: number | undefined;
  filterMode: "all" | "mine";
  onFilterChange: (mode: "all" | "mine") => void;
  draftComplete: boolean;
  lastScrapedAt: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function DraftPicksPanel({
  teams,
  picks,
  myTeamId,
  filterMode,
  onFilterChange,
  draftComplete,
  lastScrapedAt,
  onRefresh,
  isRefreshing,
}: DraftPicksPanelProps) {
  // Count my remaining picks
  const myPicksRemaining = myTeamId ? picks.filter((p) => p.team_id === myTeamId).length : 0;

  // Abbreviate team names to "Team #N"
  const teamAbbrMap = useMemo(
    () => new Map(teams.map((t) => [t.name, `Team #${t.scoresheet_id}`])),
    [teams]
  );
  // Filter picks based on mode
  const displayedPicks =
    filterMode === "mine" && myTeamId
      ? picks.filter((p) => p.team_id === myTeamId)
      : picks;

  return (
    <SectionPanel
      title="Draft Picks"
      badge={myTeamId && myPicksRemaining > 0 ? (
        <span className="font-mono text-xs font-semibold text-brand bg-brand/15 px-1.5 py-0.5 rounded">
          {myPicksRemaining} picks left
        </span>
      ) : undefined}
    >
    <div className="flex flex-col gap-4 h-full p-4">
      {/* Header with filter toggle */}
      <div className="flex-none">
        <div className="flex gap-2">
          <button
            onClick={() => onFilterChange("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              filterMode === "all"
                ? "bg-brand/15 text-brand border border-brand/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
            }`}
          >
            All Picks
          </button>
          <button
            onClick={() => onFilterChange("mine")}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              filterMode === "mine"
                ? "bg-brand/15 text-brand border border-brand/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
            }`}
          >
            My Picks
          </button>
        </div>
      </div>

      {/* Picks list */}
      <div className="flex-1 overflow-y-auto">
        {draftComplete ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Draft Complete
          </p>
        ) : picks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active draft
          </p>
        ) : (
          <div className="picks-container space-y-1">
            {displayedPicks.map((pick) => {
              const isMyPick = pick.team_id === myTeamId;
              const displayTeam = teamAbbrMap.get(pick.team_name) ?? pick.team_name;
              const displayFrom = pick.from_team_name
                ? teamAbbrMap.get(pick.from_team_name) ?? pick.from_team_name
                : null;

              return (
                <div
                  key={`${pick.round}-${pick.pick_in_round}`}
                  className={`px-3 py-2 text-sm rounded ${
                    isMyPick
                      ? "bg-brand/10 border-l-2 border-brand"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {/* Row 1: round + team + (wide: date/time) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground flex-none">
                        Rd {pick.round}.{pick.pick_in_round}
                      </span>
                      <span
                        className={`truncate ${isMyPick ? "font-semibold" : ""}`}
                      >
                        {displayTeam}
                        {displayFrom && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            (from {displayFrom})
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="picks-wide-date text-xs text-muted-foreground flex-none">
                      {formatDateTime(pick.scheduled_time)}
                    </span>
                  </div>
                  {/* Row 2: date/time — visible at narrow container only */}
                  <div className="picks-narrow-date text-xs text-muted-foreground pl-[3.25rem] pt-0.5">
                    {formatDateTime(pick.scheduled_time)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none pt-3 border-t">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {lastScrapedAt && isWithinHours(lastScrapedAt, 24)
              ? `Last updated ${formatRelativeTime(lastScrapedAt)}`
              : lastScrapedAt
                ? `Last updated ${formatDateTime(lastScrapedAt)}`
                : "Never updated"}
          </p>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-1 text-xs font-medium rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            {isRefreshing ? "Refreshing\u2026" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
    </SectionPanel>
  );
}

/**
 * Format an ISO datetime as a relative time string (e.g., "5 min ago").
 */
function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDateTime(isoString);
}
