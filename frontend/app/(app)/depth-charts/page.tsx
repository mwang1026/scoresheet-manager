"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DepthChartToolbar } from "@/components/depth-charts/depth-chart-toolbar";
import { DepthChartLegend } from "@/components/depth-charts/depth-chart-legend";
import { DepthChartMatrix } from "@/components/depth-charts/depth-chart-matrix";
import {
  usePlayers,
  useTeams,
  useProjections,
  useStatsForSource,
} from "@/lib/hooks/use-players-data";
import { useDraftSchedule } from "@/lib/hooks/use-draft-schedule";
import { useNewsFlags } from "@/lib/hooks/use-news-data";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import {
  buildStatsMaps,
  getAvailableProjectionSources,
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
  const { newsPlayerIds } = useNewsFlags();
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
    hitterStats: hitterStatsData,
    pitcherStats: pitcherStatsData,
    isLoading: statsLoading,
    error: statsError,
  } = useStatsForSource(statsSource, dateRange, defaults.seasonYear);

  const { depthChartTeams, availableByPosition } = useMemo(() => {
    const playersList = players || [];
    const teamsList = allTeams || [];

    if (teamsList.length === 0) {
      return {
        depthChartTeams: [] as ReturnType<typeof buildAllTeamDepthCharts>,
        availableByPosition: new Map<DepthChartPosition, AvailablePlayerEntry[]>(),
      };
    }

    const { hitterStatsMap, pitcherStatsMap } = buildStatsMaps({
      statsSource,
      projectionSource,
      projections,
      hitterRows: hitterStatsData,
      pitcherRows: pitcherStatsData,
      seasonYear: defaults.seasonYear,
    });

    return {
      depthChartTeams: buildAllTeamDepthCharts(
        teamsList,
        playersList,
        hitterStatsMap,
        pitcherStatsMap,
        schedule?.picks,
        statsSource,
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
    defaults.seasonYear,
  ]);

  const isLoading = playersLoading || teamsLoading || statsLoading;

  const error = playersError || teamsError || statsError;

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
        <DepthChartMatrix teams={depthChartTeams} viewMode={viewMode} statsSource={statsSource} availableByPosition={availableByPosition} newsPlayerIds={newsPlayerIds} />
      )}
    </div>
  );
}
