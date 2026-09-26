"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatAvg, formatCount, getPositionsList } from "@/lib/stats";
import { DEFAULT_HITTER_SORT } from "@/lib/defaults";
import { PIN_WIDTHS, getPinWidths } from "@/lib/table-helpers";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats, PlayoffHitterMeta } from "@/lib/stats";
import { type CompactHitterSortColumn as HitterSortColumn, isPlayoffHitterSortColumn } from "@/lib/sort-columns";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";
import {
  PlayoffHitterCells,
  PlayoffHitterHeaderCells,
  PlayoffHitterTotalCells,
  playoffHitterSortValue,
  playoffRowClass,
  type TableColumnSet,
} from "@/components/ui/playoff-cells";
import { isStartingHitter as isStarterForTotals, lineupSortKey, type LineupRoleMap } from "@/lib/lineups";
import { LineupRoleCell, StarterTotalsLabel } from "@/components/ui/lineup-cells";
import { SectionPanel } from "@/components/ui/section-panel";

interface RosterHittersTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  teamTotals: AggregatedHitterStats;
  defaultSort?: { column: string; direction: "asc" | "desc" };
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
  /** "playoff" swaps R/RBI/HR/SB for playing-time columns and mutes ineligible rows. */
  columnSet?: TableColumnSet;
  playoffMeta?: Map<number, PlayoffHitterMeta>;
  /** When given, adds a sortable Lineup column (batting slot / rotation / bench). */
  lineupRoles?: LineupRoleMap;
  /** When given, adds a second totals row over lineup starters only. */
  starterTotals?: AggregatedHitterStats;
  starterLabel?: string;
}

export function RosterHittersTable({
  players,
  hitterStatsMap,
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
}: RosterHittersTableProps) {
  const isMobile = useIsMobile();
  const pw = getPinWidths(isMobile);
  const { sortColumn, sortDirection, handleSort } = useTableSort<HitterSortColumn>(
    (defaultSort?.column as HitterSortColumn) ?? (DEFAULT_HITTER_SORT.column as HitterSortColumn),
    defaultSort?.direction ?? DEFAULT_HITTER_SORT.direction,
    "desc",
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
      if (isPlayoffHitterSortColumn(sortColumn)) {
        aVal = playoffHitterSortValue(playoffMeta?.get(a.id), sortColumn);
        bVal = playoffHitterSortValue(playoffMeta?.get(b.id), sortColumn);
      } else {
        const aStats = hitterStatsMap.get(a.id);
        const bStats = hitterStatsMap.get(b.id);
        aVal = aStats ? (aStats[sortColumn as keyof AggregatedHitterStats] as number) : null;
        bVal = bStats ? (bStats[sortColumn as keyof AggregatedHitterStats] as number) : null;
      }
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal - bVal;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [players, hitterStatsMap, playoffMeta, lineupRoles, sortColumn, sortDirection]);

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap sticky-header-cell";
  const thStat = `${thBase} text-right font-mono tabular-nums cursor-pointer select-none`;

  return (
    <SectionPanel title="My Hitters" badge={`${players.length}`}>
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
              <th className={thStat} onClick={() => handleSort("PA")}>
                PA <SortIndicator active={sortColumn === "PA"} direction={sortDirection} />
              </th>
              {columnSet === "playoff" ? (
                <PlayoffHitterHeaderCells thStat={thStat} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
              ) : (
                <>
              <th className={thStat} onClick={() => handleSort("R")}>
                R <SortIndicator active={sortColumn === "R"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("RBI")}>
                RBI <SortIndicator active={sortColumn === "RBI"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("HR")}>
                HR <SortIndicator active={sortColumn === "HR"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("SB")}>
                SB <SortIndicator active={sortColumn === "SB"} direction={sortDirection} />
              </th>
                </>
              )}
              <th className={thStat} onClick={() => handleSort("AVG")}>
                AVG <SortIndicator active={sortColumn === "AVG"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("OBP")}>
                OBP <SortIndicator active={sortColumn === "OBP"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("SLG")}>
                SLG <SortIndicator active={sortColumn === "SLG"} direction={sortDirection} />
              </th>
              <th className={thStat} onClick={() => handleSort("OPS")}>
                OPS <SortIndicator active={sortColumn === "OPS"} direction={sortDirection} />
              </th>
            </tr>
          </thead>
          <tbody key={`${sortColumn}-${sortDirection}`} className="animate-fade-in">
            {sortedPlayers.map((player) => {
              const stats = hitterStatsMap.get(player.id);
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
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "PA" in stats ? formatCount(stats.PA) : <Dash />}
                  </td>
                  {columnSet === "playoff" ? (
                    <PlayoffHitterCells meta={playoffMeta?.get(player.id)} />
                  ) : (
                    <>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "R" in stats ? formatCount(stats.R) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "RBI" in stats ? formatCount(stats.RBI) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "HR" in stats ? formatCount(stats.HR) : <Dash />}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                    {stats && "SB" in stats ? formatCount(stats.SB) : <Dash />}
                  </td>
                    </>
                  )}
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

            {/* Total row */}
            <tr className="font-semibold bg-total-row border-t-2 border-border">
              <td className="py-1.5 px-2 sticky-col" style={{ left: 0, width: pw.name, minWidth: pw.name, backgroundColor: "inherit" }}>Total</td>
              <td className="py-1.5 px-2" />
              {lineupRoles && <td className="py-1.5 px-2" />}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.PA)}</td>
              {columnSet === "playoff" ? (
                <PlayoffHitterTotalCells metas={players.map((p) => playoffMeta?.get(p.id)).filter((m): m is PlayoffHitterMeta => m !== undefined)} />
              ) : (
                <>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.R)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.RBI)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.HR)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(teamTotals.SB)}</td>
                </>
              )}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(teamTotals.AVG)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(teamTotals.OBP)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(teamTotals.SLG)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(teamTotals.OPS)}
              </td>
            </tr>

            {/* Starters row */}
            {starterTotals && (
              <tr className="font-semibold bg-total-row border-t border-border">
              <td className="py-1.5 px-2 sticky-col" style={{ left: 0, width: pw.name, minWidth: pw.name, backgroundColor: "inherit" }}><StarterTotalsLabel label={starterLabel} /></td>
              <td className="py-1.5 px-2" />
              {lineupRoles && <td className="py-1.5 px-2" />}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.PA)}</td>
              {columnSet === "playoff" ? (
                <PlayoffHitterTotalCells metas={players.filter((p) => isStarterForTotals(lineupRoles?.get(p.id))).map((p) => playoffMeta?.get(p.id)).filter((m): m is PlayoffHitterMeta => m !== undefined)} />
              ) : (
                <>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.R)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.RBI)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.HR)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatCount(starterTotals.SB)}</td>
                </>
              )}
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(starterTotals.AVG)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(starterTotals.OBP)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(starterTotals.SLG)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                {formatAvg(starterTotals.OPS)}
              </td>
            </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionPanel>
  );
}
