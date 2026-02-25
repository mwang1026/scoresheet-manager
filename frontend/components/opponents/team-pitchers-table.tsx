"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatRate, formatIP } from "@/lib/stats";
import { DEFAULT_PITCHER_SORT } from "@/lib/defaults";
import type { Player } from "@/lib/types";
import type { AggregatedPitcherStats } from "@/lib/stats";
import { type CompactPitcherSortColumn as PitcherSortColumn } from "@/lib/sort-columns";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { SortIndicator } from "@/components/ui/sort-indicator";

interface TeamPitchersTableProps {
  players: Player[];
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  teamTotals: AggregatedPitcherStats;
  defaultSort?: { column: string; direction: "asc" | "desc" };
}

export function TeamPitchersTable({
  players,
  pitcherStatsMap,
  teamTotals,
  defaultSort,
}: TeamPitchersTableProps) {
  const { sortColumn, sortDirection, handleSort } = useTableSort<PitcherSortColumn>(
    (defaultSort?.column as PitcherSortColumn) ?? (DEFAULT_PITCHER_SORT.column as PitcherSortColumn),
    defaultSort?.direction ?? DEFAULT_PITCHER_SORT.direction,
    "asc"
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (sortColumn === "Name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDirection === "asc" ? cmp : -cmp;
      }
      const aStats = pitcherStatsMap.get(a.id);
      const bStats = pitcherStatsMap.get(b.id);
      const key = sortColumn as keyof AggregatedPitcherStats;
      const aVal: number | null = aStats ? (aStats[key] as number) : null;
      const bVal: number | null = bStats ? (bStats[key] as number) : null;
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      const cmp = aVal - bVal;
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [players, pitcherStatsMap, sortColumn, sortDirection]);

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap";
  const thStat = `${thBase} text-right tabular-nums cursor-pointer select-none`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs table-fixed">
        <thead className="sticky top-0 bg-muted border-b-2 border-border">
          <tr>
            <th className={`${thBase} text-left cursor-pointer select-none`} onClick={() => handleSort("Name")}>
              Name <SortIndicator active={sortColumn === "Name"} direction={sortDirection} />
            </th>
            <th className={`${thBase} text-left w-12`}>Pos</th>
            <th className={`${thStat} w-10`} onClick={() => handleSort("G")}>
              G <SortIndicator active={sortColumn === "G"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-10`} onClick={() => handleSort("GS")}>
              GS <SortIndicator active={sortColumn === "GS"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-14`} onClick={() => handleSort("IP_outs")}>
              IP <SortIndicator active={sortColumn === "IP_outs"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-10`} onClick={() => handleSort("K")}>
              K <SortIndicator active={sortColumn === "K"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-10`} onClick={() => handleSort("BB")}>
              BB <SortIndicator active={sortColumn === "BB"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-10`} onClick={() => handleSort("ER")}>
              ER <SortIndicator active={sortColumn === "ER"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-10`} onClick={() => handleSort("R")}>
              R <SortIndicator active={sortColumn === "R"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-12`} onClick={() => handleSort("ERA")}>
              ERA <SortIndicator active={sortColumn === "ERA"} direction={sortDirection} />
            </th>
            <th className={`${thStat} w-14`} onClick={() => handleSort("WHIP")}>
              WHIP <SortIndicator active={sortColumn === "WHIP"} direction={sortDirection} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => {
            const stats = pitcherStatsMap.get(player.id);
            return (
              <tr key={player.id} className="even:bg-muted hover:bg-muted">
                <td className="py-1.5 px-2 font-medium min-w-0 break-words">
                  <Link
                    href={`/players/${player.id}`}
                    className="text-primary hover:underline"
                  >
                    {player.name}
                  </Link>
                </td>
                <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                  {player.primary_position}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "G" in stats ? stats.G : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "GS" in stats ? stats.GS : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "K" in stats ? stats.K : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "BB" in stats ? stats.BB : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "ER" in stats ? stats.ER : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "R" in stats ? stats.R : "—"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                  {stats && "WHIP" in stats ? formatRate(stats.WHIP) : "---"}
                </td>
              </tr>
            );
          })}

          {/* Total row */}
          <tr className="font-semibold bg-slate-200 border-t-2 border-border">
            <td className="py-1.5 px-2">Total</td>
            <td className="py-1.5 px-2" />
            <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.G}</td>
            <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.GS}</td>
            <td className="py-1.5 px-2 text-right tabular-nums">
              {formatIP(teamTotals.IP_outs)}
            </td>
            <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.K}</td>
            <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.BB}</td>
            <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.ER}</td>
            <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.R}</td>
            <td className="py-1.5 px-2 text-right tabular-nums">
              {formatRate(teamTotals.ERA)}
            </td>
            <td className="py-1.5 px-2 text-right tabular-nums">
              {formatRate(teamTotals.WHIP)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
