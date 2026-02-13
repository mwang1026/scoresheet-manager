"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Star, ListPlus } from "lucide-react";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  filterStatsByDateRange,
  formatIP,
  formatAvg,
  formatRate,
  isPlayerPitcher,
  isEligibleAt,
  getDefenseDisplay,
  type DateRange,
} from "@/lib/stats";

type Tab = "hitters" | "pitchers";
type SortColumn = string;
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "watchlisted" | "queued" | "unowned";

const HITTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "DH"] as const;
const PITCHER_POSITIONS = ["P", "SR"] as const;

export function PlayersTable() {
  const router = useRouter();
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } =
    usePlayerLists();

  // Create team lookup map
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t.name])), []);

  const [activeTab, setActiveTab] = useState<Tab>("hitters");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dateRange, setDateRange] = useState<DateRange>({ type: "season", year: 2025 });
  const [customStart, setCustomStart] = useState("2025-01-01");
  const [customEnd, setCustomEnd] = useState("2025-12-31");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);

  // Filter and aggregate stats by date range
  const { hitterStatsMap, pitcherStatsMap } = useMemo(() => {
    const filteredHitterStats = filterStatsByDateRange(hitterStats, dateRange);
    const filteredPitcherStats = filterStatsByDateRange(pitcherStats, dateRange);

    return {
      hitterStatsMap: aggregateHitterStatsByPlayer(filteredHitterStats),
      pitcherStatsMap: aggregatePitcherStatsByPlayer(filteredPitcherStats),
    };
  }, [dateRange]);

  // Split players by type
  const hitters = useMemo(
    () => players.filter((p) => !isPlayerPitcher(p)),
    []
  );
  const pitchers = useMemo(
    () => players.filter((p) => isPlayerPitcher(p)),
    []
  );

  // Get active player list
  const activePlayers = activeTab === "hitters" ? hitters : pitchers;

  // Apply filters
  const filteredPlayers = useMemo(() => {
    let filtered = activePlayers;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(query));
    }

    // Position filter - check eligibility at any selected position
    if (selectedPositions.size > 0) {
      filtered = filtered.filter((p) =>
        Array.from(selectedPositions).some((pos) => isEligibleAt(p, pos))
      );
    }

    // Status filter
    if (statusFilter === "watchlisted") {
      filtered = filtered.filter((p) => isWatchlisted(p.id));
    } else if (statusFilter === "queued") {
      filtered = filtered.filter((p) => isInQueue(p.id));
    } else if (statusFilter === "unowned") {
      filtered = filtered.filter((p) => p.team_id === null);
    }

    return filtered;
  }, [activePlayers, searchQuery, selectedPositions, statusFilter, isWatchlisted, isInQueue]);

  // Sort players
  const sortedPlayers = useMemo(() => {
    const sorted = [...filteredPlayers];

    sorted.sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;

      // Get values based on column and player type
      if (activeTab === "hitters") {
        const aStats = hitterStatsMap.get(a.id);
        const bStats = hitterStatsMap.get(b.id);

        switch (sortColumn) {
          case "name":
            aValue = a.name;
            bValue = b.name;
            break;
          case "team":
            aValue = a.current_team;
            bValue = b.current_team;
            break;
          case "PA":
          case "AB":
          case "H":
          case "HR":
          case "R":
          case "RBI":
          case "SB":
          case "CS":
            aValue = aStats?.[sortColumn] ?? 0;
            bValue = bStats?.[sortColumn] ?? 0;
            break;
          case "AVG":
          case "OBP":
          case "SLG":
          case "OPS":
            aValue = aStats?.[sortColumn] ?? null;
            bValue = bStats?.[sortColumn] ?? null;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }
      } else {
        const aStats = pitcherStatsMap.get(a.id);
        const bStats = pitcherStatsMap.get(b.id);

        switch (sortColumn) {
          case "name":
            aValue = a.name;
            bValue = b.name;
            break;
          case "team":
            aValue = a.current_team;
            bValue = b.current_team;
            break;
          case "G":
          case "GS":
          case "IP_outs":
          case "W":
          case "L":
          case "K":
          case "ER":
          case "R":
          case "BB":
          case "SV":
            aValue = aStats?.[sortColumn] ?? 0;
            bValue = bStats?.[sortColumn] ?? 0;
            break;
          case "ERA":
          case "WHIP":
          case "K9":
            aValue = aStats?.[sortColumn] ?? null;
            bValue = bStats?.[sortColumn] ?? null;
            break;
          default:
            aValue = 0;
            bValue = 0;
        }
      }

      // Handle null values (sort to bottom)
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredPlayers, sortColumn, sortDirection, activeTab, hitterStatsMap, pitcherStatsMap]);

  // Paginate
  const totalPages = Math.ceil(sortedPlayers.length / pageSize);
  const paginatedPlayers = sortedPlayers.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  // Handle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Handle position toggle
  const togglePosition = (position: string) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(position)) {
        next.delete(position);
      } else {
        next.add(position);
      }
      return next;
    });
    setCurrentPage(0);
  };

  // Handle date range change
  const handleDateRangeChange = (type: string) => {
    if (type === "season") {
      setDateRange({ type: "season", year: 2025 });
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

  // Render sort indicator
  const SortIndicator = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline w-4 h-4" />
    ) : (
      <ChevronDown className="inline w-4 h-4" />
    );
  };

  // Handle watchlist/queue toggles
  const handleWatchlistToggle = (e: React.MouseEvent, playerId: number) => {
    e.stopPropagation();
    toggleWatchlist(playerId);
  };

  const handleQueueToggle = (e: React.MouseEvent, playerId: number) => {
    e.stopPropagation();
    toggleQueue(playerId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex-none space-y-4 pb-4">
        {/* Tab toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("hitters");
              setSelectedPositions(new Set());
              setCurrentPage(0);
            }}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === "hitters"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Hitters
          </button>
          <button
            onClick={() => {
              setActiveTab("pitchers");
              setSelectedPositions(new Set());
              setCurrentPage(0);
            }}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === "pitchers"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Pitchers
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
            className="px-3 py-2 border rounded w-64"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setCurrentPage(0);
            }}
            className="px-3 py-2 border rounded"
          >
            <option value="all">All Players</option>
            <option value="watchlisted">Watchlisted</option>
            <option value="queued">In Queue</option>
            <option value="unowned">Unowned</option>
          </select>
        </div>

        {/* Position filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium">Positions:</span>
          {(activeTab === "hitters" ? HITTER_POSITIONS : PITCHER_POSITIONS).map((pos) => (
            <button
              key={pos}
              onClick={() => togglePosition(pos)}
              className={`px-3 py-1 rounded text-sm ${
                selectedPositions.has(pos)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {pos}
            </button>
          ))}
          {selectedPositions.size > 0 && (
            <button
              onClick={() => {
                setSelectedPositions(new Set());
                setCurrentPage(0);
              }}
              className="text-sm text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Date range picker */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium">Date Range:</span>
          <select
            value={dateRange.type}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="season">Season to Date</option>
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
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            {activeTab === "hitters" ? (
              <tr>
                <th className="p-3 text-left w-10">☆</th>
                <th className="p-3 text-left w-10">Q</th>
                <th
                  className="p-3 text-left cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIndicator column="name" />
                </th>
                <th className="p-3 text-left">Pos</th>
                <th className="p-3 text-left">Elig</th>
                <th
                  className="p-3 text-left cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("team")}
                >
                  Team <SortIndicator column="team" />
                </th>
                <th className="p-3 text-left">Fantasy Team</th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("PA")}
                >
                  PA <SortIndicator column="PA" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("AB")}
                >
                  AB <SortIndicator column="AB" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("H")}
                >
                  H <SortIndicator column="H" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("HR")}
                >
                  HR <SortIndicator column="HR" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("R")}
                >
                  R <SortIndicator column="R" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("RBI")}
                >
                  RBI <SortIndicator column="RBI" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("SB")}
                >
                  SB <SortIndicator column="SB" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("CS")}
                >
                  CS <SortIndicator column="CS" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("AVG")}
                >
                  AVG <SortIndicator column="AVG" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("OBP")}
                >
                  OBP <SortIndicator column="OBP" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("SLG")}
                >
                  SLG <SortIndicator column="SLG" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("OPS")}
                >
                  OPS <SortIndicator column="OPS" />
                </th>
              </tr>
            ) : (
              <tr>
                <th className="p-3 text-left w-10">☆</th>
                <th className="p-3 text-left w-10">Q</th>
                <th
                  className="p-3 text-left cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIndicator column="name" />
                </th>
                <th className="p-3 text-left">Pos</th>
                <th
                  className="p-3 text-left cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("team")}
                >
                  Team <SortIndicator column="team" />
                </th>
                <th className="p-3 text-left">Fantasy Team</th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("G")}
                >
                  G <SortIndicator column="G" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("GS")}
                >
                  GS <SortIndicator column="GS" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("IP_outs")}
                >
                  IP <SortIndicator column="IP_outs" />
                </th>
                <th className="p-3 text-right tabular-nums">W-L</th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("K")}
                >
                  K <SortIndicator column="K" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("ER")}
                >
                  ER <SortIndicator column="ER" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("R")}
                >
                  R <SortIndicator column="R" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("BB")}
                >
                  BB <SortIndicator column="BB" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("ERA")}
                >
                  ERA <SortIndicator column="ERA" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("WHIP")}
                >
                  WHIP <SortIndicator column="WHIP" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("K9")}
                >
                  K/9 <SortIndicator column="K9" />
                </th>
                <th
                  className="p-3 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort("SV")}
                >
                  SV <SortIndicator column="SV" />
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {paginatedPlayers.map((player) => {
              const stats =
                activeTab === "hitters"
                  ? hitterStatsMap.get(player.id)
                  : pitcherStatsMap.get(player.id);

              return (
                <tr
                  key={player.id}
                  onClick={() => router.push(`/players/${player.id}`)}
                  className="hover:bg-muted even:bg-muted/50 cursor-pointer"
                >
                  <td className="p-3" onClick={(e) => handleWatchlistToggle(e, player.id)}>
                    {isHydrated && isWatchlisted(player.id) ? (
                      <Star className="w-4 h-4 fill-current text-yellow-500" />
                    ) : (
                      <Star className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="p-3" onClick={(e) => handleQueueToggle(e, player.id)}>
                    {isHydrated && isInQueue(player.id) ? (
                      <ListPlus className="w-4 h-4 text-primary" />
                    ) : (
                      <ListPlus className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="p-3 font-medium">{player.name}</td>
                  <td className="p-3">{player.primary_position}</td>

                  {activeTab === "hitters" && (
                    <>
                      <td className="p-3 text-sm text-muted-foreground">
                        {getDefenseDisplay(player)}
                      </td>
                      <td className="p-3">{player.current_team}</td>
                      <td className="p-3 text-muted-foreground">
                        {player.team_id !== null ? teamMap.get(player.team_id) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "PA" in stats ? stats.PA : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "AB" in stats ? stats.AB : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "H" in stats ? stats.H : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "HR" in stats ? stats.HR : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "R" in stats ? stats.R : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "RBI" in stats ? stats.RBI : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "SB" in stats ? stats.SB : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "CS" in stats ? stats.CS : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "AVG" in stats ? formatAvg(stats.AVG) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "OBP" in stats ? formatAvg(stats.OBP) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "SLG" in stats ? formatAvg(stats.SLG) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "OPS" in stats ? formatAvg(stats.OPS) : "---"}
                      </td>
                    </>
                  )}

                  {activeTab === "pitchers" && (
                    <>
                      <td className="p-3">{player.current_team}</td>
                      <td className="p-3 text-muted-foreground">
                        {player.team_id !== null ? teamMap.get(player.team_id) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "G" in stats ? stats.G : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "GS" in stats ? stats.GS : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "W" in stats && "L" in stats
                          ? `${stats.W}-${stats.L}`
                          : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "K" in stats ? stats.K : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "ER" in stats ? stats.ER : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "R" in stats ? stats.R : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "BB" in stats ? stats.BB : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "WHIP" in stats ? formatRate(stats.WHIP) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {stats && "K9" in stats ? formatRate(stats.K9) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
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
      <div className="flex-none flex items-center justify-between pt-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, sortedPlayers.length)} of{" "}
            {sortedPlayers.length}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(0);
            }}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
