"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import { useDraftSchedule } from "@/lib/hooks/use-draft-schedule";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import {
  usePlayers,
  useTeams,
  useHitterStats,
  usePitcherStats,
  useProjections,
} from "@/lib/hooks/use-players-data";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { DraftQueuePanel } from "@/components/draft/draft-queue-panel";
import { DraftPicksPanel } from "@/components/draft/draft-picks-panel";
import { PageHeader } from "@/components/layout/page-header";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { ProjectionSourceSelect } from "@/components/ui/projection-source-select";
import { useNewsFlags } from "@/lib/hooks/use-news-data";
import { TableSkeleton } from "@/components/ui/table-skeleton";

type PicksFilter = "all" | "mine";

export default function DraftPage() {
  const {
    queue,
    removeFromQueue,
    removeFromWatchlist,
    reorderQueue,
    isHydrated,
  } = usePlayerLists();
  const { getNote, saveNote } = usePlayerNotes();
  const { newsPlayerIds } = useNewsFlags();
  const { schedule, refresh } = useDraftSchedule();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { projections } = useProjections();

  const defaults = usePageDefaults("draft");
  const { updatePageSettings } = useSettingsContext();
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [picksFilter, setPicksFilter] = useState<PicksFilter>("all");

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
    updatePageSettings("draft", { statsSource: s });
  }, [updatePageSettings]);

  const handleProjectionSourceChange = useCallback((s: string) => {
    setProjectionSource(s);
    updatePageSettings("draft", { projectionSource: s });
  }, [updatePageSettings]);

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

  // Get my team
  const myTeam = useMemo(() => (teams || []).find((t) => t.is_my_team), [teams]);

  // Compute stats for selected date range
  const { hitterStatsMap, pitcherStatsMap } = useMemo(() => {
    if (statsSource === "projected") {
      // Use projections filtered by source
      return getProjectionStatsMaps(projections || [], projectionSource);
    } else {
      // Use actual stats from API
      return {
        hitterStatsMap: aggregateHitterStatsByPlayer(hitterStatsData || []),
        pitcherStatsMap: aggregatePitcherStatsByPlayer(pitcherStatsData || []),
      };
    }
  }, [statsSource, projectionSource, projections, hitterStatsData, pitcherStatsData]);

  // Queue players: preserve array order
  const queuePlayers = useMemo(() => {
    const playersList = players || [];
    const playerMap = new Map(playersList.map((p) => [p.id, p]));
    return queue
      .map((id) => playerMap.get(id))
      .filter((p): p is NonNullable<typeof playerMap extends Map<number, infer P> ? P : never> => p !== undefined);
  }, [players, queue]);

  // Loading state
  const isLoading =
    playersLoading ||
    teamsLoading ||
    (statsSource === "actual" && (hitterStatsLoading || pitcherStatsLoading));

  // Error state
  const error =
    playersError ||
    teamsError ||
    (statsSource === "actual" && (hitterStatsError || pitcherStatsError));

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
        <TableSkeleton rows={10} columns={6} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-3 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex-none pb-4">
        <PageHeader title="Draft" />
      </div>

      {/* Stats Source and Date Range Controls */}
      <div className="flex-none flex flex-wrap gap-4 items-center pb-6">
        <StatsSourceToggle value={statsSource} onChange={handleStatsSourceChange} />
        {statsSource === "projected" && (
          <ProjectionSourceSelect
            value={projectionSource}
            sources={availableSources}
            onChange={handleProjectionSourceChange}
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

      {/* Two-panel layout — stacks vertically below lg */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left panel: Draft Queue (wider) */}
        <div className="flex-1 lg:flex-[3] overflow-y-auto min-h-[50vh] lg:min-h-0">
          <DraftQueuePanel
            players={queuePlayers}
            hitterStatsMap={hitterStatsMap}
            pitcherStatsMap={pitcherStatsMap}
            onRemove={removeFromQueue}
            onRemoveFromWatchlist={removeFromWatchlist}
            onReorder={reorderQueue}
            isHydrated={isHydrated}
            getNote={getNote}
            saveNote={saveNote}
            newsPlayerIds={newsPlayerIds}
          />
        </div>

        {/* Right panel: Draft Picks (narrower, caps at 460px) */}
        <div className="flex-1 lg:flex-[2] lg:max-w-[460px] overflow-y-auto min-h-0">
          <DraftPicksPanel
            teams={teams ?? []}
            picks={schedule?.picks ?? []}
            myTeamId={myTeam?.id}
            filterMode={picksFilter}
            onFilterChange={setPicksFilter}
            draftComplete={schedule?.draft_complete ?? false}
            lastScrapedAt={schedule?.last_scraped_at ?? null}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </div>
      </div>
    </div>
  );
}
