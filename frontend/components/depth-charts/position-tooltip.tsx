"use client";

import type { AvailablePlayerEntry } from "@/lib/depth-charts/available-players";
import type { DepthChartPosition } from "@/lib/depth-charts/types";

interface PositionTooltipProps {
  position: DepthChartPosition | null;
  players: AvailablePlayerEntry[] | undefined;
  x: number;
  y: number;
  visible: boolean;
}

function formatOPS(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

function formatERA(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(2);
}

export function PositionTooltip({ position, players, x, y, visible }: PositionTooltipProps) {
  if (!visible || !position || !players || players.length === 0) return null;

  const isHitter = players[0].type === "hitter";

  return (
    <div
      className="fixed z-[100] rounded-[5px] border border-border px-2.5 py-2 text-[10px] text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.5)] pointer-events-none max-w-[280px] leading-relaxed"
      style={{
        left: x,
        top: y,
        backgroundColor: "hsl(20, 8%, 12%)",
      }}
    >
      <div className="font-semibold text-[11px] mb-1.5 text-brand">
        Top FA — {position}
      </div>

      <table className="w-full font-mono tabular-nums text-[10px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left font-normal pr-3 pb-0.5">Name</th>
            {isHitter ? (
              <>
                <th className="text-right font-normal px-1 pb-0.5">vs L</th>
                <th className="text-right font-normal pl-1 pb-0.5">vs R</th>
              </>
            ) : (
              <th className="text-right font-normal pl-1 pb-0.5">ERA</th>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td className="text-left pr-3 py-px truncate max-w-[140px]">{p.name}</td>
              {p.type === "hitter" ? (
                <>
                  <td className="text-right px-1 py-px">{formatOPS(p.opsVsL)}</td>
                  <td className="text-right pl-1 py-px">{formatOPS(p.opsVsR)}</td>
                </>
              ) : (
                <td className="text-right pl-1 py-px">{formatERA(p.era)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
