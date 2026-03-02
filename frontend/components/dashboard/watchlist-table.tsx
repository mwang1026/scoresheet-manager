"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Star, ChevronUp, ChevronDown } from "lucide-react";
import { formatAvg, formatRate, formatIP, isPlayerPitcher } from "@/lib/stats";
import { DEFAULT_HITTER_SORT, DEFAULT_PITCHER_SORT } from "@/lib/defaults";
import { PIN_WIDTHS, getPinWidths, formatFantasyTeamAbbr } from "@/lib/table-helpers";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";
import { SectionPanel } from "@/components/ui/section-panel";
import type { Player, Team } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";
import {
  type CompactHitterSortColumn as HitterSortColumn,
  type CompactPitcherSortColumn as PitcherSortColumn,
} from "@/lib/sort-columns";

interface WatchlistTableProps {
  players: Player[];
  teams: Team[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  queue: number[];
  getQueuePosition: (playerId: number) => number | null;
  onRemove: (playerId: number) => void;
  isHydrated: boolean;
  defaultHitterSort?: { column: string; direction: "asc" | "desc" };
  defaultPitcherSort?: { column: string; direction: "asc" | "desc" };
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
}


export function WatchlistTable({
  players,
  teams,
  hitterStatsMap,
  pitcherStatsMap,
  getQueuePosition,
  onRemove,
  isHydrated,
  defaultHitterSort,
  defaultPitcherSort,
  getNote,
  saveNote,
  newsPlayerIds,
}: WatchlistTableProps) {
  const isMobile = useIsMobile();
  const pw = getPinWidths(isMobile);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);

  const [hitterSortColumn, setHitterSortColumn] = useState<HitterSortColumn>(
    (defaultHitterSort?.column as HitterSortColumn) ?? (DEFAULT_HITTER_SORT.column as HitterSortColumn)
  );
  const [hitterSortDirection, setHitterSortDirection] = useState<"asc" | "desc">(
    defaultHitterSort?.direction ?? DEFAULT_HITTER_SORT.direction
  );
  const [pitcherSortColumn, setPitcherSortColumn] = useState<PitcherSortColumn>(
    (defaultPitcherSort?.column as PitcherSortColumn) ?? (DEFAULT_PITCHER_SORT.column as PitcherSortColumn)
  );
  const [pitcherSortDirection, setPitcherSortDirection] = useState<"asc" | "desc">(
    defaultPitcherSort?.direction ?? DEFAULT_PITCHER_SORT.direction
  );

