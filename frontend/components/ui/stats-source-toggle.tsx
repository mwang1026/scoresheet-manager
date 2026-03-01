"use client";

import type { StatsSource } from "@/lib/stats";

interface StatsSourceToggleProps {
  value: StatsSource;
  onChange: (source: StatsSource) => void;
}

export function StatsSourceToggle({ value, onChange }: StatsSourceToggleProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium">Stats Source:</span>
      <button
        onClick={() => onChange("actual")}
        className={`px-3 py-1 rounded text-sm ${
          value === "actual"
            ? "bg-brand/15 text-brand border border-brand/30"
            : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
        }`}
      >
        Actual
      </button>
      <button
        onClick={() => onChange("projected")}
        className={`px-3 py-1 rounded text-sm ${
          value === "projected"
            ? "bg-brand/15 text-brand border border-brand/30"
            : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
        }`}
      >
        Projected
      </button>
    </div>
  );
}
