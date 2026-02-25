"use client";

/**
 * PlayersToolbar — all filter/control UI for the players table.
 *
 * Extracted from players-table.tsx. Receives all state and handlers as explicit props.
 */

import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { ProjectionSourceSelect } from "@/components/ui/projection-source-select";
import { HITTER_POSITIONS, PITCHER_POSITIONS } from "@/lib/constants";
import type { DateRange, StatsSource } from "@/lib/stats";
import { getQualifiedThreshold } from "@/lib/stats";

type Tab = "hitters" | "pitchers";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "watchlisted" | "queued" | "unowned";
type MinThreshold = "qualified" | number;

export interface PlayersToolbarProps {
  // Tab
  activeTab: Tab;
  defaultHitterSortColumn: string;
  defaultHitterSortDirection: SortDirection;
  defaultPitcherSortColumn: string;
  defaultPitcherSortDirection: SortDirection;
  onTabChange: (tab: Tab, sortColumn: string, sortDirection: SortDirection) => void;
  // Filters
  selectedPositions: Set<string>;
  onPositionsChange: (positions: Set<string>) => void;
  selectedHands: Set<string>;
  onHandsChange: (hands: Set<string>) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (f: StatusFilter) => void;
  // Stats source
  statsSource: StatsSource;
  onStatsSourceChange: (s: StatsSource) => void;
  // Date range
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  seasonYear: number;
  // Threshold
  minPA: MinThreshold;
  onMinPAChange: (t: MinThreshold) => void;
  minIP: MinThreshold;
  onMinIPChange: (t: MinThreshold) => void;
  // Projections
  projectionSource: string;
  availableSources: string[];
  onProjectionSourceChange: (s: string) => void;
  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;
  // Shared reset
  onResetPage: () => void;
}

export function PlayersToolbar({
  activeTab,
  defaultHitterSortColumn,
  defaultHitterSortDirection,
  defaultPitcherSortColumn,
  defaultPitcherSortDirection,
  onTabChange,
  selectedPositions,
  onPositionsChange,
  selectedHands,
  onHandsChange,
  statusFilter,
  onStatusFilterChange,
  statsSource,
  onStatsSourceChange,
  dateRange,
  onDateRangeChange,
  seasonYear,
  minPA,
  onMinPAChange,
  minIP,
  onMinIPChange,
  projectionSource,
  availableSources,
  onProjectionSourceChange,
  searchQuery,
  onSearchChange,
  onResetPage,
}: PlayersToolbarProps) {
  return (
    <div className="space-y-4">
      {/* Row 1: Tabs, Position filters, Status filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Tab toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              onTabChange("hitters", defaultHitterSortColumn, defaultHitterSortDirection);
              onPositionsChange(new Set());
              onHandsChange(new Set());
              onResetPage();
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
              onTabChange("pitchers", defaultPitcherSortColumn, defaultPitcherSortDirection);
              onPositionsChange(new Set());
              onHandsChange(new Set());
              onResetPage();
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
              onPositionsChange(next);
              onResetPage();
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
              onHandsChange(next);
              onResetPage();
            }}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status filter buttons */}
        <div className="flex gap-2 items-center">
          {(["all", "watchlisted", "queued", "unowned"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                onStatusFilterChange(f);
                onResetPage();
              }}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? "All" : f === "watchlisted" ? "Watchlisted" : f === "queued" ? "In Queue" : "Unowned"}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Stats source + Date Range / Projection Source + Min PA/IP + Search */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Stats Source toggle */}
        <StatsSourceToggle
          value={statsSource}
          onChange={(s) => {
            onStatsSourceChange(s);
            onResetPage();
          }}
        />

        {/* Date range — shown when actual */}
        {statsSource === "actual" && (
          <>
            <DateRangeSelect
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              seasonYear={seasonYear}
            />

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
                    onMinPAChange(val);
                  } else {
                    onMinIPChange(val);
                  }
                  onResetPage();
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

        {/* Projection source — shown when projected */}
        {statsSource === "projected" && (
          <ProjectionSourceSelect
            value={projectionSource}
            sources={availableSources}
            onChange={(s) => {
              onProjectionSourceChange(s);
              onResetPage();
            }}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <input
          type="text"
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onResetPage();
          }}
          className="px-3 py-2 border rounded w-64 text-sm"
        />
      </div>
    </div>
  );
}
