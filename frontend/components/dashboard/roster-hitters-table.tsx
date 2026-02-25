"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";
import { formatAvg, getPositionsList } from "@/lib/stats";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats } from "@/lib/stats";

interface RosterHittersTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  teamTotals: AggregatedHitterStats;
  defaultSort?: { column: string; direction: "asc" | "desc" };
}

type HitterSortColumn = "Name" | "R" | "RBI" | "HR" | "SB" | "AVG" | "OBP" | "SLG" | "OPS";

export function RosterHittersTable({
  players,
  hitterStatsMap,
  teamTotals,
  defaultSort,
}: RosterHittersTableProps) {
  const [sortColumn, setSortColumn] = useState<HitterSortColumn>(
    (defaultSort?.column as HitterSortColumn) ?? "OPS"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    defaultSort?.direction ?? "desc"
  );

  const handleSort = (column: HitterSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIndicator = ({ column }: { column: HitterSortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline w-3 h-3" />
    ) : (
      <ChevronDown className="inline w-3 h-3" />
    );
  };

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
                Name <SortIndicator column="Name" />
              </th>
              <th className={`${thBase} text-left`}>Pos</th>
              <th className={thStat} onClick={() => handleSort("R")}>
                R <SortIndicator column="R" />
              </th>
              <th className={thStat} onClick={() => handleSort("RBI")}>
                RBI <SortIndicator column="RBI" />
              </th>
              <th className={thStat} onClick={() => handleSort("HR")}>
                HR <SortIndicator column="HR" />
              </th>
              <th className={thStat} onClick={() => handleSort("SB")}>
                SB <SortIndicator column="SB" />
              </th>
              <th className={thStat} onClick={() => handleSort("AVG")}>
                AVG <SortIndicator column="AVG" />
              </th>
              <th className={thStat} onClick={() => handleSort("OBP")}>
                OBP <SortIndicator column="OBP" />
              </th>
              <th className={thStat} onClick={() => handleSort("SLG")}>
                SLG <SortIndicator column="SLG" />
              </th>
              <th className={thStat} onClick={() => handleSort("OPS")}>
                OPS <SortIndicator column="OPS" />
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
