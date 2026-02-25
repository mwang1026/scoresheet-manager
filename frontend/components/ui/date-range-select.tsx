"use client";

import { useState } from "react";
import type { DateRange } from "@/lib/stats";

interface DateRangeSelectProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  seasonYear: number;
}

export function DateRangeSelect({ dateRange, onDateRangeChange, seasonYear }: DateRangeSelectProps) {
  const [customStart, setCustomStart] = useState(
    dateRange.type === "custom" ? dateRange.start : `${seasonYear}-01-01`
  );
  const [customEnd, setCustomEnd] = useState(
    dateRange.type === "custom" ? dateRange.end : `${seasonYear}-12-31`
  );

  const handleSelectChange = (type: string) => {
    if (type === "season") onDateRangeChange({ type: "season", year: seasonYear });
    else if (type === "wtd") onDateRangeChange({ type: "wtd" });
    else if (type === "last7") onDateRangeChange({ type: "last7" });
    else if (type === "last14") onDateRangeChange({ type: "last14" });
    else if (type === "last30") onDateRangeChange({ type: "last30" });
    else if (type === "custom") onDateRangeChange({ type: "custom", start: customStart, end: customEnd });
  };

  const handleBlur = () => {
    onDateRangeChange({ type: "custom", start: customStart, end: customEnd });
  };

  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium">Date Range:</span>
      <select
        value={dateRange.type}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="px-3 py-1 border rounded text-sm"
      >
        <option value="season">Season to Date</option>
        <option value="wtd">Week to Date</option>
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
            onBlur={handleBlur}
            className="px-2 py-1 border rounded text-sm"
          />
          <span className="text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            onBlur={handleBlur}
            className="px-2 py-1 border rounded text-sm"
          />
        </>
      )}
    </div>
  );
}
