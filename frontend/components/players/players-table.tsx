"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronUp, ChevronDown, Star, ListPlus } from "lucide-react";
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
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";

type Tab = "hitters" | "pitchers";
type SortColumn = string;
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "watchlisted" | "queued" | "unowned";
type MinThreshold = "qualified" | number;

const HITTER_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "DH"] as const;
const PITCHER_POSITIONS = ["P", "SR"] as const;

function getQualifiedThreshold(dateRange: DateRange, activeTab: Tab): number {
  const SEASON_DAYS = 183; // April 1 - Sept 30
  const GAMES_PER_DAY = 162 / SEASON_DAYS;
  const PA_PER_GAME = 3.1;
  const IP_PER_GAME = 1.0;

  let days = 0;
  const now = new Date();

  switch (dateRange.type) {
    case "season": {
      const year = dateRange.year;
      const seasonStart = new Date(year, 3, 1); // April 1
      const daysSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
      days = Math.min(daysSinceStart, SEASON_DAYS);
      break;
    }
    case "last7":
      days = 7;
      break;
    case "last14":
      days = 14;
      break;
    case "last30":
      days = 30;
      break;
    case "wtd": {
      const dayOfWeek = now.getDay();
      days = dayOfWeek === 0 ? 7 : dayOfWeek; // Monday=1, Sunday=7
      break;
    }
    case "custom": {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      break;
    }
  }

  const estimatedGames = days * GAMES_PER_DAY;
  const rate = activeTab === "hitters" ? PA_PER_GAME : IP_PER_GAME;
  return Math.ceil(rate * estimatedGames);
}

