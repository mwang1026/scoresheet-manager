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
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Actual
      </button>
      <button
        onClick={() => onChange("projected")}
        className={`px-3 py-1 rounded text-sm ${
          value === "projected"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Projected
      </button>
    </div>
  );
}
