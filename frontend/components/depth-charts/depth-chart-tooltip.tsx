"use client";

import type { DepthChartPlayer, DepthChartPosition } from "@/lib/depth-charts/types";
import { NO_DEF_POSITIONS } from "@/lib/depth-charts/types";

interface DepthChartTooltipProps {
  player: DepthChartPlayer | null;
  position: DepthChartPosition | null;
  x: number;
  y: number;
  visible: boolean;
}

function formatOPS(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

function formatERA(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(2);
}

function formatDef(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(2);
}

export function DepthChartTooltip({ player, position, x, y, visible }: DepthChartTooltipProps) {
  if (!visible || !player) return null;

  const showDef = position !== null && !NO_DEF_POSITIONS.has(position) && player.defRating !== null;

  return (
    <div
      className="fixed z-[100] rounded-[5px] border border-border px-2.5 py-2 text-[10px] text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.5)] pointer-events-none max-w-[240px] leading-relaxed"
      style={{
        left: x,
        top: y,
        backgroundColor: "hsl(20, 8%, 12%)",
      }}
    >
      <div className="font-semibold text-[11px] mb-1 text-brand">{player.name}</div>
      <div className="font-mono tabular-nums text-[10px] space-y-px">
        {player.type === "pitcher" ? (
          <>
            <TooltipRow label="Hand" value={player.hand === "L" ? "LHP" : "RHP"} />
            <TooltipRow label="IP" value={player.ip?.toFixed(1) ?? "—"} />
            <TooltipRow label="ERA" value={formatERA(player.era)} />
            <TooltipRow label="WHIP" value={formatERA(player.whip)} />
            <TooltipRow label="K" value={String(player.k ?? "—")} />
          </>
        ) : (
          <>
            <TooltipRow label="PA" value={String(player.pa ?? "—")} />
            <TooltipRow label="HR" value={String(player.hr ?? "—")} />
            <TooltipRow label="OPS" value={formatOPS(player.ops)} />
            <TooltipRow label="vs L" value={formatOPS(player.opsL)} />
            <TooltipRow label="vs R" value={formatOPS(player.opsR)} />
            {showDef && <TooltipRow label="Def" value={formatDef(player.defRating)} />}
          </>
        )}
      </div>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
