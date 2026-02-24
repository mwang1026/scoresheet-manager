"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Star, ChevronUp, ChevronDown } from "lucide-react";
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

type HitterSortColumn = "Name" | "R" | "RBI" | "HR" | "SB" | "AVG" | "OBP" | "SLG" | "OPS";
type PitcherSortColumn = "Name" | "G" | "GS" | "IP" | "K" | "BB" | "ER" | "R" | "ERA" | "WHIP";

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

  const [hitterSortColumn, setHitterSortColumn] = useState<HitterSortColumn>("OPS");
  const [hitterSortDirection, setHitterSortDirection] = useState<"asc" | "desc">("desc");
  const [pitcherSortColumn, setPitcherSortColumn] = useState<PitcherSortColumn>("ERA");
  const [pitcherSortDirection, setPitcherSortDirection] = useState<"asc" | "desc">("asc");

  // Create team lookup map
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  // Split into hitters and pitchers
  const hitters = players.filter((p) => !isPlayerPitcher(p));
  const pitchers = players.filter((p) => isPlayerPitcher(p));

  const handleHitterSort = (column: HitterSortColumn) => {
    if (hitterSortColumn === column) {
      setHitterSortDirection(hitterSortDirection === "asc" ? "desc" : "asc");
    } else {
      setHitterSortColumn(column);
      setHitterSortDirection("desc");
    }
  };

  const handlePitcherSort = (column: PitcherSortColumn) => {
    if (pitcherSortColumn === column) {
      setPitcherSortDirection(pitcherSortDirection === "asc" ? "desc" : "asc");
    } else {
      setPitcherSortColumn(column);
      setPitcherSortDirection("asc");
    }
  };

  const HitterSortIndicator = ({ column }: { column: HitterSortColumn }) => {
    if (hitterSortColumn !== column) return null;
    return hitterSortDirection === "asc" ? (
      <ChevronUp className="inline w-3 h-3" />
    ) : (
      <ChevronDown className="inline w-3 h-3" />
    );
  };

  const PitcherSortIndicator = ({ column }: { column: PitcherSortColumn }) => {
    if (pitcherSortColumn !== column) return null;
    return pitcherSortDirection === "asc" ? (
      <ChevronUp className="inline w-3 h-3" />
    ) : (
      <ChevronDown className="inline w-3 h-3" />
    );
  };

  const sortedHitters = useMemo(() => {
    return [...hitters].sort((a, b) => {
      if (hitterSortColumn === "Name") {
        const cmp = a.name.localeCompare(b.name);
        return hitterSortDirection === "asc" ? cmp : -cmp;
      }
      const aStats = hitterStatsMap.get(a.id);
      const bStats = hitterStatsMap.get(b.id);
      const aVal = aStats ? (aStats[hitterSortColumn as keyof AggregatedHitterStats] as number) : null;
      const bVal = bStats ? (bStats[hitterSortColumn as keyof AggregatedHitterStats] as number) : null;
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal - bVal;
      return hitterSortDirection === "asc" ? cmp : -cmp;
    });
  }, [hitters, hitterStatsMap, hitterSortColumn, hitterSortDirection]);

  const sortedPitchers = useMemo(() => {
    return [...pitchers].sort((a, b) => {
      if (pitcherSortColumn === "Name") {
        const cmp = a.name.localeCompare(b.name);
        return pitcherSortDirection === "asc" ? cmp : -cmp;
      }
      const aStats = pitcherStatsMap.get(a.id);
      const bStats = pitcherStatsMap.get(b.id);
      let aVal: number | null = null;
      let bVal: number | null = null;
      if (pitcherSortColumn === "IP") {
        aVal = aStats ? aStats.IP_outs : null;
        bVal = bStats ? bStats.IP_outs : null;
      } else {
        const key = pitcherSortColumn as keyof AggregatedPitcherStats;
        aVal = aStats ? (aStats[key] as number) : null;
        bVal = bStats ? (bStats[key] as number) : null;
      }
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal - bVal;
      return pitcherSortDirection === "asc" ? cmp : -cmp;
    });
  }, [pitchers, pitcherStatsMap, pitcherSortColumn, pitcherSortDirection]);

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

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap";
  const thStat = `${thBase} text-right tabular-nums cursor-pointer select-none`;

  if (players.length === 0) {
    return (
      <div className="border rounded-lg">
        <div className="p-4 border-b bg-brand text-white rounded-t-lg">
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
            <div className="p-4 border-b bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold">Watchlist - Hitters ({hitters.length})</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted border-b-2 border-border">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-10">☆</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-12">Q#</th>
                    <th
                      className={`${thBase} text-left cursor-pointer select-none`}
                      onClick={() => handleHitterSort("Name")}
                    >
                      Name <HitterSortIndicator column="Name" />
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Pos</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Fantasy Team</th>
                    <th className={thStat} onClick={() => handleHitterSort("R")}>R <HitterSortIndicator column="R" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("RBI")}>RBI <HitterSortIndicator column="RBI" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("HR")}>HR <HitterSortIndicator column="HR" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("SB")}>SB <HitterSortIndicator column="SB" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("AVG")}>AVG <HitterSortIndicator column="AVG" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("OBP")}>OBP <HitterSortIndicator column="OBP" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("SLG")}>SLG <HitterSortIndicator column="SLG" /></th>
                    <th className={thStat} onClick={() => handleHitterSort("OPS")}>OPS <HitterSortIndicator column="OPS" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHitters.map((player) => {
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
                          {stats && "R" in stats ? stats.R : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "RBI" in stats ? stats.RBI : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "HR" in stats ? stats.HR : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "SB" in stats ? stats.SB : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "AVG" in stats ? formatAvg(stats.AVG) : "---"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "OBP" in stats ? formatAvg(stats.OBP) : "---"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "SLG" in stats ? formatAvg(stats.SLG) : "---"}
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
            <div className="p-4 border-b bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold">Watchlist - Pitchers ({pitchers.length})</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted border-b-2 border-border">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-10">☆</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left w-12">Q#</th>
                    <th
                      className={`${thBase} text-left cursor-pointer select-none`}
                      onClick={() => handlePitcherSort("Name")}
                    >
                      Name <PitcherSortIndicator column="Name" />
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Pos</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left">Fantasy Team</th>
                    <th className={thStat} onClick={() => handlePitcherSort("G")}>G <PitcherSortIndicator column="G" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("GS")}>GS <PitcherSortIndicator column="GS" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("IP")}>IP <PitcherSortIndicator column="IP" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("K")}>K <PitcherSortIndicator column="K" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("BB")}>BB <PitcherSortIndicator column="BB" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("ER")}>ER <PitcherSortIndicator column="ER" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("R")}>R <PitcherSortIndicator column="R" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("ERA")}>ERA <PitcherSortIndicator column="ERA" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("WHIP")}>WHIP <PitcherSortIndicator column="WHIP" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPitchers.map((player) => {
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
                          {stats && "G" in stats ? stats.G : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "GS" in stats ? stats.GS : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "K" in stats ? stats.K : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "BB" in stats ? stats.BB : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "ER" in stats ? stats.ER : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "R" in stats ? stats.R : "—"}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">
                          {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
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
