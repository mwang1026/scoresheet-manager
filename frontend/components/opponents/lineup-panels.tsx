"use client";

/**
 * Batting order, rotation, and bullpen panels for the team detail page.
 * Built from the scraped Scoresheet lineup (GET /api/lineups).
 */

import Link from "next/link";
import { SectionPanel } from "@/components/ui/section-panel";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";
import { formatAvg, formatIP, formatRate } from "@/lib/stats";
import type { AggregatedHitterStats, AggregatedPitcherStats, PlayoffHitterMeta, PlayoffPitcherMeta } from "@/lib/stats";
import { PLAYOFF_ROTATION_SIZE } from "@/lib/lineups";
import type { LineupPitcher, LineupSlot, Player } from "@/lib/types";

const TD = "py-1.5 px-2";
const TD_NUM = `${TD} text-right font-mono tabular-nums`;
const TH = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap text-left";
const TH_NUM = `${TH} text-right font-mono tabular-nums`;

interface NameCellProps {
  playerId: number | null;
  pin: number;
  teamId: number;
  playerMap: Map<number, Player>;
}

/** Player name with a link; unresolved pins show as AAA fill-ins; traded players get a badge. */
function NameCell({ playerId, pin, teamId, playerMap }: NameCellProps) {
  const player = playerId !== null ? playerMap.get(playerId) : undefined;
  if (!player) {
    return (
      <td className={TD}>
        <span className="text-muted-foreground" title={`Scoresheet pin ${pin}: not in the player list (AAA fill-in)`}>
          AAA fill-in
        </span>
      </td>
    );
  }
  return (
    <td className={`${TD} whitespace-nowrap`}>
      <Link href={`/players/${player.id}`} className="text-primary hover:underline">
        {player.name}
      </Link>
      {player.team_id !== teamId && (
        <span
          className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded-[3px] bg-muted text-muted-foreground"
          title="No longer on this roster"
        >
          moved
        </span>
      )}
    </td>
  );
}

interface BattingOrderPanelProps {
  title: string;
  slots: LineupSlot[] | null;
  teamId: number;
  playerMap: Map<number, Player>;
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  playoffMeta?: Map<number, PlayoffHitterMeta>;
}

export function BattingOrderPanel({ title, slots, teamId, playerMap, hitterStatsMap, playoffMeta }: BattingOrderPanelProps) {
  return (
    <SectionPanel title={title}>
      {slots === null ? (
        <p className="p-3 text-xs text-muted-foreground">No games against this hand in the scraped week.</p>
      ) : (
        <table className="min-w-full text-xs whitespace-nowrap">
          <thead className="bg-muted border-b-2 border-border">
            <tr>
              <th className={TH_NUM}>#</th>
              <th className={TH}>Pos</th>
              <th className={TH}>Name</th>
              <th className={TH_NUM}>OPS</th>
              {playoffMeta && <th className={TH_NUM} title="PA available per playoff series">Ser PA</th>}
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const stats = s.player_id !== null ? hitterStatsMap.get(s.player_id) : undefined;
              const meta = s.player_id !== null ? playoffMeta?.get(s.player_id) : undefined;
              const out = playoffMeta && s.player_id !== null && meta && !meta.willPlay;
              return (
                <tr key={s.slot} className={`odd:bg-background even:bg-muted ${out ? "opacity-50" : ""}`}>
                  <td className={TD_NUM}>{s.slot + 1}</td>
                  <td className={`${TD} text-muted-foreground`}>{s.position}</td>
                  <NameCell playerId={s.player_id} pin={s.pin} teamId={teamId} playerMap={playerMap} />
                  <td className={TD_NUM}>{stats ? formatAvg(stats.OPS) : <RateDash />}</td>
                  {playoffMeta && (
                    <td className={TD_NUM}>
                      {meta ? (meta.willPlay ? meta.seriesPACap : <span className="text-destructive font-semibold">OUT</span>) : <Dash />}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SectionPanel>
  );
}

interface PitchingPanelProps {
  title: string;
  pitchers: LineupPitcher[];
  /** Rotation panels mark the first four as the playoff rotation. */
  isRotation: boolean;
  teamId: number;
  playerMap: Map<number, Player>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  playoffMeta?: Map<number, PlayoffPitcherMeta>;
  emptyMessage: string;
}

export function PitchingPanel({
  title,
  pitchers,
  isRotation,
  teamId,
  playerMap,
  pitcherStatsMap,
  playoffMeta,
  emptyMessage,
}: PitchingPanelProps) {
  return (
    <SectionPanel title={title}>
      {pitchers.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <table className="min-w-full text-xs whitespace-nowrap">
          <thead className="bg-muted border-b-2 border-border">
            <tr>
              <th className={TH_NUM}>#</th>
              <th className={TH}>Name</th>
              <th className={TH_NUM} title={isRotation ? "Starts in the scraped week" : "Appearances in the scraped week"}>G</th>
              <th className={TH_NUM}>ERA</th>
              <th className={TH_NUM}>WHIP</th>
              {playoffMeta && <th className={TH_NUM} title="Innings available per playoff series">Ser IP</th>}
              {playoffMeta && isRotation && <th className={TH_NUM} title="Playoff starts allowed per series">Starts</th>}
            </tr>
          </thead>
          <tbody>
            {pitchers.map((p, i) => {
              const stats = p.player_id !== null ? pitcherStatsMap.get(p.player_id) : undefined;
              const meta = p.player_id !== null ? playoffMeta?.get(p.player_id) : undefined;
              const beyondRotation = isRotation && i >= PLAYOFF_ROTATION_SIZE;
              const out = playoffMeta && p.player_id !== null && meta && !meta.willPlay;
              return (
                <tr
                  key={`${p.pin}-${i}`}
                  className={`odd:bg-background even:bg-muted ${out || beyondRotation ? "opacity-50" : ""}`}
                  title={beyondRotation ? "Beyond the four-man playoff rotation" : undefined}
                >
                  <td className={TD_NUM}>{i + 1}</td>
                  <NameCell playerId={p.player_id} pin={p.pin} teamId={teamId} playerMap={playerMap} />
                  <td className={TD_NUM}>{p.games}</td>
                  <td className={TD_NUM}>{stats ? formatRate(stats.ERA) : <RateDash />}</td>
                  <td className={TD_NUM}>{stats ? formatRate(stats.WHIP) : <RateDash />}</td>
                  {playoffMeta && (
                    <td className={TD_NUM}>
                      {meta ? (meta.willPlay ? formatIP(meta.seriesIPOutsCap) : <span className="text-destructive font-semibold">OUT</span>) : <Dash />}
                    </td>
                  )}
                  {playoffMeta && isRotation && <td className={TD_NUM}>{meta ? meta.playoffStarts : <Dash />}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SectionPanel>
  );
}
