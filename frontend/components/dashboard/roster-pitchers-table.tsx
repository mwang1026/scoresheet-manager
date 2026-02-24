"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";
import { formatRate, formatIP } from "@/lib/stats";
import type { Player } from "@/lib/types";
import type { AggregatedPitcherStats } from "@/lib/stats";

interface RosterPitchersTableProps {
  players: Player[];
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  teamTotals: AggregatedPitcherStats;
}

type PitcherSortColumn = "Name" | "G" | "GS" | "IP" | "K" | "BB" | "ER" | "R" | "ERA" | "WHIP";

export function RosterPitchersTable({
  players,
  pitcherStatsMap,
  teamTotals,
}: RosterPitchersTableProps) {
  const [sortColumn, setSortColumn] = useState<PitcherSortColumn>("ERA");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: PitcherSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIndicator = ({ column }: { column: PitcherSortColumn }) => {
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
      const aStats = pitcherStatsMap.get(a.id);
      const bStats = pitcherStatsMap.get(b.id);
      let aVal: number | null = null;
      let bVal: number | null = null;
      if (sortColumn === "IP") {
        aVal = aStats ? aStats.IP_outs : null;
        bVal = bStats ? bStats.IP_outs : null;
      } else {
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
  }, [players, pitcherStatsMap, sortColumn, sortDirection]);

  const thBase = "py-1.5 px-2 font-semibold text-foreground whitespace-nowrap";
  const thStat = `${thBase} text-right tabular-nums cursor-pointer select-none`;

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">My Pitchers ({players.length})</h2>
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
              <th className={thStat} onClick={() => handleSort("G")}>
                G <SortIndicator column="G" />
              </th>
              <th className={thStat} onClick={() => handleSort("GS")}>
                GS <SortIndicator column="GS" />
              </th>
              <th className={thStat} onClick={() => handleSort("IP")}>
                IP <SortIndicator column="IP" />
              </th>
              <th className={thStat} onClick={() => handleSort("K")}>
                K <SortIndicator column="K" />
              </th>
              <th className={thStat} onClick={() => handleSort("BB")}>
                BB <SortIndicator column="BB" />
              </th>
              <th className={thStat} onClick={() => handleSort("ER")}>
                ER <SortIndicator column="ER" />
              </th>
              <th className={thStat} onClick={() => handleSort("R")}>
                R <SortIndicator column="R" />
              </th>
              <th className={thStat} onClick={() => handleSort("ERA")}>
                ERA <SortIndicator column="ERA" />
              </th>
              <th className={thStat} onClick={() => handleSort("WHIP")}>
                WHIP <SortIndicator column="WHIP" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player) => {
              const stats = pitcherStatsMap.get(player.id);
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
                  <td className="py-1.5 px-2">{player.primary_position}</td>
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
    </div>
  );
}
