"use client";

import { useMemo, useState, useEffect } from "react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import {
  usePlayers,
  useHitterStats,
  usePitcherStats,
  useProjections,
  useTeams,
} from "@/lib/hooks/use-players-data";
import { useTeamContext } from "@/lib/contexts/team-context";
import { useDraftSchedule } from "@/lib/hooks/use-draft-schedule";
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
import { PROJECTION_SENTINEL_DATE } from "@/lib/constants";
import { TeamStatsSummary } from "@/components/dashboard/team-stats-summary";
import { RosterHittersTable } from "@/components/dashboard/roster-hitters-table";
import { RosterPitchersTable } from "@/components/dashboard/roster-pitchers-table";
import { WatchlistTable } from "@/components/dashboard/watchlist-table";
import { DraftQueueTable } from "@/components/dashboard/draft-queue-table";
import { DraftTimeline } from "@/components/dashboard/draft-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { ProjectionSourceSelect } from "@/components/ui/projection-source-select";
import { RosterNewsWidget } from "@/components/dashboard/roster-news-widget";
import { useNewsFlags } from "@/lib/hooks/use-news-data";
import { TableSkeleton } from "@/components/ui/table-skeleton";

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
  const { getNote, saveNote } = usePlayerNotes();
  const { newsPlayerIds } = useNewsFlags();
  const { schedule } = useDraftSchedule();

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { currentTeam } = useTeamContext();
  const { teams: allTeams } = useTeams();
  const { projections } = useProjections();

  const defaults = usePageDefaults("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);

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
  const { myHitters, myPitchers, watchlistPlayers, queuePlayers, rosteredPlayerIds, playerMap } = useMemo(() => {
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

    const rosteredPlayerIds = new Set(myRoster.map((p) => p.id));

    return { myHitters, myPitchers, watchlistPlayers, queuePlayers, rosteredPlayerIds, playerMap };
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
          return stats ? { ...stats, player_id: p.id, date: PROJECTION_SENTINEL_DATE } : null;
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const rosterPitcherProjections = myPitchers
        .map((p) => {
          const stats = pitcherStatsMap.get(p.id);
          return stats ? { ...stats, player_id: p.id, date: PROJECTION_SENTINEL_DATE } : null;
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
      <div className="p-8 space-y-6">
        <TableSkeleton rows={12} columns={11} />
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
        <StatsSourceToggle value={statsSource} onChange={setStatsSource} />
        {statsSource === "projected" && (
          <ProjectionSourceSelect
            value={projectionSource}
            sources={availableSources}
            onChange={setProjectionSource}
          />
        )}
        {statsSource === "actual" && (
          <DateRangeSelect
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            seasonYear={defaults.seasonYear}
          />
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
            getNote={getNote}
            saveNote={saveNote}
            newsPlayerIds={newsPlayerIds}
          />

          {/* My Pitchers */}
          <RosterPitchersTable
            players={myPitchers}
            pitcherStatsMap={teamPitcherStatsByPlayer}
            teamTotals={teamPitcherStats}
            defaultSort={defaults.rosterPitchersSort}
            getNote={getNote}
            saveNote={saveNote}
            newsPlayerIds={newsPlayerIds}
          />
        </div>

        {/* Right column (sidebar) — height-capped to match left column */}
        <div className="lg:relative">
          <div className="lg:absolute lg:inset-0 lg:overflow-y-auto space-y-6">
            {/* Draft Timeline */}
            <DraftTimeline
              picks={schedule?.picks ?? []}
              teamId={currentTeam?.id}
              scoresheetDataPath={currentTeam?.league_scoresheet_data_path}
              scoresheetTeamId={currentTeam?.scoresheet_id}
            />

            {/* Roster News */}
            <RosterNewsWidget
              rosteredPlayerIds={rosteredPlayerIds}
              playerMap={playerMap}
            />

            {/* Draft Queue */}
            <DraftQueueTable
              players={queuePlayers}
              hitterStatsMap={hitterStatsMap}
              pitcherStatsMap={pitcherStatsMap}
              getNote={getNote}
              saveNote={saveNote}
              newsPlayerIds={newsPlayerIds}
            />
          </div>
        </div>
      </div>

      {/* Watchlist — full width below the grid */}
      <div className="mt-6">
        <WatchlistTable
          players={watchlistPlayers}
          teams={allTeams ?? []}
          hitterStatsMap={hitterStatsMap}
          pitcherStatsMap={pitcherStatsMap}
          queue={queue}
          getQueuePosition={getQueuePosition}
          onRemove={removeFromWatchlist}
          isHydrated={isHydrated}
          defaultHitterSort={defaults.watchlistHittersSort}
          defaultPitcherSort={defaults.watchlistPitchersSort}
          getNote={getNote}
          saveNote={saveNote}
          newsPlayerIds={newsPlayerIds}
        />
      </div>
    </div>
  );
}
