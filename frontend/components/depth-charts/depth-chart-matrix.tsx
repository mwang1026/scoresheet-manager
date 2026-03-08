"use client";

import { useCallback, useState, type MouseEvent } from "react";
import type {
  DepthChartTeam,
  DepthChartPlayer,
  DepthChartPosition,
  ViewMode,
} from "@/lib/depth-charts/types";
import {
  DEPTH_CHART_POSITIONS,
  POSITION_DEF_BASELINE,
} from "@/lib/depth-charts/types";
import type { AvailablePlayerEntry } from "@/lib/depth-charts/available-players";
import { TeamHeader } from "./team-header";
import { PlayerEntry } from "./player-entry";
import { DepthChartTooltip } from "./depth-chart-tooltip";
import { PositionTooltip } from "./position-tooltip";

interface DepthChartMatrixProps {
  teams: DepthChartTeam[];
  viewMode: ViewMode;
  availableByPosition?: Map<DepthChartPosition, AvailablePlayerEntry[]>;
}

export function DepthChartMatrix({ teams, viewMode, availableByPosition }: DepthChartMatrixProps) {
  const [tooltip, setTooltip] = useState<{
    player: DepthChartPlayer;
    position: DepthChartPosition;
    x: number;
    y: number;
  } | null>(null);

  const [posTooltip, setPosTooltip] = useState<{
    position: DepthChartPosition;
    x: number;
    y: number;
  } | null>(null);

  const handleMouseEnter = useCallback(
    (e: MouseEvent, player: DepthChartPlayer, position: DepthChartPosition) => {
      setTooltip({
        player,
        position,
        x: Math.min(e.clientX + 12, window.innerWidth - 250),
        y: Math.min(e.clientY + 12, window.innerHeight - 200),
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (tooltip) {
        setTooltip((prev) =>
          prev
            ? {
                ...prev,
                x: Math.min(e.clientX + 12, window.innerWidth - 250),
                y: Math.min(e.clientY + 12, window.innerHeight - 200),
              }
            : null
        );
      }
    },
    [tooltip]
  );

  const handlePosMouseEnter = useCallback(
    (e: MouseEvent, position: DepthChartPosition) => {
      if (!availableByPosition?.get(position)?.length) return;
      setPosTooltip({
        position,
        x: Math.min(e.clientX + 12, window.innerWidth - 300),
        y: Math.min(e.clientY + 12, window.innerHeight - 200),
      });
    },
    [availableByPosition]
  );

  const handlePosMouseLeave = useCallback(() => {
    setPosTooltip(null);
  }, []);

  const handlePosMouseMove = useCallback(
    (e: MouseEvent) => {
      if (posTooltip) {
        setPosTooltip((prev) =>
          prev
            ? {
                ...prev,
                x: Math.min(e.clientX + 12, window.innerWidth - 300),
                y: Math.min(e.clientY + 12, window.innerHeight - 200),
              }
            : null
        );
      }
    },
    [posTooltip]
  );

  // Find "my team" for sticky column
  const myTeamIndex = teams.findIndex((t) => t.isMyTeam);

  return (
    <>
      <div className="overflow-x-auto border border-border rounded-md">
        <table className="dc-table border-separate border-spacing-0 w-max min-w-full">
          <thead>
            <tr>
              {/* Position column header */}
              <th className="dc-pos-col sticky top-0 border-b border-border border-r border-r-border px-3 py-2.5 text-center min-w-[52px] w-[52px] bg-[hsl(var(--card))]">
                <span className="text-[13px] font-bold text-brand">POS</span>
              </th>

              {/* Team headers */}
              {teams.map((team, idx) => (
                <th
                  key={team.id}
                  className={`sticky top-0 border-b border-border px-3 py-2.5 text-left min-w-[190px] bg-[hsl(var(--card))] ${
                    idx === myTeamIndex ? "dc-team-mike" : ""
                  }`}
                >
                  <TeamHeader team={team} />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {DEPTH_CHART_POSITIONS.map((pos) => {
              const baseline = POSITION_DEF_BASELINE[pos];
              return (
                <tr key={pos}>
                  {/* Position label cell */}
                  <td
                    className={`dc-pos-col border-b border-border border-r border-r-border px-1.5 py-2.5 text-center bg-[hsl(var(--card))]${
                      availableByPosition?.get(pos)?.length ? " cursor-help" : ""
                    }`}
                    onMouseEnter={(e) => handlePosMouseEnter(e, pos)}
                    onMouseLeave={handlePosMouseLeave}
                    onMouseMove={handlePosMouseMove}
                  >
                    <span className="block text-[13px] font-bold text-brand tracking-[0.04em]">
                      {pos}
                    </span>
                    {baseline !== undefined && (
                      <span className="block font-mono text-[10px] font-medium text-muted-foreground tabular-nums mt-0.5 opacity-80">
                        {baseline.toFixed(2)}
                      </span>
                    )}
                  </td>

                  {/* Team cells */}
                  {teams.map((team, idx) => {
                    const players = team.roster[pos] || [];
                    return (
                      <td
                        key={team.id}
                        className={`border-b border-border px-2.5 py-1.5 min-w-[190px] max-w-[220px] align-top ${
                          idx === myTeamIndex ? "dc-team-mike" : ""
                        }`}
                      >
                        {players.map((player) => (
                          <PlayerEntry
                            key={`${player.id}-${pos}-${player.isPrimary}`}
                            player={player}
                            position={pos}
                            viewMode={viewMode}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onMouseMove={handleMouseMove}
                          />
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DepthChartTooltip
        player={tooltip?.player ?? null}
        position={tooltip?.position ?? null}
        x={tooltip?.x ?? 0}
        y={tooltip?.y ?? 0}
        visible={tooltip !== null}
      />

      <PositionTooltip
        position={posTooltip?.position ?? null}
        players={posTooltip ? availableByPosition?.get(posTooltip.position) : undefined}
        x={posTooltip?.x ?? 0}
        y={posTooltip?.y ?? 0}
        visible={posTooltip !== null}
      />
    </>
  );
}
