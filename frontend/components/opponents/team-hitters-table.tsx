"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatAvg, getPositionsList } from "@/lib/stats";
import { DEFAULT_HITTER_SORT } from "@/lib/defaults";
import { PIN_WIDTHS, getPinWidths } from "@/lib/table-helpers";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats } from "@/lib/stats";
import { type CompactHitterSortColumn as HitterSortColumn } from "@/lib/sort-columns";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { SortIndicator } from "@/components/ui/sort-indicator";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";

interface TeamHittersTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  teamTotals: AggregatedHitterStats;
  defaultSort?: { column: string; direction: "asc" | "desc" };
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
}

export function TeamHittersTable({
  players,
  hitterStatsMap,
  teamTotals,
  defaultSort,
  getNote,
  saveNote,
  newsPlayerIds,
}: TeamHittersTableProps) {
  const isMobile = useIsMobile();
  const pw = getPinWidths(isMobile);
  const { sortColumn, sortDirection, handleSort } = useTableSort<HitterSortColumn>(
    (defaultSort?.column as HitterSortColumn) ?? (DEFAULT_HITTER_SORT.column as HitterSortColumn),
    defaultSort?.direction ?? DEFAULT_HITTER_SORT.direction,
    "desc"
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (sortColumn === "Name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDirection === "asc" ? cmp : -cmp;
      }
      const aStats = hitterStatsMap.get(a.id);
      const bStats = hitterStatsMap.get(b.id);
      const aVal = aStats ? (aStats[sortColumn as keyof AggregatedHitterStats] as number) : null;
      const bVal = bStats ? (bStats[sortColumn as keyof AggregatedHitterStats] as number) : null;
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal - bVal;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [players, hitterStatsMap, sortColumn, sortDirection]);

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap sticky-header-cell";
  const thStat = `${thBase} text-right font-mono tabular-nums cursor-pointer select-none`;

  return (
    <div className="overflow-x-scroll overflow-y-auto md:max-h-[75vh] scroll-hint">
      <table className="min-w-full text-xs whitespace-nowrap">
        <thead className="bg-muted border-b-2 border-border">
          <tr>
            <th className={`${thBase} text-left cursor-pointer select-none sticky-col-header sticky-col-divider`} style={{ left: 0, width: pw.name, minWidth: pw.name }} onClick={() => handleSort("Name")}>
              Name <SortIndicator active={sortColumn === "Name"} direction={sortDirection} />
            </th>
            <th className={`${thBase} text-left`}>Pos</th>
            <th className={thStat} onClick={() => handleSort("PA")}>
              PA <SortIndicator active={sortColumn === "PA"} direction={sortDirection} />
            </th>
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
              <tr key={player.id} className="odd:bg-background even:bg-muted hover:bg-row-hover transition-colors duration-100">
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
                <td className="py-1.5 px-2 text-muted-foreground">
                  {getPositionsList(player)}
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

          {/* Total row */}
          <tr className="font-semibold bg-total-row border-t-2 border-border">
            <td className="py-1.5 px-2 sticky-col" style={{ left: 0, width: pw.name, minWidth: pw.name, backgroundColor: "inherit" }}>Total</td>
            <td className="py-1.5 px-2" />
            <td className="py-1.5 px-2 text-right font-mono tabular-nums">{teamTotals.PA}</td>
            <td className="py-1.5 px-2 text-right font-mono tabular-nums">{teamTotals.R}</td>
            <td className="py-1.5 px-2 text-right font-mono tabular-nums">{teamTotals.RBI}</td>
            <td className="py-1.5 px-2 text-right font-mono tabular-nums">{teamTotals.HR}</td>
            <td className="py-1.5 px-2 text-right font-mono tabular-nums">{teamTotals.SB}</td>
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
        </tbody>
      </table>
    </div>
  );
}
