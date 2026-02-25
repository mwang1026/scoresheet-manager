"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star, ListPlus } from "lucide-react";
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
  calculatePlatoonOPS,
  formatIP,
  formatAvg,
  formatRate,
  isPlayerPitcher,
  isEligibleAt,
  getDefenseDisplay,
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  getQualifiedThreshold,
} from "@/lib/stats";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { usePlayersTableState } from "@/lib/hooks/use-players-table-state";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { Pagination } from "@/components/ui/pagination";
import { PlayersToolbar } from "./players-toolbar";
import { compareHitters, comparePitchers } from "./players-sort";

export function PlayersTable() {
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } =
    usePlayerLists();

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { projections } = useProjections();

  // Create team lookup map
  const teamMap = useMemo(
    () => new Map(teams?.map((t) => [t.id, t.name]) || []),
    [teams]
  );

  const defaults = usePageDefaults("players");

  // Projection sources
  const availableSources = useMemo(
    () => getAvailableProjectionSources(projections || []),
    [projections]
  );

  // All table state + URL sync
  const state = usePlayersTableState(defaults, availableSources);

  // Fetch stats from API
  const {
    stats: hitterStatsData,
    isLoading: hitterStatsLoading,
    error: hitterStatsError,
  } = useHitterStats(state.dateRange);
  const {
    stats: pitcherStatsData,
    isLoading: pitcherStatsLoading,
    error: pitcherStatsError,
  } = usePitcherStats(state.dateRange);

  // Aggregate stats by player
  const { hitterStatsMap, pitcherStatsMap } = useMemo(() => {
    if (state.statsSource === "projected") {
      return getProjectionStatsMaps(projections || [], state.projectionSource);
    } else {
      return {
        hitterStatsMap: aggregateHitterStatsByPlayer(hitterStatsData || []),
        pitcherStatsMap: aggregatePitcherStatsByPlayer(pitcherStatsData || []),
      };
    }
  }, [state.statsSource, state.projectionSource, projections, hitterStatsData, pitcherStatsData]);

  // Split players by type
  const hitters = useMemo(
    () => (players || []).filter((p) => !isPlayerPitcher(p)),
    [players]
  );
  const pitchers = useMemo(
    () => (players || []).filter((p) => isPlayerPitcher(p)),
    [players]
  );

  const activePlayers = state.activeTab === "hitters" ? hitters : pitchers;

  // Filter players
  const filteredPlayers = useMemo(() => {
    let filtered = activePlayers;

    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(query));
    }

    if (state.selectedPositions.size > 0) {
      filtered = filtered.filter((p) =>
        Array.from(state.selectedPositions).some((pos) => isEligibleAt(p, pos))
      );
    }

    if (state.selectedHands.size > 0) {
      filtered = filtered.filter((p) => state.selectedHands.has(p.hand));
    }

    if (state.statusFilter === "watchlisted") {
      filtered = filtered.filter((p) => isWatchlisted(p.id));
    } else if (state.statusFilter === "queued") {
      filtered = filtered.filter((p) => isInQueue(p.id));
    } else if (state.statusFilter === "unowned") {
      filtered = filtered.filter((p) => p.team_id === null);
    }

    if (state.statsSource === "actual") {
      if (state.activeTab === "hitters") {
        const threshold = state.minPA === "qualified"
          ? getQualifiedThreshold(state.dateRange, "hitters")
          : state.minPA;
        if (threshold > 0) {
          filtered = filtered.filter(p => (hitterStatsMap.get(p.id)?.PA ?? 0) >= threshold);
        }
      } else {
        const threshold = state.minIP === "qualified"
          ? getQualifiedThreshold(state.dateRange, "pitchers")
          : state.minIP;
        if (threshold > 0) {
          filtered = filtered.filter(p => (pitcherStatsMap.get(p.id)?.IP_outs ?? 0) >= threshold * 3);
        }
      }
    }

    return filtered;
  }, [activePlayers, state.searchQuery, state.selectedPositions, state.selectedHands, state.statusFilter, isWatchlisted, isInQueue, state.statsSource, state.dateRange, state.activeTab, state.minPA, state.minIP, hitterStatsMap, pitcherStatsMap]);

  // Sort players
  const sortedPlayers = useMemo(() => {
    const sorted = [...filteredPlayers];
    if (state.activeTab === "hitters") {
      sorted.sort((a, b) =>
        compareHitters(
          a, b,
          hitterStatsMap.get(a.id),
          hitterStatsMap.get(b.id),
          state.sortColumn,
          state.sortDirection
        )
      );
    } else {
      sorted.sort((a, b) =>
        comparePitchers(
          a, b,
          pitcherStatsMap.get(a.id),
          pitcherStatsMap.get(b.id),
          state.sortColumn,
          state.sortDirection
        )
      );
    }
    return sorted;
  }, [filteredPlayers, state.sortColumn, state.sortDirection, state.activeTab, hitterStatsMap, pitcherStatsMap]);

  // Paginate
  const totalPages = Math.ceil(sortedPlayers.length / state.pageSize);
  const paginatedPlayers = sortedPlayers.slice(
    state.currentPage * state.pageSize,
    (state.currentPage + 1) * state.pageSize
  );

  // Handle watchlist/queue toggles
  const handleWatchlistToggle = (e: React.MouseEvent, playerId: number) => {
    e.stopPropagation();
    toggleWatchlist(playerId);
  };

  const handleQueueToggle = (e: React.MouseEvent, playerId: number) => {
    e.stopPropagation();
    toggleQueue(playerId);
  };

  // Loading/error states
  const isLoading =
    playersLoading ||
    teamsLoading ||
    (state.statsSource === "actual" && (hitterStatsLoading || pitcherStatsLoading));

  const error =
    playersError ||
    teamsError ||
    (state.statsSource === "actual" && (hitterStatsError || pitcherStatsError));

  if (error) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center">
          <p className="text-destructive">Error loading data: {error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Loading players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <PlayersToolbar
        activeTab={state.activeTab}
        defaultHitterSortColumn={defaults.hitterSort.column}
        defaultHitterSortDirection={defaults.hitterSort.direction}
        defaultPitcherSortColumn={defaults.pitcherSort.column}
        defaultPitcherSortDirection={defaults.pitcherSort.direction}
        onTabChange={state.handleTabChange}
        selectedPositions={state.selectedPositions}
        onPositionsChange={state.handlePositionsChange}
        selectedHands={state.selectedHands}
        onHandsChange={state.handleHandsChange}
        statusFilter={state.statusFilter}
        onStatusFilterChange={state.setStatusFilter}
        statsSource={state.statsSource}
        onStatsSourceChange={state.setStatsSource}
        dateRange={state.dateRange}
        onDateRangeChange={state.handleDateRangeChange}
        customStart={state.customStart}
        onCustomStartChange={state.setCustomStart}
        customEnd={state.customEnd}
        onCustomEndChange={state.setCustomEnd}
        onCustomDateBlur={state.updateCustomDateRange}
        minPA={state.minPA}
        onMinPAChange={state.setMinPA}
        minIP={state.minIP}
        onMinIPChange={state.setMinIP}
        projectionSource={state.projectionSource}
        availableSources={availableSources}
        onProjectionSourceChange={state.setProjectionSource}
        searchQuery={state.searchQuery}
        onSearchChange={state.setSearchQuery}
        onResetPage={() => state.setCurrentPage(0)}
      />

      {/* Table */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted border-b-2 border-border">
            {state.activeTab === "hitters" ? (
              <tr>
                <th className="p-2 text-left w-10 font-semibold text-foreground">☆</th>
                <th className="p-2 text-left w-10 font-semibold text-foreground">Q</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("name")}
                >
                  Name <SortIndicator active={state.sortColumn === "name"} direction={state.sortDirection} />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Hand</th>
                <th className="p-2 text-left font-semibold text-foreground">Pos</th>
                <th className="p-2 text-left font-semibold text-foreground">Elig</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("team")}
                >
                  Team <SortIndicator active={state.sortColumn === "team"} direction={state.sortDirection} />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Fantasy Team</th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("PA")}
                >
                  PA <SortIndicator active={state.sortColumn === "PA"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("AB")}
                >
                  AB <SortIndicator active={state.sortColumn === "AB"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("H")}
                >
                  H <SortIndicator active={state.sortColumn === "H"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("HR")}
                >
                  HR <SortIndicator active={state.sortColumn === "HR"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("R")}
                >
                  R <SortIndicator active={state.sortColumn === "R"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("RBI")}
                >
                  RBI <SortIndicator active={state.sortColumn === "RBI"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("SB")}
                >
                  SB <SortIndicator active={state.sortColumn === "SB"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("CS")}
                >
                  CS <SortIndicator active={state.sortColumn === "CS"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("AVG")}
                >
                  AVG <SortIndicator active={state.sortColumn === "AVG"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("OBP")}
                >
                  OBP <SortIndicator active={state.sortColumn === "OBP"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("SLG")}
                >
                  SLG <SortIndicator active={state.sortColumn === "SLG"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("OPS")}
                >
                  OPS <SortIndicator active={state.sortColumn === "OPS"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("vR")}
                >
                  vR <SortIndicator active={state.sortColumn === "vR"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("vL")}
                >
                  vL <SortIndicator active={state.sortColumn === "vL"} direction={state.sortDirection} />
                </th>
              </tr>
            ) : (
              <tr>
                <th className="p-2 text-left w-10 font-semibold text-foreground">☆</th>
                <th className="p-2 text-left w-10 font-semibold text-foreground">Q</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("name")}
                >
                  Name <SortIndicator active={state.sortColumn === "name"} direction={state.sortDirection} />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Hand</th>
                <th className="p-2 text-left font-semibold text-foreground">Pos</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("team")}
                >
                  Team <SortIndicator active={state.sortColumn === "team"} direction={state.sortDirection} />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Fantasy Team</th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("G")}
                >
                  G <SortIndicator active={state.sortColumn === "G"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("GS")}
                >
                  GS <SortIndicator active={state.sortColumn === "GS"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("IP_outs")}
                >
                  IP <SortIndicator active={state.sortColumn === "IP_outs"} direction={state.sortDirection} />
                </th>
                <th className="p-2 text-right tabular-nums font-semibold text-foreground">W-L</th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("K")}
                >
                  K <SortIndicator active={state.sortColumn === "K"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("ER")}
                >
                  ER <SortIndicator active={state.sortColumn === "ER"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("R")}
                >
                  R <SortIndicator active={state.sortColumn === "R"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("BB")}
                >
                  BB <SortIndicator active={state.sortColumn === "BB"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("ERA")}
                >
                  ERA <SortIndicator active={state.sortColumn === "ERA"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("WHIP")}
                >
                  WHIP <SortIndicator active={state.sortColumn === "WHIP"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("K9")}
                >
                  K/9 <SortIndicator active={state.sortColumn === "K9"} direction={state.sortDirection} />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => state.handleSort("SV")}
                >
                  SV <SortIndicator active={state.sortColumn === "SV"} direction={state.sortDirection} />
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {paginatedPlayers.map((player) => {
              const stats =
                state.activeTab === "hitters"
                  ? hitterStatsMap.get(player.id)
                  : pitcherStatsMap.get(player.id);

              return (
                <tr
                  key={player.id}
                  className="even:bg-muted hover:bg-muted"
                >
                  <td className="p-2" onClick={(e) => handleWatchlistToggle(e, player.id)}>
                    {isHydrated && isWatchlisted(player.id) ? (
                      <Star className="w-4 h-4 fill-current text-yellow-500" />
                    ) : (
                      <Star className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="p-2" onClick={(e) => handleQueueToggle(e, player.id)}>
                    {isHydrated && isInQueue(player.id) ? (
                      <ListPlus className="w-4 h-4 text-brand-blue" />
                    ) : (
                      <ListPlus className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="p-2 font-medium">
                    <Link
                      href={`/players/${player.id}`}
                      className="text-primary hover:underline"
                    >
                      {player.name}
                    </Link>
                  </td>
                  <td className="p-2">{player.hand}</td>
                  <td className="p-2">{player.primary_position}</td>

                  {state.activeTab === "hitters" && (
                    <>
                      <td className="p-2 text-muted-foreground">
                        {getDefenseDisplay(player)}
                      </td>
                      <td className="p-2">{player.current_team}</td>
                      <td className="p-2 text-muted-foreground">
                        {player.team_id !== null ? teamMap.get(player.team_id) : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "PA" in stats ? stats.PA : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "AB" in stats ? stats.AB : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "H" in stats ? stats.H : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "HR" in stats ? stats.HR : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "R" in stats ? stats.R : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "RBI" in stats ? stats.RBI : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "SB" in stats ? stats.SB : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "CS" in stats ? stats.CS : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "AVG" in stats ? formatAvg(stats.AVG) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "OBP" in stats ? formatAvg(stats.OBP) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "SLG" in stats ? formatAvg(stats.SLG) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "OPS" in stats ? formatAvg(stats.OPS) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "OPS" in stats
                          ? formatAvg(calculatePlatoonOPS(stats.OPS, player.ob_vr, player.sl_vr))
                          : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "OPS" in stats
                          ? formatAvg(calculatePlatoonOPS(stats.OPS, player.ob_vl, player.sl_vl))
                          : "---"}
                      </td>
                    </>
                  )}

                  {state.activeTab === "pitchers" && (
                    <>
                      <td className="p-2">{player.current_team}</td>
                      <td className="p-2 text-muted-foreground">
                        {player.team_id !== null ? teamMap.get(player.team_id) : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "G" in stats ? stats.G : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "GS" in stats ? stats.GS : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "W" in stats && "L" in stats
                          ? `${stats.W}-${stats.L}`
                          : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "K" in stats ? stats.K : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "ER" in stats ? stats.ER : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "R" in stats ? stats.R : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "BB" in stats ? stats.BB : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "WHIP" in stats ? formatRate(stats.WHIP) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "K9" in stats ? formatRate(stats.K9) : "---"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {stats && "SV" in stats ? stats.SV : "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={state.currentPage}
        totalPages={totalPages}
        pageSize={state.pageSize}
        totalItems={sortedPlayers.length}
        onPageChange={state.setCurrentPage}
        onPageSizeChange={(size) => {
          state.setPageSize(size);
          state.setCurrentPage(0);
        }}
      />
    </div>
  );
}
