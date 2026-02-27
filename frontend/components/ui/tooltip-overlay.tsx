"use client";

import { useLayoutEffect, useRef } from "react";

interface TooltipOverlayProps {
  iconRef: React.RefObject<HTMLSpanElement | null>;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

export function TooltipOverlay({ iconRef, onClick, children }: TooltipOverlayProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Position via direct DOM manipulation to avoid re-render loops.
  // useLayoutEffect fires before paint, preventing a flash at (0,0).
  // No deps array: recalculates whenever children change (only runs while visible).
  useLayoutEffect(() => {
    const icon = iconRef.current;
    const tooltip = tooltipRef.current;
    if (!icon || !tooltip) return;

    const rect = icon.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight;
    const GAP = 6;

    // Default: above the icon. If clipped at top, flip below.
    const above = rect.top - tooltipHeight - GAP;
    const top = above < 8 ? rect.bottom + GAP : above;
    const left = rect.left + rect.width / 2;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.visibility = "visible";
  });

  return (
    <div
      ref={tooltipRef}
      className="fixed -translate-x-1/2 px-2 py-1 bg-popover border rounded text-xs max-w-xs whitespace-pre-wrap break-words shadow-md cursor-pointer z-50"
      style={{ visibility: "hidden", top: 0, left: 0 }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
