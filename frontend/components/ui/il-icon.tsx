"use client";

import { Cross } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TooltipOverlay } from "./tooltip-overlay";

export interface ILIconProps {
  ilType: string | null;
  ilDate: string | null;
}

/**
 * Format an ISO date string (YYYY-MM-DD) for IL display.
 *
 * Parses the string directly (no `new Date()`) to avoid timezone issues
 * where "2026-02-14" could display as Feb 13 in western US timezones.
 */
export function formatILDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${monthNames[month - 1]} ${day}`;
}

export function ILIcon({ ilType, ilDate }: ILIconProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => {
      setTooltipVisible(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setTooltipVisible(false);
  };

  if (!ilType) return null;

  const tooltipText = ilDate
    ? `${ilType} \u00b7 since ${formatILDate(ilDate)}`
    : ilType;

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex items-center ml-1 p-1.5 -m-1.5"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.stopPropagation();
          setTooltipVisible((v) => !v);
        }}
      >
        <Cross className="w-3 h-3 text-destructive" />
      </span>

      {tooltipVisible && typeof document !== "undefined" &&
        createPortal(
          <TooltipOverlay iconRef={iconRef}>
            {tooltipText}
          </TooltipOverlay>,
          document.body
        )}
    </>
  );
}