  // Create team lookup map (stores full team object for abbreviation + tooltip)
  const teamMap = new Map(teams.map((t) => [t.id, t]));

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
      if (pitcherSortColumn === "IP_outs") {
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

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap sticky-header-cell";
  const thStat = `${thBase} text-right font-mono tabular-nums cursor-pointer select-none`;

  if (players.length === 0) {
    return (
      <SectionPanel title="Watchlist">
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            No players on your watchlist yet. Browse the Players page to add players.
          </p>
        </div>
      </SectionPanel>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Hitters Table */}
        {hitters.length > 0 && (
          <SectionPanel title="Watchlist - Hitters" badge={`${hitters.length}`}>
            <div className="overflow-x-scroll overflow-y-auto md:max-h-[75vh] scroll-hint">
              <table className="min-w-full text-xs whitespace-nowrap">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-col-header hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }}>☆</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-col-header hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }}>Q#</th>
                    <th
                      className={`${thBase} text-left cursor-pointer select-none sticky-col-header sticky-col-divider`}
                      style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}
                      onClick={() => handleHitterSort("Name")}
                    >
                      Name <HitterSortIndicator column="Name" />
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-header-cell">Pos</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-header-cell">Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-header-cell">FTeam</th>
                    <th className={thStat} onClick={() => handleHitterSort("PA")}>PA <HitterSortIndicator column="PA" /></th>
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
                <tbody key={`${hitterSortColumn}-${hitterSortDirection}`} className="animate-fade-in">
                  {sortedHitters.map((player) => {
                    const stats = hitterStatsMap.get(player.id);
                    const position = getQueuePosition(player.id);
                    return (
                      <tr key={player.id} className="odd:bg-background even:bg-muted hover:bg-row-hover transition-colors duration-100">
                        <td className="py-1.5 px-2 sticky-col hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }}>
                          {isHydrated && (
                            <button
                              onClick={() => handleRemoveClick(player)}
                              className="text-brand hover:text-brand/80 p-2 -m-2 md:p-0 md:m-0"
                              aria-label={`Remove ${player.name} from watchlist`}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums sticky-col hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }}>
                          {position !== null ? (
                            <span className="text-brand font-medium">{position}</span>
                          ) : ""}
                        </td>
                        <td className="py-1.5 px-2 font-medium sticky-col sticky-col-divider" style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}>
                          <Link
                            href={`/players/${player.id}`}
                            className="text-primary hover:underline"
                          >
                            {player.name}
                          </Link>
                          <NoteIcon playerId={player.id} playerName={player.name} noteContent={getNote(player.id)} onSave={saveNote} />
                          <NewsIcon playerId={player.id} hasNews={newsPlayerIds?.has(player.id) ?? false} />
                          <ILIcon ilType={player.il_type} ilDate={player.il_date} />
                        </td>
                        <td className="py-1.5 px-2">{player.primary_position}</td>
                        <td className="py-1.5 px-2">{player.current_team}</td>
                        <td className="py-1.5 px-2 text-muted-foreground" title={player.team_id !== null ? teamMap.get(player.team_id)?.name : undefined}>
                          {player.team_id !== null ? formatFantasyTeamAbbr(teamMap.get(player.team_id)) : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "PA" in stats ? stats.PA : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "R" in stats ? stats.R : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "RBI" in stats ? stats.RBI : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "HR" in stats ? stats.HR : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "SB" in stats ? stats.SB : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "AVG" in stats ? formatAvg(stats.AVG) : <RateDash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "OBP" in stats ? formatAvg(stats.OBP) : <RateDash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "SLG" in stats ? formatAvg(stats.SLG) : <RateDash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "OPS" in stats ? formatAvg(stats.OPS) : <RateDash />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>
        )}

        {/* Pitchers Table */}
        {pitchers.length > 0 && (
          <SectionPanel title="Watchlist - Pitchers" badge={`${pitchers.length}`}>
            <div className="overflow-x-scroll overflow-y-auto md:max-h-[75vh] scroll-hint">
              <table className="min-w-full text-xs whitespace-nowrap">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-col-header hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }}>☆</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-col-header hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }}>Q#</th>
                    <th
                      className={`${thBase} text-left cursor-pointer select-none sticky-col-header sticky-col-divider`}
                      style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}
                      onClick={() => handlePitcherSort("Name")}
                    >
                      Name <PitcherSortIndicator column="Name" />
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-header-cell">Pos</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-header-cell">Team</th>
                    <th className="py-1.5 px-2 font-semibold text-foreground text-left sticky-header-cell">FTeam</th>
                    <th className={thStat} onClick={() => handlePitcherSort("G")}>G <PitcherSortIndicator column="G" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("GS")}>GS <PitcherSortIndicator column="GS" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("IP_outs")}>IP <PitcherSortIndicator column="IP_outs" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("K")}>K <PitcherSortIndicator column="K" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("BB")}>BB <PitcherSortIndicator column="BB" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("ER")}>ER <PitcherSortIndicator column="ER" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("R")}>R <PitcherSortIndicator column="R" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("ERA")}>ERA <PitcherSortIndicator column="ERA" /></th>
                    <th className={thStat} onClick={() => handlePitcherSort("WHIP")}>WHIP <PitcherSortIndicator column="WHIP" /></th>
                  </tr>
                </thead>
                <tbody key={`${pitcherSortColumn}-${pitcherSortDirection}`} className="animate-fade-in">
                  {sortedPitchers.map((player) => {
                    const stats = pitcherStatsMap.get(player.id);
                    const position = getQueuePosition(player.id);
                    return (
                      <tr key={player.id} className="odd:bg-background even:bg-muted hover:bg-row-hover transition-colors duration-100">
                        <td className="py-1.5 px-2 sticky-col hidden md:table-cell" style={{ left: 0, width: PIN_WIDTHS.star, minWidth: PIN_WIDTHS.star }}>
                          {isHydrated && (
                            <button
                              onClick={() => handleRemoveClick(player)}
                              className="text-brand hover:text-brand/80 p-2 -m-2 md:p-0 md:m-0"
                              aria-label={`Remove ${player.name} from watchlist`}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          )}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums sticky-col hidden md:table-cell" style={{ left: PIN_WIDTHS.star, width: PIN_WIDTHS.queue, minWidth: PIN_WIDTHS.queue }}>
                          {position !== null ? (
                            <span className="text-brand font-medium">{position}</span>
                          ) : ""}
                        </td>
                        <td className="py-1.5 px-2 font-medium sticky-col sticky-col-divider" style={{ left: isMobile ? 0 : PIN_WIDTHS.star + PIN_WIDTHS.queue, width: pw.name, minWidth: pw.name }}>
                          <Link
                            href={`/players/${player.id}`}
                            className="text-primary hover:underline"
                          >
                            {player.name}
                          </Link>
                          <NoteIcon playerId={player.id} playerName={player.name} noteContent={getNote(player.id)} onSave={saveNote} />
                          <NewsIcon playerId={player.id} hasNews={newsPlayerIds?.has(player.id) ?? false} />
                          <ILIcon ilType={player.il_type} ilDate={player.il_date} />
                        </td>
                        <td className="py-1.5 px-2">{player.primary_position}</td>
                        <td className="py-1.5 px-2">{player.current_team}</td>
                        <td className="py-1.5 px-2 text-muted-foreground" title={player.team_id !== null ? teamMap.get(player.team_id)?.name : undefined}>
                          {player.team_id !== null ? formatFantasyTeamAbbr(teamMap.get(player.team_id)) : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "G" in stats ? stats.G : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "GS" in stats ? stats.GS : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "K" in stats ? stats.K : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "BB" in stats ? stats.BB : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "ER" in stats ? stats.ER : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "R" in stats ? stats.R : <Dash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "ERA" in stats ? formatRate(stats.ERA) : <RateDash />}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                          {stats && "WHIP" in stats ? formatRate(stats.WHIP) : <RateDash />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>
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
