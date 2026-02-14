"use client";

import { useMemo } from "react";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  aggregateHitterStats,
  aggregatePitcherStats,
  filterStatsByDateRange,
  type DateRange,
} from "@/lib/stats";
import { TeamStatsSummary } from "@/components/dashboard/team-stats-summary";
import { RosterTable } from "@/components/dashboard/roster-table";
import { WatchlistTable } from "@/components/dashboard/watchlist-table";
import { DraftQueueTable } from "@/components/dashboard/draft-queue-table";
import { DraftTimeline } from "@/components/dashboard/draft-timeline";
import { NewsFeed } from "@/components/dashboard/news-feed";

export default function DashboardPage() {
  const { watchlist, queue, toggleWatchlist, toggleQueue, isHydrated } = usePlayerLists();

  // Get my team
  const myTeam = useMemo(() => teams.find((t) => t.is_my_team), []);

  // Compute player lists
  const { myRoster, watchlistPlayers, queuePlayers } = useMemo(() => {
    const myRoster = players.filter((p) => p.team_id === myTeam?.id);
    const watchlistPlayers = players.filter((p) => watchlist.has(p.id));
    const queuePlayers = players.filter((p) => queue.has(p.id));

    return { myRoster, watchlistPlayers, queuePlayers };
  }, [myTeam, watchlist, queue]);

  // Compute season stats (2025 full year) and team aggregates
  const { hitterStatsMap, pitcherStatsMap, teamHitterStats, teamPitcherStats } = useMemo(() => {
    const dateRange: DateRange = { type: "season", year: 2025 };
    const filteredHitterStats = filterStatsByDateRange(hitterStats, dateRange);
    const filteredPitcherStats = filterStatsByDateRange(pitcherStats, dateRange);

    // Aggregate by player
    const hitterStatsMap = aggregateHitterStatsByPlayer(filteredHitterStats);
    const pitcherStatsMap = aggregatePitcherStatsByPlayer(filteredPitcherStats);

    // Get roster player IDs
    const rosterPlayerIds = new Set(myRoster.map((p) => p.id));

    // Filter daily stats to only roster players
    const rosterHitterStats = filteredHitterStats.filter((s) =>
      rosterPlayerIds.has(s.player_id)
    );
    const rosterPitcherStats = filteredPitcherStats.filter((s) =>
      rosterPlayerIds.has(s.player_id)
    );

    // Aggregate team stats
    const teamHitterStats = aggregateHitterStats(rosterHitterStats);
    const teamPitcherStats = aggregatePitcherStats(rosterPitcherStats);

    return {
      hitterStatsMap,
      pitcherStatsMap,
      teamHitterStats,
      teamPitcherStats,
    };
  }, [myRoster]);

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Team Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {myTeam ? myTeam.name : "My Team"}
        </p>
      </div>

      {/* Two-column responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (wider) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Stats Summary - full width */}
          <TeamStatsSummary
            hitterStats={teamHitterStats}
            pitcherStats={teamPitcherStats}
          />

          {/* My Roster */}
          <RosterTable
            players={myRoster}
            hitterStatsMap={hitterStatsMap}
            pitcherStatsMap={pitcherStatsMap}
          />

          {/* Watchlist */}
          <WatchlistTable
            players={watchlistPlayers}
            teams={teams}
            hitterStatsMap={hitterStatsMap}
            pitcherStatsMap={pitcherStatsMap}
            onRemove={toggleWatchlist}
            isHydrated={isHydrated}
          />
        </div>

        {/* Right column (sidebar) */}
        <div className="space-y-6">
          {/* Draft Queue */}
          <DraftQueueTable
            players={queuePlayers}
            hitterStatsMap={hitterStatsMap}
            pitcherStatsMap={pitcherStatsMap}
            onRemove={toggleQueue}
            isHydrated={isHydrated}
          />

          {/* Draft Timeline */}
          <DraftTimeline />

          {/* Recent News */}
          <NewsFeed />
        </div>
      </div>
    </div>
  );
}
