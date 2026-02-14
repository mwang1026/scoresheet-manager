"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DateRange } from "@/lib/stats";

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

type PresetType = "wtd" | "last7" | "last14" | "last30" | "season" | "custom";

interface PresetConfig {
  label: string;
  type: PresetType;
  periodDays?: number; // How many days to shift for back/forward (undefined = disabled)
}

const PRESETS: PresetConfig[] = [
  { label: "WTD", type: "wtd", periodDays: 7 },
  { label: "L7", type: "last7", periodDays: 7 },
  { label: "L14", type: "last14", periodDays: 14 },
  { label: "L30", type: "last30", periodDays: 30 },
  { label: "Season", type: "season" }, // No back/forward for season
  { label: "Custom", type: "custom" }, // Back/forward use window width
];

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
}: DateRangePickerProps) {
  const [offset, setOffset] = useState(0); // Days offset from "today"
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const activePreset = getActivePreset(dateRange);

  const handlePresetClick = (preset: PresetConfig) => {
    setOffset(0); // Reset offset when changing presets

    if (preset.type === "custom") {
      // Switch to custom mode with empty dates
      setCustomStart("");
      setCustomEnd("");
      onDateRangeChange({ type: "custom", start: "", end: "" });
    } else if (preset.type === "season") {
      onDateRangeChange({ type: "season" });
    } else {
      onDateRangeChange({ type: preset.type });
    }
  };

  const handleBackward = () => {
    const preset = PRESETS.find((p) => p.type === activePreset);
    if (!preset?.periodDays) return;

    const newOffset = offset - preset.periodDays;
    setOffset(newOffset);

    // Emit shifted custom range
    const shifted = computeShiftedRange(activePreset, newOffset);
    if (shifted) {
      onDateRangeChange(shifted);
    }
  };

  const handleForward = () => {
    const preset = PRESETS.find((p) => p.type === activePreset);
    if (!preset?.periodDays) return;

    const newOffset = offset + preset.periodDays;
    setOffset(newOffset);

    // Emit shifted custom range (or reset to preset if offset = 0)
    if (newOffset === 0) {
      // Reset to original preset
      onDateRangeChange({ type: activePreset } as DateRange);
    } else {
      const shifted = computeShiftedRange(activePreset, newOffset);
      if (shifted) {
        onDateRangeChange(shifted);
      }
    }
  };

  const handleCustomStartChange = (value: string) => {
    setCustomStart(value);
    if (value && customEnd) {
      onDateRangeChange({ type: "custom", start: value, end: customEnd });
    }
  };

  const handleCustomEndChange = (value: string) => {
    setCustomEnd(value);
    if (customStart && value) {
      onDateRangeChange({ type: "custom", start: customStart, end: value });
    }
  };

  const dateLabel = getDateLabel(dateRange, offset);

  const canGoBack =
    PRESETS.find((p) => p.type === activePreset)?.periodDays !== undefined;
  const canGoForward = canGoBack && offset < 0;

  return (
    <div className="sticky top-0 z-10 bg-background border-b py-3">
      <div className="flex items-center gap-2 mb-2">
        {/* Back arrow */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBackward}
          disabled={!canGoBack}
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Preset buttons */}
        <div className="flex gap-2 flex-1">
          {PRESETS.map((preset) => {
            const isActive = preset.type === activePreset;
            return (
              <Button
                key={preset.type}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className={
                  isActive
                    ? "bg-brand-blue text-white hover:bg-brand-blue/90"
                    : ""
                }
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        {/* Forward arrow */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleForward}
          disabled={!canGoForward}
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Date label */}
      <div className="text-sm text-muted-foreground text-center">
        {dateLabel}
      </div>

      {/* Custom date inputs */}
      {activePreset === "custom" && (
        <div className="flex gap-2 items-center justify-center mt-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => handleCustomStartChange(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            aria-label="Start date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => handleCustomEndChange(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            aria-label="End date"
          />
        </div>
      )}
    </div>
  );
}

// Helper functions

function getActivePreset(dateRange: DateRange): PresetType {
  if (dateRange.type === "custom") return "custom";
  if (dateRange.type === "season") return "season";
  return dateRange.type as PresetType;
}

function computeShiftedRange(
  preset: PresetType,
  offset: number
): DateRange | null {
  const today = new Date();
  today.setDate(today.getDate() + offset);

  switch (preset) {
    case "wtd": {
      // Compute Monday of the shifted week
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - daysToMonday);

      // End is the shifted "today" (or Sunday if shifted today is past end of week)
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const end = today < sunday ? today : sunday;

      return {
        type: "custom",
        start: formatDate(monday),
        end: formatDate(end),
      };
    }
    case "last7":
    case "last14":
    case "last30": {
      const days = preset === "last7" ? 7 : preset === "last14" ? 14 : 30;
      const start = new Date(today);
      start.setDate(start.getDate() - days);

      return {
        type: "custom",
        start: formatDate(start),
        end: formatDate(today),
      };
    }
    default:
      return null;
  }
}

function getDateLabel(dateRange: DateRange, offset: number): string {
  if (dateRange.type === "custom" && dateRange.start && dateRange.end) {
    return `${formatDateLabel(dateRange.start)} – ${formatDateLabel(dateRange.end)}`;
  }

  if (dateRange.type === "season") {
    const year = dateRange.year ?? new Date().getFullYear();
    return `${year} Season`;
  }

  // For presets, compute the effective range
  const today = new Date();
  today.setDate(today.getDate() + offset);

  switch (dateRange.type) {
    case "wtd": {
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - daysToMonday);
      return `${formatDateLabel(formatDate(monday))} – ${formatDateLabel(formatDate(today))}`;
    }
    case "last7":
    case "last14":
    case "last30": {
      const days = dateRange.type === "last7" ? 7 : dateRange.type === "last14" ? 14 : 30;
      const start = new Date(today);
      start.setDate(start.getDate() - days);
      return `${formatDateLabel(formatDate(start))} – ${formatDateLabel(formatDate(today))}`;
    }
    default:
      return "";
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00"); // Avoid TZ shift
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
