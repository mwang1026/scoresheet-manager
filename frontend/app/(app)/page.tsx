"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import {
  usePlayers,
  useProjections,
  useStatsForSource,
  useTeams,
} from "@/lib/hooks/use-players-data";
import { useTeamContext } from "@/lib/contexts/team-context";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import { useDraftSchedule } from "@/lib/hooks/use-draft-schedule";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import {
  aggregateRosterHitters,
  aggregateRosterPitchers,
  buildStatsMaps,
  isPlayerPitcher,
  getAvailableProjectionSources,
  pickPlayers,
  usesDateRange,
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { TeamStatsSummary } from "@/components/dashboard/team-stats-summary";
import { RosterHittersTable } from "@/components/dashboard/roster-hitters-table";
import { RosterPitchersTable } from "@/components/dashboard/roster-pitchers-table";
import { WatchlistTable } from "@/components/dashboard/watchlist-table";
import { DraftQueueTable } from "@/components/dashboard/draft-queue-table";
import { DraftTimeline } from "@/components/dashboard/draft-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { PlayoffModeNote } from "@/components/ui/playoff-mode-note";
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
  const { updatePageSettings } = useSettingsContext();
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

  const handleStatsSourceChange = useCallback((s: StatsSource) => {
    setStatsSource(s);
    updatePageSettings("dashboard", { statsSource: s });
  }, [updatePageSettings]);

  const handleProjectionSourceChange = useCallback((s: string) => {
    setProjectionSource(s);
    updatePageSettings("dashboard", { projectionSource: s });
  }, [updatePageSettings]);

  // Fetch stats from API (full season in playoff mode)
  const {
    hitterStats: hitterStatsData,
    pitcherStats: pitcherStatsData,
    isLoading: statsLoading,
    error: statsError,
  } = useStatsForSource(statsSource, dateRange, defaults.seasonYear);

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

  // Per-player stat maps for the selected source, plus roster totals
  const {
    hitterStatsMap,
    pitcherStatsMap,
    playoffHitterMeta,
    playoffPitcherMeta,
    teamHitterStats,
    teamPitcherStats,
    teamHitterStatsByPlayer,
    teamPitcherStatsByPlayer,
  } = useMemo(() => {
    const maps = buildStatsMaps({
      statsSource,
      projectionSource,
      projections,
      hitterRows: hitterStatsData,
      pitcherRows: pitcherStatsData,
      seasonYear: defaults.seasonYear,
    });
    return {
      ...maps,
      teamHitterStats: aggregateRosterHitters(myHitters, maps.hitterStatsMap),
      teamPitcherStats: aggregateRosterPitchers(myPitchers, maps.pitcherStatsMap),
      teamHitterStatsByPlayer: pickPlayers(myHitters, maps.hitterStatsMap),
      teamPitcherStatsByPlayer: pickPlayers(myPitchers, maps.pitcherStatsMap),
    };
  }, [myHitters, myPitchers, statsSource, projectionSource, projections, hitterStatsData, pitcherStatsData, defaults.seasonYear]);

  const columnSet = statsSource === "playoff" ? "playoff" : "default";

  // Loading state (context handles team loading)
  const isLoading = playersLoading || statsLoading;

  // Error state (context handles team errors)
  const error = playersError || statsError;

  if (error) {
    return (
      <div className="px-3 py-6 sm:px-6 lg:px-8">
        <p className="text-destructive">Error loading data: {error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-6">
        <TableSkeleton rows={12} columns={11} />
      </div>
    );
  }

  return (
    <div className="px-3 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <PageHeader title="Dashboard" />
      </div>

      {/* Stats Source and Date Range Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <StatsSourceToggle value={statsSource} onChange={handleStatsSourceChange} />
        {statsSource === "projected" && (
          <ProjectionSourceSelect
            value={projectionSource}
            sources={availableSources}
            onChange={handleProjectionSourceChange}
          />
        )}
        {usesDateRange(statsSource) && (
          <DateRangeSelect
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            seasonYear={defaults.seasonYear}
          />
        )}
        {statsSource === "playoff" && <PlayoffModeNote seasonYear={defaults.seasonYear} />}
      </div>

      {/* Two-column responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left column (wider) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Team Stats Summary - full width */}
          <TeamStatsSummary
            hitterStats={teamHitterStats}
            pitcherStats={teamPitcherStats}
            weighted={statsSource === "playoff"}
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
            columnSet={columnSet}
            playoffMeta={playoffHitterMeta}
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
            columnSet={columnSet}
            playoffMeta={playoffPitcherMeta}
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
