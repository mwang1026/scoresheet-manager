"use client";

import { useCallback, type MouseEvent } from "react";
import Link from "next/link";
import type { DepthChartPlayer, DepthChartPosition, ViewMode } from "@/lib/depth-charts/types";
import { NO_DEF_POSITIONS } from "@/lib/depth-charts/types";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";

interface PlayerEntryProps {
  player: DepthChartPlayer;
  position: DepthChartPosition;
  viewMode: ViewMode;
  onMouseEnter: (e: MouseEvent, player: DepthChartPlayer, position: DepthChartPosition) => void;
  onMouseLeave: () => void;
  onMouseMove: (e: MouseEvent) => void;
  newsPlayerIds?: Set<number>;
}

const BORDER_CLASSES: Record<string, string> = {
  LR: "border-l-[hsl(38,59%,56%)]",
  L: "border-l-blue-500",
  R: "border-l-red-600",
  bench: "border-l-transparent",
};

function formatOPS(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

function formatERA(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(2);
}

function formatDefDiff(diff: number | null): string {
  if (diff === null) return "";
  const sign = diff >= 0 ? "+" : "";
  return sign + diff.toFixed(2);
}

export function PlayerEntry({
  player,
  position,
  viewMode,
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  newsPlayerIds,
}: PlayerEntryProps) {
  const handleMouseEnter = useCallback(
    (e: MouseEvent) => onMouseEnter(e, player, position),
    [onMouseEnter, player, position]
  );

  // View mode filtering for hitters
  if (player.type === "hitter") {
    if (viewMode === "def") {
      // DEF view: show only the player assigned to this position in the max-DEF lineup
      if (player.maxDEFPosition !== position) return null;
    } else if (viewMode === "vsL" && (player.role === "bench" || player.role === "R")) {
      return null;
    } else if (viewMode === "vsR" && (player.role === "bench" || player.role === "L")) {
      return null;
    }
  }

  const borderClass = BORDER_CLASSES[player.role] ?? "border-l-transparent";
  const isBench = player.role === "bench";
  const isMultiPos = !player.isPrimary;
  const showDef = !NO_DEF_POSITIONS.has(position);

  // Stat display
  let statDisplay: string;
  if (player.type === "pitcher") {
    statDisplay = formatERA(player.stat);
  } else if (viewMode === "vsL") {
    statDisplay = formatOPS(player.statVsL);
  } else if (viewMode === "vsR") {
    statDisplay = formatOPS(player.statVsR);
  } else {
    // combined and def both show combined OPS
    statDisplay = formatOPS(player.stat);
  }

  // Defense diff
  const defDisplay = showDef ? formatDefDiff(player.defDiff) : "";
  const defColorClass =
    player.defDiff !== null && showDef
      ? player.defDiff >= 0
        ? "text-[hsl(160,18%,48%)]"
        : "text-[hsl(15,22%,48%)]"
      : "text-muted-foreground";

  return (
    <div
      className={`dc-player-entry border-l-2 ${borderClass} rounded-[3px] px-1.5 py-0.5 my-px cursor-default text-xs ${
        isBench ? "text-muted-foreground" : ""
      } ${isMultiPos ? "opacity-45" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis min-w-0 inline-flex items-center gap-0">
        <Link href={`/players/${player.id}`} className="text-primary hover:underline">
          {player.name}
        </Link>
        <NewsIcon playerId={player.id} hasNews={newsPlayerIds?.has(player.id) ?? false} />
        <ILIcon ilType={player.ilType} ilDate={player.ilDate} />
      </span>
      <span className="font-mono text-xs tabular-nums whitespace-nowrap text-right min-w-[36px]">
        {statDisplay}
      </span>
      <span
        className={`font-mono text-[11px] tabular-nums whitespace-nowrap text-right min-w-[42px] ${defColorClass}${
          player.isOOP ? " underline decoration-dashed decoration-muted-foreground/50 underline-offset-2" : ""
        }`}
      >
        {defDisplay}
      </span>
    </div>
  );
}
