"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DepthChartToolbar } from "@/components/depth-charts/depth-chart-toolbar";
import { DepthChartLegend } from "@/components/depth-charts/depth-chart-legend";
import { DepthChartMatrix } from "@/components/depth-charts/depth-chart-matrix";
import {
  usePlayers,
  useTeams,
  useHitterStats,
  usePitcherStats,
  useProjections,
} from "@/lib/hooks/use-players-data";
import { useDraftSchedule } from "@/lib/hooks/use-draft-schedule";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { buildAllTeamDepthCharts } from "@/lib/depth-charts";
import { getTopAvailableByPosition } from "@/lib/depth-charts/available-players";
import type { AvailablePlayerEntry } from "@/lib/depth-charts/available-players";
import type { DepthChartPosition, ViewMode } from "@/lib/depth-charts/types";

export default function DepthChartsPage() {
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams: allTeams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { projections } = useProjections();
  const { schedule } = useDraftSchedule();

  const defaults = usePageDefaults("depth-charts");
  const { updatePageSettings } = useSettingsContext();

  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [viewMode, setViewMode] = useState<ViewMode>("combined");

  const availableSources = useMemo(
    () => getAvailableProjectionSources(projections || []),
    [projections]
  );
  const [projectionSource, setProjectionSource] = useState(availableSources[0] ?? "");

  useEffect(() => {
    if (projectionSource === "" && availableSources.length > 0) {
      setProjectionSource(availableSources[0]);
    }
  }, [availableSources, projectionSource]);

  const handleStatsSourceChange = useCallback(
    (s: StatsSource) => {
      setStatsSource(s);
      updatePageSettings("depth-charts", { statsSource: s });
    },
    [updatePageSettings]
  );

  const handleProjectionSourceChange = useCallback(
    (s: string) => {
      setProjectionSource(s);
      updatePageSettings("depth-charts", { projectionSource: s });
    },
    [updatePageSettings]
  );

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

  const { depthChartTeams, availableByPosition } = useMemo(() => {
    const playersList = players || [];
    const teamsList = allTeams || [];

    if (teamsList.length === 0) {
      return {
        depthChartTeams: [] as ReturnType<typeof buildAllTeamDepthCharts>,
        availableByPosition: new Map<DepthChartPosition, AvailablePlayerEntry[]>(),
      };
    }

    let hitterStatsMap: Map<number, ReturnType<typeof aggregateHitterStatsByPlayer> extends Map<number, infer V> ? V : never>;
    let pitcherStatsMap: Map<number, ReturnType<typeof aggregatePitcherStatsByPlayer> extends Map<number, infer V> ? V : never>;

    if (statsSource === "projected") {
      const maps = getProjectionStatsMaps(projections || [], projectionSource);
      hitterStatsMap = maps.hitterStatsMap;
      pitcherStatsMap = maps.pitcherStatsMap;
    } else {
      hitterStatsMap = aggregateHitterStatsByPlayer(hitterStatsData || []);
      pitcherStatsMap = aggregatePitcherStatsByPlayer(pitcherStatsData || []);
    }

    return {
      depthChartTeams: buildAllTeamDepthCharts(
        teamsList,
        playersList,
        hitterStatsMap,
        pitcherStatsMap,
        schedule?.picks,
      ),
      availableByPosition: getTopAvailableByPosition(
        playersList,
        hitterStatsMap,
        pitcherStatsMap,
        statsSource,
      ),
    };
  }, [
    players,
    allTeams,
    statsSource,
    projectionSource,
    projections,
    hitterStatsData,
    pitcherStatsData,
    schedule,
  ]);

  const isLoading =
    playersLoading || teamsLoading ||
    (statsSource === "actual" && (hitterStatsLoading || pitcherStatsLoading));

  const error = playersError || teamsError ||
    (statsSource === "actual" && (hitterStatsError || pitcherStatsError));

  return (
    <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-4">
      <PageHeader title="Depth Charts" />
      <p className="text-[11px] text-muted-foreground -mt-2">
        Hover a position label to see top available free agents
      </p>

      <DepthChartToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statsSource={statsSource}
        onStatsSourceChange={handleStatsSourceChange}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        seasonYear={defaults.seasonYear}
        projectionSource={projectionSource}
        projectionSources={availableSources}
        onProjectionSourceChange={handleProjectionSourceChange}
      />

      <DepthChartLegend />

      {error ? (
        <p className="text-destructive">
          Error loading data: {(error as Error).message}
        </p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading depth charts...</p>
      ) : depthChartTeams.length === 0 ? (
        <p className="text-muted-foreground">No teams found.</p>
      ) : (
        <DepthChartMatrix teams={depthChartTeams} viewMode={viewMode} availableByPosition={availableByPosition} />
      )}
    </div>
  );
}