export function PlayersTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Initialize state with defaults
  const [activeTab, setActiveTab] = useState<Tab>("hitters");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [selectedHands, setSelectedHands] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaults.hitterSort.column);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaults.hitterSort.direction);
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [customStart, setCustomStart] = useState("2025-01-01");
  const [customEnd, setCustomEnd] = useState("2025-12-31");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const [minPA, setMinPA] = useState<MinThreshold>("qualified");
  const [minIP, setMinIP] = useState<MinThreshold>("qualified");
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Initialize state from URL params on mount
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "pitchers") setActiveTab("pitchers");

    const q = searchParams.get("q");
    if (q) setSearchQuery(q);

    const pos = searchParams.get("pos");
    if (pos) setSelectedPositions(new Set(pos.split(",")));

    const hand = searchParams.get("hand");
    if (hand) setSelectedHands(new Set(hand.split(",")));

    const status = searchParams.get("status");
    if (status === "watchlisted" || status === "queued" || status === "unowned") {
      setStatusFilter(status);
    }

    const source = searchParams.get("source");
    if (source === "projected") {
      setStatsSource("projected");
    }

    const projSource = searchParams.get("projSource");
    if (projSource && availableSources.includes(projSource)) {
      setProjectionSource(projSource);
    }

    const sort = searchParams.get("sort");
    if (sort) setSortColumn(sort);

    const dir = searchParams.get("dir");
    if (dir === "desc" || dir === "asc") setSortDirection(dir);

    const minPAParam = searchParams.get("minPA");
    if (minPAParam === "qualified") {
      setMinPA("qualified");
    } else if (minPAParam) {
      const parsed = Number(minPAParam);
      if (!isNaN(parsed)) setMinPA(parsed);
    }

    const minIPParam = searchParams.get("minIP");
    if (minIPParam === "qualified") {
      setMinIP("qualified");
    } else if (minIPParam) {
      const parsed = Number(minIPParam);
      if (!isNaN(parsed)) setMinIP(parsed);
    }

    const range = searchParams.get("range");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (range === "wtd") setDateRange({ type: "wtd" });
    else if (range === "last7") setDateRange({ type: "last7" });
    else if (range === "last14") setDateRange({ type: "last14" });
    else if (range === "last30") setDateRange({ type: "last30" });
    else if (range === "custom" && start && end) {
      setDateRange({ type: "custom", start, end });
      setCustomStart(start);
      setCustomEnd(end);
    }

    const size = searchParams.get("size");
    if (size) setPageSize(Number(size));

    const page = searchParams.get("page");
    if (page) setCurrentPage(Number(page));

    setIsInitialized(true);
  }, [searchParams, availableSources]);

  // Sync state to URL params (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams();

    // Tab-aware default sort
    const defaultSort = activeTab === "hitters" ? defaults.hitterSort.column : defaults.pitcherSort.column;
    const defaultDir = activeTab === "hitters" ? defaults.hitterSort.direction : defaults.pitcherSort.direction;

    if (activeTab !== "hitters") params.set("tab", activeTab);
    if (searchQuery) params.set("q", searchQuery);
    if (selectedPositions.size > 0) params.set("pos", Array.from(selectedPositions).join(","));
    if (selectedHands.size > 0) params.set("hand", Array.from(selectedHands).join(","));
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (statsSource !== "actual") params.set("source", statsSource);
    if (statsSource === "projected" && projectionSource !== availableSources[0]) {
      params.set("projSource", projectionSource);
    }
    if (sortColumn !== defaultSort) params.set("sort", sortColumn);
    if (sortDirection !== defaultDir) params.set("dir", sortDirection);

    if (dateRange.type !== "season") {
      params.set("range", dateRange.type);
      if (dateRange.type === "custom") {
        params.set("start", dateRange.start);
        params.set("end", dateRange.end);
      }
    }

    if (minPA !== "qualified") params.set("minPA", String(minPA));
    if (minIP !== "qualified") params.set("minIP", String(minIP));

    if (pageSize !== 50) params.set("size", String(pageSize));
    if (currentPage !== 0) params.set("page", String(currentPage));

    const paramsString = params.toString();
    const newUrl = paramsString ? `/players?${paramsString}` : "/players";
    router.replace(newUrl, { scroll: false });
  }, [isInitialized, activeTab, searchQuery, selectedPositions, selectedHands, statusFilter, statsSource, projectionSource, sortColumn, sortDirection, dateRange, pageSize, currentPage, minPA, minIP, router, availableSources]);

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

  // Filter and aggregate stats by date range or use projections
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

  // Split players by type
  const hitters = useMemo(
    () => (players || []).filter((p) => !isPlayerPitcher(p)),
    [players]
  );
  const pitchers = useMemo(
    () => (players || []).filter((p) => isPlayerPitcher(p)),
    [players]
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

    // Hand filter
    if (selectedHands.size > 0) {
      filtered = filtered.filter((p) => selectedHands.has(p.hand));
    }

    // Status filter
    if (statusFilter === "watchlisted") {
      filtered = filtered.filter((p) => isWatchlisted(p.id));
    } else if (statusFilter === "queued") {
      filtered = filtered.filter((p) => isInQueue(p.id));
    } else if (statusFilter === "unowned") {
      filtered = filtered.filter((p) => p.team_id === null);
    }

    // Min PA/IP filter (only for actual stats)
    if (statsSource === "actual") {
      if (activeTab === "hitters") {
        const threshold = minPA === "qualified"
          ? getQualifiedThreshold(dateRange, activeTab)
          : minPA;
        if (threshold > 0) {
          filtered = filtered.filter(p => (hitterStatsMap.get(p.id)?.PA ?? 0) >= threshold);
        }
      } else {
        const threshold = minIP === "qualified"
          ? getQualifiedThreshold(dateRange, activeTab)
          : minIP;
        if (threshold > 0) {
          filtered = filtered.filter(p => (pitcherStatsMap.get(p.id)?.IP_outs ?? 0) >= threshold * 3);
        }
      }
    }

    return filtered;
  }, [activePlayers, searchQuery, selectedPositions, selectedHands, statusFilter, isWatchlisted, isInQueue, statsSource, dateRange, activeTab, minPA, minIP, hitterStatsMap, pitcherStatsMap]);

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
          case "vR":
            aValue = calculatePlatoonOPS(aStats?.OPS ?? null, a.ob_vr, a.sl_vr);
            bValue = calculatePlatoonOPS(bStats?.OPS ?? null, b.ob_vr, b.sl_vr);
            break;
          case "vL":
            aValue = calculatePlatoonOPS(aStats?.OPS ?? null, a.ob_vl, a.sl_vl);
            bValue = calculatePlatoonOPS(bStats?.OPS ?? null, b.ob_vl, b.sl_vl);
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
      <div className="space-y-4">
        {/* Row 1: Tabs, Position filters, Status filters */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Tab toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("hitters");
                setSelectedPositions(new Set());
                setSelectedHands(new Set());
                setSortColumn(defaults.hitterSort.column);
                setSortDirection(defaults.hitterSort.direction);
                setCurrentPage(0);
              }}
              className={`px-4 py-2 rounded font-medium text-sm ${
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
                setSelectedHands(new Set());
                setSortColumn(defaults.pitcherSort.column);
                setSortDirection(defaults.pitcherSort.direction);
                setCurrentPage(0);
              }}
              className={`px-4 py-2 rounded font-medium text-sm ${
                activeTab === "pitchers"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Pitchers
            </button>
          </div>

          {/* Position filter dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">Position:</span>
            <FilterDropdown
              label="Position"
              options={(activeTab === "hitters" ? HITTER_POSITIONS : PITCHER_POSITIONS).map((p) => ({ value: p, label: p }))}
              selected={selectedPositions}
              onChange={(next) => {
                setSelectedPositions(next);
                setCurrentPage(0);
              }}
            />
          </div>

          {/* Hand filter dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">Hand:</span>
            <FilterDropdown
              label="Hand"
              options={[
                { value: "L", label: "L" },
                { value: "R", label: "R" },
                { value: "S", label: "S" },
              ]}
              selected={selectedHands}
              onChange={(next) => {
                setSelectedHands(next);
                setCurrentPage(0);
              }}
            />
          </div>

          {/* Spacer to push status filters to the right */}
          <div className="flex-1" />

          {/* Status filter buttons */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setStatusFilter("all");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setStatusFilter("watchlisted");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === "watchlisted"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Watchlisted
            </button>
            <button
              onClick={() => {
                setStatusFilter("queued");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === "queued"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              In Queue
            </button>
            <button
              onClick={() => {
                setStatusFilter("unowned");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === "unowned"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Unowned
            </button>
          </div>
        </div>

        {/* Row 2: Stats source + Date Range / Projection Source + Min PA/IP + Search */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Stats Source toggle */}
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium">Stats Source:</span>
            <button
              onClick={() => {
                setStatsSource("actual");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded text-sm ${
                statsSource === "actual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Actual
            </button>
            <button
              onClick={() => {
                setStatsSource("projected");
                setCurrentPage(0);
              }}
              className={`px-3 py-1 rounded text-sm ${
                statsSource === "projected"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Projected
            </button>
          </div>

          {/* Date range - shown when actual */}
          {statsSource === "actual" && (
            <>
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
              </div>

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

              {/* Min PA/IP dropdown */}
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium">
                  {activeTab === "hitters" ? "Min PA:" : "Min IP:"}
                </span>
                <select
                  value={activeTab === "hitters" ? minPA : minIP}
                  onChange={(e) => {
                    const val = e.target.value === "qualified" ? "qualified" : Number(e.target.value);
                    if (activeTab === "hitters") {
                      setMinPA(val);
                    } else {
                      setMinIP(val);
                    }
                    setCurrentPage(0);
                  }}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="qualified">
                    Qualified ({getQualifiedThreshold(dateRange, activeTab)})
                  </option>
                  {Array.from({ length: 101 }, (_, i) => i * 10).map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Projection source - shown when projected */}
          {statsSource === "projected" && (
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium">Source:</span>
              <select
                value={projectionSource}
                onChange={(e) => {
                  setProjectionSource(e.target.value);
                  setCurrentPage(0);
                }}
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

          {/* Spacer to push search to the right */}
          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(0);
            }}
            className="px-3 py-2 border rounded w-64 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted border-b-2 border-border">
            {activeTab === "hitters" ? (
              <tr>
                <th className="p-2 text-left w-10 font-semibold text-foreground">☆</th>
                <th className="p-2 text-left w-10 font-semibold text-foreground">Q</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIndicator column="name" />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Hand</th>
                <th className="p-2 text-left font-semibold text-foreground">Pos</th>
                <th className="p-2 text-left font-semibold text-foreground">Elig</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("team")}
                >
                  Team <SortIndicator column="team" />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Fantasy Team</th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("PA")}
                >
                  PA <SortIndicator column="PA" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("AB")}
                >
                  AB <SortIndicator column="AB" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("H")}
                >
                  H <SortIndicator column="H" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("HR")}
                >
                  HR <SortIndicator column="HR" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("R")}
                >
                  R <SortIndicator column="R" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("RBI")}
                >
                  RBI <SortIndicator column="RBI" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("SB")}
                >
                  SB <SortIndicator column="SB" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("CS")}
                >
                  CS <SortIndicator column="CS" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("AVG")}
                >
                  AVG <SortIndicator column="AVG" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("OBP")}
                >
                  OBP <SortIndicator column="OBP" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("SLG")}
                >
                  SLG <SortIndicator column="SLG" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("OPS")}
                >
                  OPS <SortIndicator column="OPS" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("vR")}
                >
                  vR <SortIndicator column="vR" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("vL")}
                >
                  vL <SortIndicator column="vL" />
                </th>
              </tr>
            ) : (
              <tr>
                <th className="p-2 text-left w-10 font-semibold text-foreground">☆</th>
                <th className="p-2 text-left w-10 font-semibold text-foreground">Q</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIndicator column="name" />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Hand</th>
                <th className="p-2 text-left font-semibold text-foreground">Pos</th>
                <th
                  className="p-2 text-left cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("team")}
                >
                  Team <SortIndicator column="team" />
                </th>
                <th className="p-2 text-left font-semibold text-foreground">Fantasy Team</th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("G")}
                >
                  G <SortIndicator column="G" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("GS")}
                >
                  GS <SortIndicator column="GS" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("IP_outs")}
                >
                  IP <SortIndicator column="IP_outs" />
                </th>
                <th className="p-2 text-right tabular-nums font-semibold text-foreground">W-L</th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("K")}
                >
                  K <SortIndicator column="K" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("ER")}
                >
                  ER <SortIndicator column="ER" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("R")}
                >
                  R <SortIndicator column="R" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("BB")}
                >
                  BB <SortIndicator column="BB" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("ERA")}
                >
                  ERA <SortIndicator column="ERA" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("WHIP")}
                >
                  WHIP <SortIndicator column="WHIP" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
                  onClick={() => handleSort("K9")}
                >
                  K/9 <SortIndicator column="K9" />
                </th>
                <th
                  className="p-2 text-right tabular-nums cursor-pointer select-none hover:bg-muted/50 font-semibold text-foreground"
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

                  {activeTab === "hitters" && (
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

                  {activeTab === "pitchers" && (
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
      <div className="flex items-center justify-between pt-4">
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

        <div className="flex gap-1 items-center">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
          >
            Previous
          </button>
          {(() => {
            const pages: (number | "ellipsis")[] = [];
            const maxVisible = 7; // Show at most 7 page buttons + ellipses

            if (totalPages <= maxVisible) {
              // Show all pages if there aren't many
              for (let i = 0; i < totalPages; i++) {
                pages.push(i);
              }
            } else {
              // Always show first page
              pages.push(0);

              // Calculate range around current page
              let start = Math.max(1, currentPage - 1);
              let end = Math.min(totalPages - 2, currentPage + 1);

              // Adjust range if we're near the beginning or end
              if (currentPage <= 2) {
                end = Math.min(totalPages - 2, 3);
              } else if (currentPage >= totalPages - 3) {
                start = Math.max(1, totalPages - 4);
              }

              // Add left ellipsis if needed
              if (start > 1) {
                pages.push("ellipsis");
              }

              // Add middle pages
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }

              // Add right ellipsis if needed
              if (end < totalPages - 2) {
                pages.push("ellipsis");
              }

              // Always show last page
              pages.push(totalPages - 1);
            }

            return pages.map((page, idx) => {
              if (page === "ellipsis") {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2 py-1 rounded text-sm min-w-[32px] ${
                    currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {page + 1}
                </button>
              );
            });
          })()}
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
