"use client";

import { useMemo, useState } from "react";
import { players, teams, hitterStats, pitcherStats, projections } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  aggregateHitterStats,
  aggregatePitcherStats,
  filterStatsByDateRange,
  isPlayerPitcher,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { TeamStatsSummary } from "@/components/dashboard/team-stats-summary";
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

  // TODO: Default to "wtd" once real daily stats are flowing from MLB Stats API
  const [dateRange, setDateRange] = useState<DateRange>({ type: "season", year: 2025 });
  const [statsSource, setStatsSource] = useState<StatsSource>("actual");
  const [customStart, setCustomStart] = useState("2025-01-01");
  const [customEnd, setCustomEnd] = useState("2025-12-31");

  // Projection source state
  const availableSources = useMemo(() => getAvailableProjectionSources(projections), []);
  const [projectionSource, setProjectionSource] = useState(availableSources[0] ?? "");

  // Handle date range change
  const handleDateRangeChange = (type: string) => {
    if (type === "season") {
      setDateRange({ type: "season", year: 2025 });
    } else if (type === "wtd") {
      setDateRange({ type: "wtd" });
    } else if (type === "last7") {
      setDateRange({ type: "last7" });
    } else if (type === "last14") {
      setDateRange({ type: "last14" });
    } else if (type === "last30") {
      setDateRange({ type: "last30" });
    } else if (type === "custom") {
      setDateRange({ type: "custom", start: customStart, end: customEnd });
    }
  };

  // Handle custom date change
  const updateCustomDateRange = () => {
    if (dateRange.type === "custom") {
      setDateRange({ type: "custom", start: customStart, end: customEnd });
    }
  };

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
    if (statsSource === "projected") {
      // Get all-player maps filtered by projection source
      const { hitterStatsMap, pitcherStatsMap } = getProjectionStatsMaps(
        projections,
        projectionSource
      );

      // Get player IDs for filtering stats
      const hitterPlayerIds = new Set(myHitters.map((p) => p.id));
      const pitcherPlayerIds = new Set(myPitchers.map((p) => p.id));

      // Build roster-only stats: convert aggregated back to daily format for re-aggregation
      const rosterHitterProjections = myHitters
        .map((p) => {
          const stats = hitterStatsMap.get(p.id);
          return stats ? { ...stats, player_id: p.id, date: "2025-01-01" } : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const rosterPitcherProjections = myPitchers
        .map((p) => {
          const stats = pitcherStatsMap.get(p.id);
          return stats ? { ...stats, player_id: p.id, date: "2025-01-01" } : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      // Aggregate team stats (for total rows)
      const teamHitterStats = aggregateHitterStats(rosterHitterProjections);
      const teamPitcherStats = aggregatePitcherStats(rosterPitcherProjections);

      // Create by-player maps for roster (just filter the all-player maps)
      const teamHitterStatsByPlayer = aggregateHitterStatsByPlayer(rosterHitterProjections);
      const teamPitcherStatsByPlayer = aggregatePitcherStatsByPlayer(rosterPitcherProjections);

      return {
        hitterStatsMap,
        pitcherStatsMap,
        teamHitterStats,
        teamPitcherStats,
        teamHitterStatsByPlayer,
        teamPitcherStatsByPlayer,
      };
    } else {
      // Use actual stats filtered by date range
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
    }
  }, [myRoster, myHitters, myPitchers, dateRange, statsSource, projectionSource]);

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex justify-between items-baseline flex-wrap gap-2 mb-6">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <span className="text-4xl font-bold text-brand-blue">{myTeam?.name ?? "Power Hitters"}</span>
      </div>

      {/* Stats Source and Date Range Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Stats source toggle */}
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium">Stats Source:</span>
          <button
            onClick={() => setStatsSource("actual")}
            className={`px-3 py-1 rounded text-sm ${
              statsSource === "actual"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Actual
          </button>
          <button
            onClick={() => setStatsSource("projected")}
            className={`px-3 py-1 rounded text-sm ${
              statsSource === "projected"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Projected
          </button>
        </div>

        {/* Projection source dropdown - only for projected stats */}
        {statsSource === "projected" && (
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium">Source:</span>
            <select
              value={projectionSource}
              onChange={(e) => setProjectionSource(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              {availableSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date range dropdown - only for actual stats */}
        {statsSource === "actual" && (
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium">Date Range:</span>
            <select
              value={dateRange.type}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="season">Season to Date</option>
              <option value="wtd">Week to Date</option>
              <option value="last7">Last 7 Days</option>
              <option value="last14">Last 14 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateRange.type === "custom" && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  onBlur={updateCustomDateRange}
                  className="px-2 py-1 border rounded text-sm"
                />
                <span className="text-sm">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  onBlur={updateCustomDateRange}
                  className="px-2 py-1 border rounded text-sm"
                />
              </>
            )}
          </div>
        )}
      </div>

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
