import Link from "next/link";
import { formatAvg } from "@/lib/stats";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats } from "@/lib/stats";

interface TeamHittersTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  teamTotals: AggregatedHitterStats;
}

export function TeamHittersTable({
  players,
  hitterStatsMap,
  teamTotals,
}: TeamHittersTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background border-b">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-right tabular-nums">R</th>
            <th className="p-2 text-right tabular-nums">RBI</th>
            <th className="p-2 text-right tabular-nums">HR</th>
            <th className="p-2 text-right tabular-nums">SB</th>
            <th className="p-2 text-right tabular-nums">AVG</th>
            <th className="p-2 text-right tabular-nums">OBP</th>
            <th className="p-2 text-right tabular-nums">SLG</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const stats = hitterStatsMap.get(player.id);
            return (
              <tr key={player.id} className="even:bg-muted/50 hover:bg-muted">
                <td className="p-2 font-medium">
                  <Link
                    href={`/players/${player.id}`}
                    className="text-primary hover:underline"
                  >
                    {player.name}
                  </Link>
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "R" in stats ? stats.R : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "RBI" in stats ? stats.RBI : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "HR" in stats ? stats.HR : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "SB" in stats ? stats.SB : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "AVG" in stats ? formatAvg(stats.AVG) : "---"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "OBP" in stats ? formatAvg(stats.OBP) : "---"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "SLG" in stats ? formatAvg(stats.SLG) : "---"}
                </td>
              </tr>
            );
          })}

          {/* Total row */}
          <tr className="font-semibold bg-muted/30 border-t">
            <td className="p-2">Total</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.R}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.RBI}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.HR}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.SB}</td>
            <td className="p-2 text-right tabular-nums">
              {formatAvg(teamTotals.AVG)}
            </td>
            <td className="p-2 text-right tabular-nums">
              {formatAvg(teamTotals.OBP)}
            </td>
            <td className="p-2 text-right tabular-nums">
              {formatAvg(teamTotals.SLG)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
