"use client";

import { useMemo, useState, useEffect } from "react";
import { draftOrder } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
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

type PicksFilter = "all" | "mine";

export default function DraftPage() {
  const {
    queue,
    removeFromQueue,
    removeFromWatchlist,
    reorderQueue,
    isHydrated,
  } = usePlayerLists();

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { projections } = useProjections();

  const [dateRange, setDateRange] = useState<DateRange>({ type: "last30" });
  const [statsSource, setStatsSource] = useState<StatsSource>("actual");
  const [customStart, setCustomStart] = useState("2025-01-01");
  const [customEnd, setCustomEnd] = useState("2025-12-31");
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
      <div className="p-8">
        <p className="text-destructive">Error loading data: {error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading draft...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-8">
      {/* Header */}
      <div className="flex-none pb-4">
        <div className="flex justify-between items-baseline flex-wrap gap-2">
          <h1 className="text-4xl font-bold">Draft</h1>
          <span className="text-4xl font-bold text-brand-blue">{myTeam?.name ?? "Power Hitters"}</span>
        </div>
      </div>

      {/* Stats Source and Date Range Controls */}
      <div className="flex-none flex flex-wrap gap-4 items-center pb-6">
        {/* Stats source toggle */}
        <div className="flex gap-2 items-center">
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

      {/* Two-panel layout */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left panel: Draft Queue (wide) */}
        <div className="flex-1 overflow-y-auto">
          <DraftQueuePanel
            players={queuePlayers}
            hitterStatsMap={hitterStatsMap}
            pitcherStatsMap={pitcherStatsMap}
            onRemove={removeFromQueue}
            onRemoveFromWatchlist={removeFromWatchlist}
            onReorder={reorderQueue}
            isHydrated={isHydrated}
          />
        </div>

        {/* Right panel: Draft Picks (narrow) */}
        <div className="w-80 flex-none overflow-y-auto">
          <DraftPicksPanel
            picks={draftOrder}
            teams={teams || []}
            myTeamId={myTeam?.id}
            filterMode={picksFilter}
            onFilterChange={setPicksFilter}
          />
        </div>
      </div>
    </div>
  );
}
