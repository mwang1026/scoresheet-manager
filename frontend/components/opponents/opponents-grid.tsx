"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
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
  aggregateHitterStats,
  aggregatePitcherStats,
  isPlayerPitcher,
  isEligibleAt,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { ProjectionSourceSelect } from "@/components/ui/projection-source-select";
import { TeamCard, type OpponentTeamData } from "./team-card";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import { useNewsFlags } from "@/lib/hooks/use-news-data";
import { ALL_POSITIONS, PROJECTION_SENTINEL_DATE } from "@/lib/constants";

export function OpponentsGrid() {
  const { players, isLoading: playersLoading } = usePlayers();
  const { teams: allTeams } = useTeams();
  const { projections } = useProjections();
  const { getNote, saveNote } = usePlayerNotes();
  const { newsPlayerIds } = useNewsFlags();

  const defaults = usePageDefaults("opponents");
  const { updatePageSettings } = useSettingsContext();
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());

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

  const handleStatsSourceChange = useCallback((s: StatsSource) => {
    setStatsSource(s);
    updatePageSettings("opponents", { statsSource: s });
  }, [updatePageSettings]);

  const handleProjectionSourceChange = useCallback((s: string) => {
    setProjectionSource(s);
    updatePageSettings("opponents", { projectionSource: s });
  }, [updatePageSettings]);

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

  const opponentTeamsData = useMemo((): OpponentTeamData[] => {
    const playersList = players || [];
    const teamsList = allTeams || [];

    const opponentTeams = teamsList.filter((t) => !t.is_my_team);

    // Group players by team_id
    const playersByTeam = new Map<number, typeof playersList>();
    for (const player of playersList) {
      if (player.team_id !== null) {
        const existing = playersByTeam.get(player.team_id) ?? [];
        playersByTeam.set(player.team_id, [...existing, player]);
      }
    }

    if (statsSource === "projected") {
      const { hitterStatsMap, pitcherStatsMap } = getProjectionStatsMaps(
        projections || [],
        projectionSource
      );

      return opponentTeams.map((team) => {
        const teamPlayers = playersByTeam.get(team.id) ?? [];
        const hitters = teamPlayers.filter((p) => !isPlayerPitcher(p));
        const pitchers = teamPlayers.filter((p) => isPlayerPitcher(p));

        const filteredHitters = selectedPositions.size > 0
          ? hitters.filter((p) => Array.from(selectedPositions).some((pos) => isEligibleAt(p, pos)))
          : hitters;
        const filteredPitchers = selectedPositions.size > 0
          ? pitchers.filter((p) => Array.from(selectedPositions).some((pos) => p.primary_position === pos))
          : pitchers;

        const hitterProjectionStats = filteredHitters
          .map((p) => {
            const stats = hitterStatsMap.get(p.id);
            return stats ? { ...stats, player_id: p.id, date: PROJECTION_SENTINEL_DATE } : null;
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        const pitcherProjectionStats = filteredPitchers
          .map((p) => {
            const stats = pitcherStatsMap.get(p.id);
            return stats ? { ...stats, player_id: p.id, date: PROJECTION_SENTINEL_DATE } : null;
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        return {
          team,
          hitters: filteredHitters,
          pitchers: filteredPitchers,
          hitterStatsMap,
          pitcherStatsMap,
          teamHitterTotals: aggregateHitterStats(hitterProjectionStats),
          teamPitcherTotals: aggregatePitcherStats(pitcherProjectionStats),
          defaultHitterSort: defaults.hitterSort,
          defaultPitcherSort: defaults.pitcherSort,
          getNote,
          saveNote,
          newsPlayerIds,
        };
      });
    } else {
      const allHitterStats = hitterStatsData || [];
      const allPitcherStats = pitcherStatsData || [];

      const globalHitterMap = aggregateHitterStatsByPlayer(allHitterStats);
      const globalPitcherMap = aggregatePitcherStatsByPlayer(allPitcherStats);

      return opponentTeams.map((team) => {
        const teamPlayers = playersByTeam.get(team.id) ?? [];
        const hitters = teamPlayers.filter((p) => !isPlayerPitcher(p));
        const pitchers = teamPlayers.filter((p) => isPlayerPitcher(p));

        const filteredHitters = selectedPositions.size > 0
          ? hitters.filter((p) => Array.from(selectedPositions).some((pos) => isEligibleAt(p, pos)))
          : hitters;
        const filteredPitchers = selectedPositions.size > 0
          ? pitchers.filter((p) => Array.from(selectedPositions).some((pos) => p.primary_position === pos))
          : pitchers;

        const filteredHitterIds = new Set(filteredHitters.map((p) => p.id));
        const filteredPitcherIds = new Set(filteredPitchers.map((p) => p.id));

        const teamHitterStats = allHitterStats.filter((s) => filteredHitterIds.has(s.player_id));
        const teamPitcherStats = allPitcherStats.filter((s) => filteredPitcherIds.has(s.player_id));

        return {
          team,
          hitters: filteredHitters,
          pitchers: filteredPitchers,
          hitterStatsMap: globalHitterMap,
          pitcherStatsMap: globalPitcherMap,
          teamHitterTotals: aggregateHitterStats(teamHitterStats),
          teamPitcherTotals: aggregatePitcherStats(teamPitcherStats),
          defaultHitterSort: defaults.hitterSort,
          defaultPitcherSort: defaults.pitcherSort,
          getNote,
          saveNote,
          newsPlayerIds,
        };
      });
    }
  }, [
    players,
    allTeams,
    statsSource,
    projectionSource,
    projections,
    hitterStatsData,
    pitcherStatsData,
    selectedPositions,
    defaults.hitterSort,
    defaults.pitcherSort,
    getNote,
    saveNote,
    newsPlayerIds,
  ]);

  const isLoading =
    playersLoading ||
    (statsSource === "actual" && (hitterStatsLoading || pitcherStatsLoading));

  const error =
    statsSource === "actual" && (hitterStatsError || pitcherStatsError);

  if (error) {
    return (
      <p className="text-destructive">
        Error loading data: {(error as Error).message}
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading opponent stats...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="space-y-2">
        {/* Row 1: Stats source + date/projection source */}
        <div className="flex flex-wrap gap-4 items-center">
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

        {/* Row 2: Position filter */}
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">Position:</span>
          <FilterDropdown
            label="Position"
            options={ALL_POSITIONS.map((p) => ({ value: p, label: p }))}
            selected={selectedPositions}
            onChange={setSelectedPositions}
          />
        </div>
      </div>

      {/* Teams grid: 2 columns on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {opponentTeamsData.map((data) => (
          <TeamCard key={data.team.id} data={data} />
        ))}
      </div>
    </div>
  );
}
