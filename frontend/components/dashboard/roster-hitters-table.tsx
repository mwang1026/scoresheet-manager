import Link from "next/link";
import { formatAvg } from "@/lib/stats";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats } from "@/lib/stats";

interface RosterHittersTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  teamTotals: AggregatedHitterStats;
}

export function RosterHittersTable({
  players,
  hitterStatsMap,
  teamTotals,
}: RosterHittersTableProps) {
  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">My Hitters ({players.length})</h2>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Pos</th>
              <th className="p-3 text-left">Team</th>
              <th className="p-3 text-right tabular-nums">PA</th>
              <th className="p-3 text-right tabular-nums">AVG</th>
              <th className="p-3 text-right tabular-nums">HR</th>
              <th className="p-3 text-right tabular-nums">RBI</th>
              <th className="p-3 text-right tabular-nums">OPS</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const stats = hitterStatsMap.get(player.id);
              return (
                <tr key={player.id} className="even:bg-muted/50 hover:bg-muted">
                  <td className="p-3 font-medium">
                    <Link
                      href={`/players/${player.id}`}
                      className="text-primary hover:underline"
                    >
                      {player.name}
                    </Link>
                  </td>
                  <td className="p-3">{player.primary_position}</td>
                  <td className="p-3">{player.current_team}</td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "PA" in stats ? stats.PA : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "AVG" in stats ? formatAvg(stats.AVG) : "---"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "HR" in stats ? stats.HR : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "RBI" in stats ? stats.RBI : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "OPS" in stats ? formatAvg(stats.OPS) : "---"}
                  </td>
                </tr>
              );
            })}

            {/* Total row */}
            <tr className="font-semibold bg-muted/30 border-t">
              <td className="p-3">Total</td>
              <td className="p-3" colSpan={2}></td>
              <td className="p-3 text-right tabular-nums">{teamTotals.PA}</td>
              <td className="p-3 text-right tabular-nums">
                {formatAvg(teamTotals.AVG)}
              </td>
              <td className="p-3 text-right tabular-nums">{teamTotals.HR}</td>
              <td className="p-3 text-right tabular-nums">{teamTotals.RBI}</td>
              <td className="p-3 text-right tabular-nums">
                {formatAvg(teamTotals.OPS)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
