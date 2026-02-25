"use client";

import { useMemo, useState, useEffect } from "react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  usePlayers,
  useHitterStats,
  usePitcherStats,
  useProjections,
  useTeams,
} from "@/lib/hooks/use-players-data";
import { useTeamContext } from "@/lib/contexts/team-context";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  aggregateHitterStats,
  aggregatePitcherStats,
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
import { PageHeader } from "@/components/layout/page-header";

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

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { currentTeam } = useTeamContext();
  const { teams: allTeams } = useTeams();
  const { projections } = useProjections();

  const defaults = usePageDefaults("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [customStart, setCustomStart] = useState(`${defaults.seasonYear}-01-01`);
  const [customEnd, setCustomEnd] = useState(`${defaults.seasonYear}-12-31`);

  // Projection source state
  const availableSources = useMemo(
    () => getAvailableProjectionSources(projections || []),
    [projections]
  );
  const [projectionSource, setProjectionSource] = useState(availableSources[0] ?? "");

  // Sync projectionSource when availableSources loads (Fix A)
  useEffect(() => {
    if (projectionSource === "" && availableSources.length > 0) {
      setProjectionSource(availableSources[0]);
    }
  }, [availableSources, projectionSource]);

  // Handle date range change
  const handleDateRangeChange = (type: string) => {
    if (type === "season") {
      setDateRange({ type: "season", year: defaults.seasonYear });
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

  // Fetch stats from API
  const {
    stats: hitterStatsData,
    isLoading: hitterStatsLoading,
    error: hitterStatsError,
  } = useHitterStats(dateRange);
  const {
    stats: pitcherStatsData,
    isLoading: pitcherStatsLoading,
    error: pitcherStatsError,
  } = usePitcherStats(dateRange);

  // Compute player lists
  const { myHitters, myPitchers, watchlistPlayers, queuePlayers } = useMemo(() => {
    const playersList = players || [];
    const myRoster = playersList.filter((p) => p.team_id === currentTeam?.id);
    const myHitters = myRoster.filter((p) => !isPlayerPitcher(p));
    const myPitchers = myRoster.filter((p) => isPlayerPitcher(p));
    const watchlistPlayers = playersList.filter((p) => watchlist.has(p.id));

    // Queue players: preserve array order (not Set order)
    const playerMap = new Map(playersList.map((p) => [p.id, p]));
    const queuePlayers = queue
      .map((id) => playerMap.get(id))
      .filter((p): p is NonNullable<typeof playerMap extends Map<number, infer P> ? P : never> => p !== undefined);

    return { myHitters, myPitchers, watchlistPlayers, queuePlayers };
  }, [players, currentTeam, watchlist, queue]);

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
        projections || [],
        projectionSource
      );

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
      // Use actual stats from API
      const hitterStatsFromAPI = hitterStatsData || [];
      const pitcherStatsFromAPI = pitcherStatsData || [];

      // Aggregate by player (for all players)
      const hitterStatsMap = aggregateHitterStatsByPlayer(hitterStatsFromAPI);
      const pitcherStatsMap = aggregatePitcherStatsByPlayer(pitcherStatsFromAPI);

      // Get player IDs for filtering stats
      const hitterPlayerIds = new Set(myHitters.map((p) => p.id));
      const pitcherPlayerIds = new Set(myPitchers.map((p) => p.id));

      // Filter daily stats to only roster players
      const rosterHitterStats = hitterStatsFromAPI.filter((s) =>
        hitterPlayerIds.has(s.player_id)
      );
      const rosterPitcherStats = pitcherStatsFromAPI.filter((s) =>
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
  }, [myHitters, myPitchers, statsSource, projectionSource, projections, hitterStatsData, pitcherStatsData]);

  // Loading state (context handles team loading)
  const isLoading =
    playersLoading ||
    (statsSource === "actual" && (hitterStatsLoading || pitcherStatsLoading));

  // Error state (context handles team errors)
  const error =
    playersError ||
    (statsSource === "actual" && (hitterStatsError || pitcherStatsError));

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">Error loading data: {error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6">
        <PageHeader title="Dashboard" />
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
            defaultSort={defaults.rosterHittersSort}
          />

          {/* My Pitchers */}
          <RosterPitchersTable
            players={myPitchers}
            pitcherStatsMap={teamPitcherStatsByPlayer}
            teamTotals={teamPitcherStats}
            defaultSort={defaults.rosterPitchersSort}
          />
        </div>

        {/* Right column (sidebar) — height-capped to match left column */}
        <div className="lg:relative">
          <div className="lg:absolute lg:inset-0 lg:overflow-y-auto space-y-6">
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

      {/* Watchlist — full width below the grid */}
      <div className="mt-6">
        <WatchlistTable
          players={watchlistPlayers}
          teams={allTeams}
          hitterStatsMap={hitterStatsMap}
          pitcherStatsMap={pitcherStatsMap}
          queue={queue}
          getQueuePosition={getQueuePosition}
          onRemove={removeFromWatchlist}
          isHydrated={isHydrated}
          defaultHitterSort={defaults.watchlistHittersSort}
          defaultPitcherSort={defaults.watchlistPitchersSort}
        />
      </div>
    </div>
  );
}
