"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star, ListPlus } from "lucide-react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import { useNewsFlags } from "@/lib/hooks/use-news-data";
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
  getAvailableProjectionSources,
  getProjectionStatsMaps,
  getQualifiedThreshold,
} from "@/lib/stats";
import { PIN_WIDTHS, getPinWidths, formatFantasyTeamAbbr } from "@/lib/table-helpers";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { PositionDisplay } from "@/components/ui/position-display";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { usePlayersTableState } from "@/lib/hooks/use-players-table-state";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { Pagination } from "@/components/ui/pagination";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { PlayersToolbar } from "./players-toolbar";
import { compareHitters, comparePitchers } from "./players-sort";

export function PlayersTable() {
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } =
    usePlayerLists();
  const { getNote, saveNote } = usePlayerNotes();
  const { newsPlayerIds } = useNewsFlags();
  const isMobile = useIsMobile();
  const pw = getPinWidths(isMobile);

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { projections } = useProjections();

  // Create team lookup map (stores full team object for abbreviation + tooltip)
  const teamMap = useMemo(
    () => new Map(teams?.map((t) => [t.id, t]) || []),
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
        <TableSkeleton rows={20} columns={15} />
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
        onDateRangeChange={state.setDateRange}
        seasonYear={defaults.seasonYear}
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
      <div className="border rounded overflow-x-scroll overflow-y-auto md:max-h-[75vh] scroll-hint">
        <table className="min-w-full text-xs whitespace-nowrap">
          <thead className="bg-muted border-b-2 border-border">
            {state.activeTab === "hitters" ? (
              <tr>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-col-header hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }}>☆</th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-col-header hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }}>Q</th>
                <th
                  className="py-1.5 px-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-col-header sticky-col-divider"
                  style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}
                  onClick={() => state.handleSort("name")}
                >
                  Name <SortIndicator active={state.sortColumn === "name"} direction={state.sortDirection} />
                </th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-header-cell hidden md:table-cell">Hand</th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-header-cell hidden md:table-cell">Pos</th>
                <th
                  className="py-1.5 px-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("team")}
                >
                  Team <SortIndicator active={state.sortColumn === "team"} direction={state.sortDirection} />
                </th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-header-cell">FTeam</th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("PA")}
                >
                  PA <SortIndicator active={state.sortColumn === "PA"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("AB")}
                >
                  AB <SortIndicator active={state.sortColumn === "AB"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("H")}
                >
                  H <SortIndicator active={state.sortColumn === "H"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("HR")}
                >
                  HR <SortIndicator active={state.sortColumn === "HR"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("R")}
                >
                  R <SortIndicator active={state.sortColumn === "R"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("RBI")}
                >
                  RBI <SortIndicator active={state.sortColumn === "RBI"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("SB")}
                >
                  SB <SortIndicator active={state.sortColumn === "SB"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("CS")}
                >
                  CS <SortIndicator active={state.sortColumn === "CS"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("AVG")}
                >
                  AVG <SortIndicator active={state.sortColumn === "AVG"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("OBP")}
                >
                  OBP <SortIndicator active={state.sortColumn === "OBP"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("SLG")}
                >
                  SLG <SortIndicator active={state.sortColumn === "SLG"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("OPS")}
                >
                  OPS <SortIndicator active={state.sortColumn === "OPS"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("vR")}
                >
                  vR <SortIndicator active={state.sortColumn === "vR"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("vL")}
                >
                  vL <SortIndicator active={state.sortColumn === "vL"} direction={state.sortDirection} />
                </th>
              </tr>
            ) : (
              <tr>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-col-header hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }}>☆</th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-col-header hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }}>Q</th>
                <th
                  className="py-1.5 px-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-col-header sticky-col-divider"
                  style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}
                  onClick={() => state.handleSort("name")}
                >
                  Name <SortIndicator active={state.sortColumn === "name"} direction={state.sortDirection} />
                </th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-header-cell hidden md:table-cell">Hand</th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-header-cell">Pos</th>
                <th
                  className="py-1.5 px-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("team")}
                >
                  Team <SortIndicator active={state.sortColumn === "team"} direction={state.sortDirection} />
                </th>
                <th className="py-1.5 px-2 text-left font-semibold text-foreground sticky-header-cell">FTeam</th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("G")}
                >
                  G <SortIndicator active={state.sortColumn === "G"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("GS")}
                >
                  GS <SortIndicator active={state.sortColumn === "GS"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("IP_outs")}
                >
                  IP <SortIndicator active={state.sortColumn === "IP_outs"} direction={state.sortDirection} />
                </th>
                <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground sticky-header-cell">W-L</th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("K")}
                >
                  K <SortIndicator active={state.sortColumn === "K"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("ER")}
                >
                  ER <SortIndicator active={state.sortColumn === "ER"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("R")}
                >
                  R <SortIndicator active={state.sortColumn === "R"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("BB")}
                >
                  BB <SortIndicator active={state.sortColumn === "BB"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("ERA")}
                >
                  ERA <SortIndicator active={state.sortColumn === "ERA"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("WHIP")}
                >
                  WHIP <SortIndicator active={state.sortColumn === "WHIP"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("K9")}
                >
                  K/9 <SortIndicator active={state.sortColumn === "K9"} direction={state.sortDirection} />
                </th>
                <th
                  className="py-1.5 px-2 text-right font-mono tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground sticky-header-cell"
                  onClick={() => state.handleSort("SV")}
                >
                  SV <SortIndicator active={state.sortColumn === "SV"} direction={state.sortDirection} />
                </th>
              </tr>
            )}
          </thead>
          <tbody key={`${state.sortColumn}-${state.sortDirection}`} className="animate-fade-in">
            {paginatedPlayers.map((player) => {
              const stats =
                state.activeTab === "hitters"
                  ? hitterStatsMap.get(player.id)
                  : pitcherStatsMap.get(player.id);

              return (
                <tr
                  key={player.id}
                  className="odd:bg-background even:bg-muted hover:bg-row-hover transition-colors duration-100"
                >
                  <td className="py-1.5 px-2 sticky-col cursor-pointer hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }} onClick={(e) => handleWatchlistToggle(e, player.id)}>
                    <span className="inline-flex items-center justify-center">
                      {isHydrated && isWatchlisted(player.id) ? (
                        <Star className="w-4 h-4 fill-current text-brand" />
                      ) : (
                        <Star className="w-4 h-4 text-muted-foreground" />
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 sticky-col cursor-pointer hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }} onClick={(e) => handleQueueToggle(e, player.id)}>
                    <span className="inline-flex items-center justify-center">
                      {isHydrated && isInQueue(player.id) ? (
                        <ListPlus className="w-4 h-4 text-brand" />
                      ) : (
                        <ListPlus className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 font-medium sticky-col sticky-col-divider" style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}>
                    <Link
                      href={`/players/${player.id}`}
                      className="text-primary hover:underline"
                    >
                      {player.name}
                    </Link>
                    <NoteIcon playerId={player.id} playerName={player.name} noteContent={getNote(player.id)} onSave={saveNote} />
                    <NewsIcon playerId={player.id} hasNews={newsPlayerIds.has(player.id)} />
                    <ILIcon ilType={player.il_type} ilDate={player.il_date} />
                  </td>

                  {state.activeTab === "hitters" && (
                    <>
                      <td className="py-1.5 px-2 hidden md:table-cell">{player.hand}</td>
                      <td className="py-1.5 px-2 hidden md:table-cell">
                        <PositionDisplay player={player} />
                      </td>
                      <td className="py-1.5 px-2">{player.current_team}</td>
                      <td className="py-1.5 px-2 text-muted-foreground" title={player.team_id !== null ? teamMap.get(player.team_id)?.name : undefined}>
                        {player.team_id !== null ? formatFantasyTeamAbbr(teamMap.get(player.team_id)) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "PA" in stats ? stats.PA : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "AB" in stats ? stats.AB : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "H" in stats ? stats.H : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "HR" in stats ? stats.HR : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "R" in stats ? stats.R : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "RBI" in stats ? stats.RBI : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "SB" in stats ? stats.SB : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "CS" in stats ? stats.CS : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "AVG" in stats ? formatAvg(stats.AVG) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "OBP" in stats ? formatAvg(stats.OBP) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "SLG" in stats ? formatAvg(stats.SLG) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "OPS" in stats ? formatAvg(stats.OPS) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "OPS" in stats
                          ? formatAvg(calculatePlatoonOPS(stats.OPS, player.ob_vr, player.sl_vr))
                          : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "OPS" in stats
                          ? formatAvg(calculatePlatoonOPS(stats.OPS, player.ob_vl, player.sl_vl))
                          : <RateDash />}
                      </td>
                    </>
                  )}

                  {state.activeTab === "pitchers" && (
                    <>
                      <td className="py-1.5 px-2 hidden md:table-cell">{player.hand}</td>
                      <td className="py-1.5 px-2">{player.primary_position}</td>
                      <td className="py-1.5 px-2">{player.current_team}</td>
                      <td className="py-1.5 px-2 text-muted-foreground" title={player.team_id !== null ? teamMap.get(player.team_id)?.name : undefined}>
                        {player.team_id !== null ? formatFantasyTeamAbbr(teamMap.get(player.team_id)) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "G" in stats ? stats.G : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "GS" in stats ? stats.GS : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "W" in stats && "L" in stats
                          ? `${stats.W}-${stats.L}`
                          : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "K" in stats ? stats.K : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "ER" in stats ? stats.ER : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "R" in stats ? stats.R : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "BB" in stats ? stats.BB : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "ERA" in stats ? formatRate(stats.ERA) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "WHIP" in stats ? formatRate(stats.WHIP) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "K9" in stats ? formatRate(stats.K9) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {stats && "SV" in stats ? stats.SV : <Dash />}
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
