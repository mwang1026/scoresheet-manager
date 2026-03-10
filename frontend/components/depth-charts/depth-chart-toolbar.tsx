"use client";

import type { StatsSource, DateRange } from "@/lib/stats";
import type { ViewMode } from "@/lib/depth-charts/types";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { ProjectionSourceSelect } from "@/components/ui/projection-source-select";

interface DepthChartToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  statsSource: StatsSource;
  onStatsSourceChange: (source: StatsSource) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  seasonYear: number;
  projectionSource: string;
  projectionSources: string[];
  onProjectionSourceChange: (source: string) => void;
  defToggle: boolean;
  onDefToggleChange: (on: boolean) => void;
}

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "combined", label: "OPS" },
  { value: "vsL", label: "OPS vL" },
  { value: "vsR", label: "OPS vR" },
];

export function DepthChartToolbar({
  viewMode,
  onViewModeChange,
  statsSource,
  onStatsSourceChange,
  dateRange,
  onDateRangeChange,
  seasonYear,
  projectionSource,
  projectionSources,
  onProjectionSourceChange,
  defToggle,
  onDefToggleChange,
}: DepthChartToolbarProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <StatsSourceToggle value={statsSource} onChange={onStatsSourceChange} />

      {statsSource === "projected" && (
        <ProjectionSourceSelect
          value={projectionSource}
          sources={projectionSources}
          onChange={onProjectionSourceChange}
        />
      )}
      {statsSource === "actual" && (
        <DateRangeSelect
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          seasonYear={seasonYear}
        />
      )}

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* View mode toggle */}
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium">View:</span>
        {VIEW_MODES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onViewModeChange(value)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium ${
              viewMode === value
                ? "bg-brand/15 text-brand border border-brand/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* DEF toggle */}
      <button
        onClick={() => onDefToggleChange(!defToggle)}
        className={`px-2.5 py-1 rounded text-[11px] font-medium ${
          defToggle
            ? "bg-brand/15 text-brand border border-brand/30"
            : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
        }`}
      >
        DEF
      </button>
    </div>
  );
}
