"use client";

import { useMemo, useState, useEffect } from "react";
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
import { TeamCard, type OpponentTeamData } from "./team-card";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";

const ALL_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "DH", "P", "SR"] as const;

export function OpponentsGrid() {
  const { players, isLoading: playersLoading } = usePlayers();
  const { teams: allTeams } = useTeams();
  const { projections } = useProjections();

  const defaults = usePageDefaults("opponents");
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [customStart, setCustomStart] = useState("2025-01-01");
  const [customEnd, setCustomEnd] = useState("2025-12-31");
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

  const updateCustomDateRange = () => {
    if (dateRange.type === "custom") {
      setDateRange({ type: "custom", start: customStart, end: customEnd });
    }
  };

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
            return stats ? { ...stats, player_id: p.id, date: "2025-01-01" } : null;
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        const pitcherProjectionStats = filteredPitchers
          .map((p) => {
            const stats = pitcherStatsMap.get(p.id);
            return stats ? { ...stats, player_id: p.id, date: "2025-01-01" } : null;
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
