"use client";

/**
 * Custom hook that manages all state for the players table, including:
 * - UI state (tab, filters, sort, pagination, threshold)
 * - URL sync (reads params on mount, writes params on change)
 * - State-transition handlers
 *
 * Extracted from players-table.tsx to keep the component focused on rendering.
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ResolvedPageDefaults } from "./use-page-defaults";
import type { DateRange, StatsSource } from "@/lib/stats";

type Tab = "hitters" | "pitchers";
type SortColumn = string;
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "watchlisted" | "queued" | "unowned";
type MinThreshold = "qualified" | number;

export interface PlayersTableState {
  // Tab
  activeTab: Tab;
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // Filters
  selectedPositions: Set<string>;
  selectedHands: Set<string>;
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  // Stats source
  statsSource: StatsSource;
  setStatsSource: (s: StatsSource) => void;
  // Projection source
  projectionSource: string;
  setProjectionSource: (s: string) => void;
  // Sort
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  // Date range
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  // Pagination
  pageSize: number;
  setPageSize: (n: number) => void;
  currentPage: number;
  setCurrentPage: (n: number) => void;
  // Threshold
  minPA: MinThreshold;
  setMinPA: (t: MinThreshold) => void;
  minIP: MinThreshold;
  setMinIP: (t: MinThreshold) => void;
  // Handlers
  handleSort: (column: SortColumn) => void;
  handleTabChange: (tab: Tab, sortColumn: string, sortDirection: SortDirection) => void;
  handlePositionsChange: (positions: Set<string>) => void;
  handleHandsChange: (hands: Set<string>) => void;
}

export function usePlayersTableState(
  defaults: ResolvedPageDefaults,
  availableSources: string[],
  onSettingsChange?: (updates: { statsSource?: StatsSource; projectionSource?: string }) => void
): PlayersTableState {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>("hitters");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [selectedHands, setSelectedHands] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);
  const [sortColumn, setSortColumn] = useState<SortColumn>(defaults.hitterSort.column);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaults.hitterSort.direction);
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const [minPA, setMinPA] = useState<MinThreshold>("qualified");
  const [minIP, setMinIP] = useState<MinThreshold>("qualified");
  const [isInitialized, setIsInitialized] = useState(false);

  // Projection source state
  const [projectionSource, setProjectionSource] = useState(availableSources[0] ?? "");

  // Sync projectionSource when availableSources loads
  useEffect(() => {
    if (projectionSource === "" && availableSources.length > 0) {
      setProjectionSource(availableSources[0]);
    }
  }, [availableSources, projectionSource]);

  // --- URL → state init (on mount) ---
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "pitchers") {
      setActiveTab("pitchers");
      setSortColumn(defaults.pitcherSort.column);
      setSortDirection(defaults.pitcherSort.direction);
    }

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
    }

    const size = searchParams.get("size");
    if (size) setPageSize(Number(size));

    const page = searchParams.get("page");
    if (page) setCurrentPage(Number(page));

    setIsInitialized(true);
  }, [searchParams, availableSources]);

  // --- Wrapped setters that persist to settings ---
  const handleStatsSourceChange = (s: StatsSource) => {
    setStatsSource(s);
    if (isInitialized) onSettingsChange?.({ statsSource: s });
  };

  const handleProjectionSourceChange = (s: string) => {
    setProjectionSource(s);
    if (isInitialized) onSettingsChange?.({ projectionSource: s });
  };

  // --- State → URL sync (after initialization) ---
  useEffect(() => {
    if (!isInitialized) return;

    const params = new URLSearchParams();

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
  }, [isInitialized, activeTab, searchQuery, selectedPositions, selectedHands, statusFilter, statsSource, projectionSource, sortColumn, sortDirection, dateRange, pageSize, currentPage, minPA, minIP, router, availableSources, defaults.hitterSort, defaults.pitcherSort]);

  // --- Handlers ---

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleTabChange = (tab: Tab, col: string, dir: SortDirection) => {
    setActiveTab(tab);
    setSortColumn(col);
    setSortDirection(dir);
  };

  const handlePositionsChange = (positions: Set<string>) => {
    setSelectedPositions(positions);
  };

  const handleHandsChange = (hands: Set<string>) => {
    setSelectedHands(hands);
  };

  return {
    activeTab,
    searchQuery, setSearchQuery,
    selectedPositions,
    selectedHands,
    statusFilter, setStatusFilter,
    statsSource, setStatsSource: handleStatsSourceChange,
    projectionSource, setProjectionSource: handleProjectionSourceChange,
    sortColumn,
    sortDirection,
    dateRange, setDateRange,
    pageSize, setPageSize,
    currentPage, setCurrentPage,
    minPA, setMinPA,
    minIP, setMinIP,
    handleSort,
    handleTabChange,
    handlePositionsChange,
    handleHandsChange,
  };
}
