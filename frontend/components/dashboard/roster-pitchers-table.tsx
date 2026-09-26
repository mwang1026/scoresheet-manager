"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatRate, formatIP, formatCount, getPositionsList } from "@/lib/stats";
import { DEFAULT_PITCHER_SORT } from "@/lib/defaults";
import { PIN_WIDTHS, getPinWidths } from "@/lib/table-helpers";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { Player } from "@/lib/types";
import type { AggregatedPitcherStats, PlayoffPitcherMeta } from "@/lib/stats";
import { type CompactPitcherSortColumn as PitcherSortColumn, isPlayoffPitcherSortColumn } from "@/lib/sort-columns";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";
import {
  PlayoffPitcherCells,
  PlayoffPitcherHeaderCells,
  PlayoffPitcherTotalCells,
  playoffPitcherSortValue,
  playoffRowClass,
  type TableColumnSet,
} from "@/components/ui/playoff-cells";
import { isPitchingStarter as isStarterForTotals, lineupSortKey, type LineupRoleMap } from "@/lib/lineups";
import { LineupRoleCell, StarterTotalsLabel } from "@/components/ui/lineup-cells";
import { SectionPanel } from "@/components/ui/section-panel";

interface RosterPitchersTableProps {
  players: Player[];
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  teamTotals: AggregatedPitcherStats;
  defaultSort?: { column: string; direction: "asc" | "desc" };
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
  /** "playoff" swaps G/GS/K/BB/ER/R for playing-time columns and mutes ineligible rows. */
  columnSet?: TableColumnSet;
  playoffMeta?: Map<number, PlayoffPitcherMeta>;
  /** When given, adds a sortable Lineup column (batting slot / rotation / bench). */
  lineupRoles?: LineupRoleMap;
  /** When given, adds a second totals row over lineup starters only. */
  starterTotals?: AggregatedPitcherStats;
  starterLabel?: string;
}

