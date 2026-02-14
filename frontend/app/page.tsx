"use client";

import { useMemo, useState } from "react";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  aggregateHitterStats,
  aggregatePitcherStats,
  filterStatsByDateRange,
  isPlayerPitcher,
  type DateRange,
} from "@/lib/stats";
import { TeamStatsSummary } from "@/components/dashboard/team-stats-summary";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { RosterHittersTable } from "@/components/dashboard/roster-hitters-table";
import { RosterPitchersTable } from "@/components/dashboard/roster-pitchers-table";
import { WatchlistTable } from "@/components/dashboard/watchlist-table";
import { DraftQueueTable } from "@/components/dashboard/draft-queue-table";
import { DraftTimeline } from "@/components/dashboard/draft-timeline";
import { NewsFeed } from "@/components/dashboard/news-feed";

export default function DashboardPage() {
  const {
    watchlist,
    queue,
    removeFromWatchlist,
    removeFromQueue,
    getQueuePosition,
    reorderQueue,
    isHydrated,
  } = usePlayerLists();

  const [dateRange, setDateRange] = useState<DateRange>({ type: "wtd" });

  // Get my team
  const myTeam = useMemo(() => teams.find((t) => t.is_my_team), []);

  // Compute player lists
  const { myRoster, myHitters, myPitchers, watchlistPlayers, queuePlayers } = useMemo(() => {
    const myRoster = players.filter((p) => p.team_id === myTeam?.id);
    const myHitters = myRoster.filter((p) => !isPlayerPitcher(p));
    const myPitchers = myRoster.filter((p) => isPlayerPitcher(p));
    const watchlistPlayers = players.filter((p) => watchlist.has(p.id));

    // Queue players: preserve array order (not Set order)
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const queuePlayers = queue
      .map((id) => playerMap.get(id))
      .filter((p): p is typeof players[0] => p !== undefined);

    return { myRoster, myHitters, myPitchers, watchlistPlayers, queuePlayers };
  }, [myTeam, watchlist, queue]);

  // Compute stats for selected date range and team aggregates
  const {
    hitterStatsMap,
    pitcherStatsMap,
    teamHitterStats,
    teamPitcherStats,
    teamHitterStatsByPlayer,
    teamPitcherStatsByPlayer,
  } = useMemo(() => {
    const filteredHitterStats = filterStatsByDateRange(hitterStats, dateRange);
    const filteredPitcherStats = filterStatsByDateRange(pitcherStats, dateRange);

    // Aggregate by player (for all players)
    const hitterStatsMap = aggregateHitterStatsByPlayer(filteredHitterStats);
    const pitcherStatsMap = aggregatePitcherStatsByPlayer(filteredPitcherStats);

    // Get player IDs for filtering stats
    const hitterPlayerIds = new Set(myHitters.map((p) => p.id));
    const pitcherPlayerIds = new Set(myPitchers.map((p) => p.id));

    // Filter daily stats to only roster players
    const rosterHitterStats = filteredHitterStats.filter((s) =>
      hitterPlayerIds.has(s.player_id)
    );
    const rosterPitcherStats = filteredPitcherStats.filter((s) =>
      pitcherPlayerIds.has(s.player_id)
    );

    // Aggregate team stats (for total rows)
    const teamHitterStats = aggregateHitterStats(rosterHitterStats);
    const teamPitcherStats = aggregatePitcherStats(rosterPitcherStats);

    // Aggregate team stats by player (for individual roster rows)
    const teamHitterStatsByPlayer = aggregateHitterStatsByPlayer(rosterHitterStats);
    const teamPitcherStatsByPlayer = aggregatePitcherStatsByPlayer(rosterPitcherStats);

    return {
      hitterStatsMap,
      pitcherStatsMap,
      teamHitterStats,
      teamPitcherStats,
      teamHitterStatsByPlayer,
      teamPitcherStatsByPlayer,
    };
  }, [myRoster, myHitters, myPitchers, dateRange]);

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold">
          Team Dashboard{" "}
          <span className="text-brand-blue">{myTeam?.name ?? "Power Hitters"}</span>
        </h1>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

      {/* Two-column responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left column (wider) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Stats Summary - full width */}
          <TeamStatsSummary
            hitterStats={teamHitterStats}
            pitcherStats={teamPitcherStats}
          />

          {/* My Hitters */}
          <RosterHittersTable
            players={myHitters}
            hitterStatsMap={teamHitterStatsByPlayer}
            teamTotals={teamHitterStats}
          />

          {/* My Pitchers */}
          <RosterPitchersTable
            players={myPitchers}
            pitcherStatsMap={teamPitcherStatsByPlayer}
            teamTotals={teamPitcherStats}
          />

          {/* Watchlist */}
          <WatchlistTable
            players={watchlistPlayers}
            teams={teams}
            hitterStatsMap={hitterStatsMap}
            pitcherStatsMap={pitcherStatsMap}
            queue={queue}
            getQueuePosition={getQueuePosition}
            onRemove={removeFromWatchlist}
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
            onRemove={removeFromQueue}
            onRemoveFromWatchlist={removeFromWatchlist}
            isWatchlisted={(id) => watchlist.has(id)}
            onReorder={reorderQueue}
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
