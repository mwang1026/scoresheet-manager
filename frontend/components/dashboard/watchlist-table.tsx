"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { formatAvg, formatRate, formatIP, isPlayerPitcher } from "@/lib/stats";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Player, Team } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface WatchlistTableProps {
  players: Player[];
  teams: Team[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  queue: number[];
  getQueuePosition: (playerId: number) => number | null;
  onRemove: (playerId: number) => void;
  isHydrated: boolean;
}

export function WatchlistTable({
  players,
  teams,
  hitterStatsMap,
  pitcherStatsMap,
  getQueuePosition,
  onRemove,
  isHydrated,
}: WatchlistTableProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);

  // Create team lookup map
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  // Split into hitters and pitchers
  const hitters = players.filter((p) => !isPlayerPitcher(p));
  const pitchers = players.filter((p) => isPlayerPitcher(p));

  const handleRemoveClick = (player: Player) => {
    setPlayerToRemove(player);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRemove = () => {
    if (playerToRemove) {
      onRemove(playerToRemove.id);
      setConfirmDialogOpen(false);
      setPlayerToRemove(null);
    }
  };

  const handleCancelRemove = () => {
    setConfirmDialogOpen(false);
    setPlayerToRemove(null);
  };

  const queuePosition = playerToRemove ? getQueuePosition(playerToRemove.id) : null;

  if (players.length === 0) {
    return (
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Watchlist</h2>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            No players on your watchlist yet. Browse the Players page to add players.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Hitters Table */}
        {hitters.length > 0 && (
          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Watchlist - Hitters ({hitters.length})</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted border-b-2 border-border">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-10">☆</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-12">Q#</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Name</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Pos</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Fantasy Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">PA</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">AVG</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">HR</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">RBI</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">OPS</th>
                  </tr>
                </thead>
                <tbody>
                  {hitters.map((player) => {
                    const stats = hitterStatsMap.get(player.id);
                    const position = getQueuePosition(player.id);
                    return (
                      <tr key={player.id} className="even:bg-muted hover:bg-muted">
                        <td className="py-1.5 px-2">
                          {isHydrated && (
                            <button
                              onClick={() => handleRemoveClick(player)}
                              className="text-yellow-500 hover:text-yellow-600"
                              aria-label={`Remove ${player.name} from watchlist`}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums">
                          {position !== null ? (
                            <span className="text-brand-blue font-medium">{position}</span>
                          ) : ""}
                        </td>
                        <td className="py-1.5 px-2 font-medium">
                          <Link
                            href={`/players/${player.id}`}
                            className="text-primary hover:underline"
                          >
                            {player.name}
                          </Link>
                        </td>
                        <td className="py-1.5 px-2">{player.primary_position}</td>
                        <td className="py-1.5 px-2">{player.current_team}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">
                          {player.team_id !== null ? teamMap.get(player.team_id) : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "PA" in stats ? stats.PA : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "AVG" in stats ? formatAvg(stats.AVG) : "---"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "HR" in stats ? stats.HR : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "RBI" in stats ? stats.RBI : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "OPS" in stats ? formatAvg(stats.OPS) : "---"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pitchers Table */}
        {pitchers.length > 0 && (
          <div className="border rounded-lg">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Watchlist - Pitchers ({pitchers.length})</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted border-b-2 border-border">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-10">☆</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-12">Q#</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Name</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Pos</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Fantasy Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">IP</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">W-L</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">ERA</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">K</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-right tabular-nums">WHIP</th>
                  </tr>
                </thead>
                <tbody>
                  {pitchers.map((player) => {
                    const stats = pitcherStatsMap.get(player.id);
                    const position = getQueuePosition(player.id);
                    return (
                      <tr key={player.id} className="even:bg-muted hover:bg-muted">
                        <td className="py-1.5 px-2">
                          {isHydrated && (
                            <button
                              onClick={() => handleRemoveClick(player)}
                              className="text-yellow-500 hover:text-yellow-600"
                              aria-label={`Remove ${player.name} from watchlist`}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums">
                          {position !== null ? (
                            <span className="text-brand-blue font-medium">{position}</span>
                          ) : ""}
                        </td>
                        <td className="py-1.5 px-2 font-medium">
                          <Link
                            href={`/players/${player.id}`}
                            className="text-primary hover:underline"
                          >
                            {player.name}
                          </Link>
                        </td>
                        <td className="py-1.5 px-2">{player.primary_position}</td>
                        <td className="py-1.5 px-2">{player.current_team}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">
                          {player.team_id !== null ? teamMap.get(player.team_id) : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "W" in stats && "L" in stats
                            ? `${stats.W}-${stats.L}`
                            : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "K" in stats ? stats.K : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "WHIP" in stats ? formatRate(stats.WHIP) : "---"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDialogOpen}
        title={`Remove ${playerToRemove?.name} from watchlist?`}
        description={
          queuePosition !== null
            ? `This will also remove them from your draft queue (position #${queuePosition})`
            : undefined
        }
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
      />
    </>
  );
}
