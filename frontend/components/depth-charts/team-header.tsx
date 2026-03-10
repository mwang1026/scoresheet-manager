"use client";

import type { DepthChartTeam } from "@/lib/depth-charts/types";
import {
  DEPTH_DOT_CONFIG,
  MIN_PROJECTED_PA,
  MIN_PROJECTED_P_IP,
  MIN_PROJECTED_SR_IP,
  SP_POSITIONS,
  SR_POSITIONS,
  PITCHER_POSITIONS,
} from "@/lib/depth-charts/types";
import type { StatsSource } from "@/lib/stats/types";

interface TeamHeaderProps {
  team: DepthChartTeam;
  statsSource: StatsSource;
  defToggle?: boolean;
}

function formatOPS(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

function formatERA(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(2);
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDEF(val: number | null): string {
  if (val === null) return "\u2014";
  const abs = Math.abs(val).toFixed(2);
  if (val > 0) return "+" + abs;
  if (val < 0) return "\u2212" + abs; // unicode minus
  return abs;
}

function getDefColor(val: number | null): string {
  if (val === null || val === 0) return "text-muted-foreground";
  return val > 0 ? "text-[#22C55E]" : "text-[#EF4444]";
}

function getDepthDotColor(count: number, thresholds: [number, number]): string {
  if (count >= thresholds[0]) return "#22C55E"; // green
  if (count >= thresholds[1]) return "#F59E0B"; // amber
  return "#EF4444"; // red
}

export function TeamHeader({ team, statsSource, defToggle = false }: TeamHeaderProps) {
  return (
    <div className="whitespace-nowrap">
      {/* Team name */}
      <span className="block text-[13px] font-semibold uppercase tracking-[0.03em] text-foreground mb-0.5">
        {team.name}
      </span>

      {/* Hero stat line — OPS/ERA */}
      <div className={`font-mono text-[15px] font-medium tabular-nums text-foreground tracking-[-0.02em] my-1.5 flex gap-1.5 items-baseline${defToggle ? " opacity-50" : ""}`}>
        <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-[0.04em]">
          vL
        </span>
        {formatOPS(team.vL)}
        <span className="text-border mx-0.5 font-light">/</span>
        <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-[0.04em]">
          vR
        </span>
        {formatOPS(team.vR)}
        <span className="text-border mx-0.5 font-light">&middot;</span>
        <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-[0.04em]">
          ERA
        </span>
        {formatERA(team.spEra)}
      </div>

      {/* DEF line */}
      <div className={`font-mono text-[13px] font-medium tabular-nums tracking-[-0.02em] mb-1.5 flex gap-1.5 items-baseline${defToggle ? "" : " opacity-60"}`}>
        <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-[0.04em]">
          DEF vL
        </span>
        <span className={getDefColor(team.defVsL)}>{formatDEF(team.defVsL)}</span>
        <span className="text-border mx-0.5 font-light">/</span>
        <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-[0.04em]">
          vR
        </span>
        <span className={getDefColor(team.defVsR)}>{formatDEF(team.defVsR)}</span>
        <span className="text-border mx-0.5 font-light">&middot;</span>
        <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-[0.04em]">
          Late
        </span>
        <span className={getDefColor(team.defLate)}>{formatDEF(team.defLate)}</span>
      </div>

      {/* Pick badge + depth dots */}
      <div className="flex gap-2.5 items-center mb-1.5">
        {team.pickPosition !== null && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-muted text-muted-foreground tracking-[0.02em]">
            Pick: {getOrdinal(team.pickPosition)}
          </span>
        )}
        {statsSource === "projected" && team.lineupGaps > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-destructive/15 text-destructive"
            title={`${team.lineupGaps} lineup slot${team.lineupGaps > 1 ? "s" : ""} unfilled at projected PA/IP thresholds`}
          >
            {team.lineupGaps} {team.lineupGaps === 1 ? "gap" : "gaps"}
          </span>
        )}
        <DepthDots team={team} statsSource={statsSource} />
      </div>
    </div>
  );
}

function meetsVolumeThreshold(
  player: { type: "hitter" | "pitcher"; pa?: number; ip?: number },
  position: string,
  statsSource: StatsSource,
): boolean {
  if (statsSource === "projected") {
    if (player.type === "hitter") return (player.pa ?? 0) >= MIN_PROJECTED_PA;
    if (SP_POSITIONS.has(position)) return (player.ip ?? 0) >= MIN_PROJECTED_P_IP;
    if (SR_POSITIONS.has(position)) return (player.ip ?? 0) >= MIN_PROJECTED_SR_IP;
    return false;
  }
  // Actual stats: any playing time counts
  if (player.type === "hitter") return (player.pa ?? 0) > 0;
  if (PITCHER_POSITIONS.has(position)) return (player.ip ?? 0) > 0;
  return false;
}

function DepthDots({ team, statsSource }: { team: DepthChartTeam; statsSource: StatsSource }) {
  return (
    <div className="flex gap-1.5 items-end">
      {DEPTH_DOT_CONFIG.map(({ label, positions, thresholds }) => {
        const count = positions.reduce((sum, pos) => {
          const players = team.roster[pos] || [];
          return sum + players.filter((p) => meetsVolumeThreshold(p, pos, statsSource)).length;
        }, 0);
        const color = getDepthDotColor(count, thresholds);

        return (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <span className="font-mono text-[10px] text-muted-foreground tracking-[0.02em] leading-none">
              {label}
            </span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        );
      })}
    </div>
  );
}
