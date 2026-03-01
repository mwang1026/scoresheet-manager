"use client";

import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { FormSelect } from "@/components/ui/form-select";
import { ALL_POSITIONS } from "@/lib/constants";

export type NewsScope = "all" | "my_players" | "watchlist" | "queue";
export type NewsDateRange = "7" | "30" | "all";

interface NewsFiltersProps {
  scope: NewsScope;
  onScopeChange: (scope: NewsScope) => void;
  selectedPositions: Set<string>;
  onPositionsChange: (positions: Set<string>) => void;
  selectedTeams: Set<string>;
  onTeamsChange: (teams: Set<string>) => void;
  availableTeams: { value: string; label: string }[];
  dateRange: NewsDateRange;
  onDateRangeChange: (range: NewsDateRange) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export function NewsFilters({
  scope,
  onScopeChange,
  selectedPositions,
  onPositionsChange,
  selectedTeams,
  onTeamsChange,
  availableTeams,
  dateRange,
  onDateRangeChange,
  onReset,
  hasActiveFilters,
}: NewsFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <FormSelect
        value={scope}
        onChange={(e) => onScopeChange(e.target.value as NewsScope)}
      >
        <option value="my_players">My Players</option>
        <option value="all">All Players</option>
        <option value="watchlist">Watchlist</option>
        <option value="queue">Draft Queue</option>
      </FormSelect>

      <FilterDropdown
        label="Position"
        options={ALL_POSITIONS.map((p) => ({ value: p, label: p }))}
        selected={selectedPositions}
        onChange={onPositionsChange}
      />

      <FilterDropdown
        label="Team"
        options={availableTeams}
        selected={selectedTeams}
        onChange={onTeamsChange}
      />

      <FormSelect
        value={dateRange}
        onChange={(e) => onDateRangeChange(e.target.value as NewsDateRange)}
      >
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="all">All time</option>
      </FormSelect>

      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="text-sm text-primary hover:underline"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
