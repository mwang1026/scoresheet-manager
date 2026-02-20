"use client";

import { useMemo, useState } from "react";
import { players, teams, hitterStats, pitcherStats, projections, draftOrder } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  filterStatsByDateRange,
  type DateRange,
} from "@/lib/stats";
import { DraftQueuePanel } from "@/components/draft/draft-queue-panel";
import { DraftPicksPanel } from "@/components/draft/draft-picks-panel";

type StatsSource = "actual" | "projected";
type PicksFilter = "all" | "mine";

export default function DraftPage() {
  const {
    queue,
    removeFromQueue,
    removeFromWatchlist,
    reorderQueue,
    isHydrated,
  } = usePlayerLists();

  const [dateRange, setDateRange] = useState<DateRange>({ type: "last30" });
  const [statsSource, setStatsSource] = useState<StatsSource>("actual");
  const [customStart, setCustomStart] = useState("2025-01-01");
  const [customEnd, setCustomEnd] = useState("2025-12-31");
  const [picksFilter, setPicksFilter] = useState<PicksFilter>("all");

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

  // Compute stats for selected date range
  const { hitterStatsMap, pitcherStatsMap } = useMemo(() => {
    if (statsSource === "projected") {
      // Use projections - cast to daily stats format with dummy date
      const hitterProjections = projections
        .filter((p) => p.player_type === "hitter")
        .map((p) => ({ ...p, date: "2025-01-01" }));
      const pitcherProjections = projections
        .filter((p) => p.player_type === "pitcher")
        .map((p) => ({ ...p, date: "2025-01-01" }));

      return {
        hitterStatsMap: aggregateHitterStatsByPlayer(hitterProjections),
        pitcherStatsMap: aggregatePitcherStatsByPlayer(pitcherProjections),
      };
    } else {
      // Use actual stats filtered by date range
      const filteredHitterStats = filterStatsByDateRange(hitterStats, dateRange);
      const filteredPitcherStats = filterStatsByDateRange(pitcherStats, dateRange);

      return {
        hitterStatsMap: aggregateHitterStatsByPlayer(filteredHitterStats),
        pitcherStatsMap: aggregatePitcherStatsByPlayer(filteredPitcherStats),
      };
    }
  }, [statsSource, dateRange]);

  // Queue players: preserve array order
  const queuePlayers = useMemo(() => {
    const playerMap = new Map(players.map((p) => [p.id, p]));
    return queue
      .map((id) => playerMap.get(id))
      .filter((p): p is typeof players[0] => p !== undefined);
  }, [queue]);

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
            teams={teams}
            myTeamId={myTeam?.id}
            filterMode={picksFilter}
            onFilterChange={setPicksFilter}
          />
        </div>
      </div>
    </div>
  );
}