export function RosterPitchersTable({
  players,
  pitcherStatsMap,
  teamTotals,
  defaultSort,
  getNote,
  saveNote,
  newsPlayerIds,
  columnSet = "default",
  playoffMeta,
  lineupRoles,
  starterTotals,
  starterLabel,
}: RosterPitchersTableProps) {
  const isMobile = useIsMobile();
  const pw = getPinWidths(isMobile);
  const { sortColumn, sortDirection, handleSort } = useTableSort<PitcherSortColumn>(
    (defaultSort?.column as PitcherSortColumn) ?? (DEFAULT_PITCHER_SORT.column as PitcherSortColumn),
    defaultSort?.direction ?? DEFAULT_PITCHER_SORT.direction,
    "asc",
    { Lineup: "asc" }
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (sortColumn === "Name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDirection === "asc" ? cmp : -cmp;
      }
      if (sortColumn === "Lineup") {
        const cmp = lineupSortKey(lineupRoles?.get(a.id)) - lineupSortKey(lineupRoles?.get(b.id));
        return sortDirection === "asc" ? cmp : -cmp;
      }
      let aVal: number | null;
      let bVal: number | null;
      if (isPlayoffPitcherSortColumn(sortColumn)) {
        aVal = playoffPitcherSortValue(playoffMeta?.get(a.id), sortColumn);
        bVal = playoffPitcherSortValue(playoffMeta?.get(b.id), sortColumn);
      } else {
        const aStats = pitcherStatsMap.get(a.id);
        const bStats = pitcherStatsMap.get(b.id);
        const key = sortColumn as keyof AggregatedPitcherStats;
        aVal = aStats ? (aStats[key] as number) : null;
        bVal = bStats ? (bStats[key] as number) : null;
      }
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal - bVal;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [players, pitcherStatsMap, playoffMeta, lineupRoles, sortColumn, sortDirection]);

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap sticky-header-cell";
  const thStat = `${thBase} text-right font-mono tabular-nums cursor-pointer select-none`;

  return (
    <SectionPanel title="My Pitchers" badge={`${players.length}`}>
      <div className="overflow-x-scroll overflow-y-auto md:max-h-[75vh] scroll-hint">
        <table className="min-w-full text-xs whitespace-nowrap">
          <thead className="bg-muted border-b-2 border-border">
            <tr>
              <th
                className={`${thBase} text-left cursor-pointer select-none sticky-col-header sticky-col-divider`}
                style={{ left: 0, width: pw.name, minWidth: pw.name }}
                onClick={() => handleSort("Name")}
              >
                Name <SortIndicator active={sortColumn === "Name"} direction={sortDirection} />
              </th>
              <th className={`${thBase} text-left`}>Pos</th>
              {lineupRoles && (
                <th className={`${thBase} text-left cursor-pointer select-none`} title="Batting slot vs RHP / vs LHP, rotation number, RP, or bench" onClick={() => handleSort("Lineup")}>
                  Lineup <SortIndicator active={sortColumn === "Lineup"} direction={sortDirection} />
                </th>
              )}
              {columnSet === "default" && (
                <>
              <th className={thStat} onClick={() => handleSort("G")}>
                G <SortIndicator active={sortColumn === "G"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("GS")}>
                GS <SortIndicator active={sortColumn === "GS"} direction={sortDirection} />
              </th>
                </>
              )}
              <th className={thStat} onClick={() => handleSort("IP_outs")}>
                IP <SortIndicator active={sortColumn === "IP_outs"} direction={sortDirection} />
              </th>
              {columnSet === "playoff" ? (
                <PlayoffPitcherHeaderCells thStat={thStat} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              ) : (
                <>
              <th className={thStat} onClick={() => handleSort("K")}>
                K <SortIndicator active={sortColumn === "K"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("BB")}>
                BB <SortIndicator active={sortColumn === "BB"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("ER")}>
                ER <SortIndicator active={sortColumn === "ER"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("R")}>
                R <SortIndicator active={sortColumn === "R"} direction={sortDirection} />
              </th>
                </>
              )}
              <th className={thStat} onClick={() => handleSort("ERA")}>
                ERA <SortIndicator active={sortColumn === "ERA"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("WHIP")}>
                WHIP <SortIndicator active={sortColumn === "WHIP"} direction={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody key={`${sortColumn}-${sortDirection}`} className="animate-fade-in">
            {sortedPlayers.map((player) => {
              const stats = pitcherStatsMap.get(player.id);
              return (
                <tr key={player.id} className={`odd:bg-background even:bg-muted hover:bg-row-hover transition-colors duration-100 ${playoffRowClass(playoffMeta?.get(player.id))}`}>
                  <td className="py-1.5 px-2 font-medium sticky-col sticky-col-divider" style={{ left: 0, width: pw.name, minWidth: pw.name }}>
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
                  <td className="py-1.5 px-2">{getPositionsList(player)}</td>
                {lineupRoles && <LineupRoleCell role={lineupRoles.get(player.id)} />}
                  {columnSet === "default" && (
                    <>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "G" in stats ? formatCount(stats.G) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "GS" in stats ? formatCount(stats.GS) : <Dash />}
                  </td>
                    </>
                  )}
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : <Dash />}
                  </td>
                  {columnSet === "playoff" ? (
                    <PlayoffPitcherCells meta={playoffMeta?.get(player.id)} />
                  ) : (
                    <>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "K" in stats ? formatCount(stats.K) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "BB" in stats ? formatCount(stats.BB) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "ER" in stats ? formatCount(stats.ER) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "R" in stats ? formatCount(stats.R) : <Dash />}
                  </td>
                    </>
                  )}
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "ERA" in stats ? formatRate(stats.ERA) : <RateDash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "WHIP" in stats ? formatRate(stats.WHIP) : <RateDash />}
                  </td>
                </tr>
              );
            })}

            {/* Total row */}
            <tr className="font-semibold bg-total-row border-t-2 border-border">
              <td className="py-1.5 px-2 sticky-col" style={{ left: 0, width: pw.name, minWidth: pw.name, backgroundColor: "inherit" }}>Total</td>
              <td className="py-1.5 px-2" />
              {lineupRoles && <td className="py-1.5 px-2" />}
              {columnSet === "default" && (
                <>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.G)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.GS)}</td>
                </>
              )}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatIP(teamTotals.IP_outs)}
              </td>
              {columnSet === "playoff" ? (
                <PlayoffPitcherTotalCells metas={players.map((p) => playoffMeta?.get(p.id)).filter((m): m is PlayoffPitcherMeta => m !== undefined)} />
              ) : (
                <>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.K)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.BB)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.ER)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.R)}</td>
                </>
              )}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatRate(teamTotals.ERA)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatRate(teamTotals.WHIP)}
              </td>
            </tr>

            {/* Starters row */}
            {starterTotals && (
              <tr className="font-semibold bg-total-row border-t border-border">
              <td className="py-1.5 px-2 sticky-col" style={{ left: 0, width: pw.name, minWidth: pw.name, backgroundColor: "inherit" }}><StarterTotalsLabel label={starterLabel} /></td>
              <td className="py-1.5 px-2" />
              {lineupRoles && <td className="py-1.5 px-2" />}
              {columnSet === "default" && (
                <>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.G)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.GS)}</td>
                </>
              )}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatIP(starterTotals.IP_outs)}
              </td>
              {columnSet === "playoff" ? (
                <PlayoffPitcherTotalCells metas={players.filter((p) => isStarterForTotals(lineupRoles?.get(p.id))).map((p) => playoffMeta?.get(p.id)).filter((m): m is PlayoffPitcherMeta => m !== undefined)} />
              ) : (
                <>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.K)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.BB)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.ER)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.R)}</td>
                </>
              )}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatRate(starterTotals.ERA)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatRate(starterTotals.WHIP)}
              </td>
            </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  );
}
