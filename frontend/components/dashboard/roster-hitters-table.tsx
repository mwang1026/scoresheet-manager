"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatAvg, getPositionsList } from "@/lib/stats";
import { DEFAULT_HITTER_SORT } from "@/lib/defaults";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats } from "@/lib/stats";
import { type CompactHitterSortColumn as HitterSortColumn } from "@/lib/sort-columns";
import { useTableSort } from "@/lib/hooks/use-table-sort";
import { SortIndicator } from "@/components/ui/sort-indicator";

interface RosterHittersTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  teamTotals: AggregatedHitterStats;
  defaultSort?: { column: string; direction: "asc" | "desc" };
}

export function RosterHittersTable({
  players,
  hitterStatsMap,
  teamTotals,
  defaultSort,
}: RosterHittersTableProps) {
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

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap";
  const thStat = `${thBase} text-right tabular-nums cursor-pointer select-none`;

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b bg-brand text-white rounded-t-lg">
        <h2 className="text-lg font-semibold">My Hitters ({players.length})</h2>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted border-b-2 border-border">
            <tr>
              <th
                className={`${thBase} text-left cursor-pointer select-none`}
                onClick={() => handleSort("Name")}
              >
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
          <tbody>
            {sortedPlayers.map((player) => {
              const stats = hitterStatsMap.get(player.id);
              return (
                <tr key={player.id} className="even:bg-muted hover:bg-muted">
                  <td className="py-1.5 px-2 font-medium">
                    <Link
                      href={`/players/${player.id}`}
                      className="text-primary hover:underline"
                    >
                      {player.name}
                    </Link>
                  </td>
                  <td className="py-1.5 px-2">{getPositionsList(player)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    {stats && "PA" in stats ? stats.PA : "—"}
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

            {/* Total row */}
            <tr className="font-semibold bg-slate-200 border-t-2 border-border">
              <td className="py-1.5 px-2">Total</td>
              <td className="py-1.5 px-2" />
              <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.PA}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.R}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.RBI}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.HR}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{teamTotals.SB}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {formatAvg(teamTotals.AVG)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {formatAvg(teamTotals.OBP)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {formatAvg(teamTotals.SLG)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {formatAvg(teamTotals.OPS)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
