"use client";

import type { StatsSource } from "@/lib/stats";
import { STATS_SOURCE_OPTIONS } from "@/lib/stats/sources";

interface StatsSourceToggleProps {
  value: StatsSource;
  onChange: (source: StatsSource) => void;
}

export function StatsSourceToggle({ value, onChange }: StatsSourceToggleProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium">Stats Source:</span>
      {STATS_SOURCE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 rounded text-sm ${
            value === option.value
              ? "bg-brand/15 text-brand border border-brand/30"
              : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
