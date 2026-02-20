import Link from "next/link";
import { formatRate, formatIP } from "@/lib/stats";
import type { Player } from "@/lib/types";
import type { AggregatedPitcherStats } from "@/lib/stats";

interface RosterPitchersTableProps {
  players: Player[];
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  teamTotals: AggregatedPitcherStats;
}

export function RosterPitchersTable({
  players,
  pitcherStatsMap,
  teamTotals,
}: RosterPitchersTableProps) {
  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">My Pitchers ({players.length})</h2>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Pos</th>
              <th className="p-3 text-left">Team</th>
              <th className="p-3 text-right tabular-nums">IP</th>
              <th className="p-3 text-right tabular-nums">W-L</th>
              <th className="p-3 text-right tabular-nums">ERA</th>
              <th className="p-3 text-right tabular-nums">K</th>
              <th className="p-3 text-right tabular-nums">WHIP</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const stats = pitcherStatsMap.get(player.id);
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
                    {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "W" in stats && "L" in stats
                      ? `${stats.W}-${stats.L}`
                      : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "K" in stats ? stats.K : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {stats && "WHIP" in stats ? formatRate(stats.WHIP) : "---"}
                  </td>
                </tr>
              );
            })}

            {/* Total row */}
            <tr className="font-semibold bg-muted/30 border-t">
              <td className="p-3">Total</td>
              <td className="p-3" colSpan={2}></td>
              <td className="p-3 text-right tabular-nums">
                {formatIP(teamTotals.IP_outs)}
              </td>
              <td className="p-3 text-right tabular-nums">
                {teamTotals.W}-{teamTotals.L}
              </td>
              <td className="p-3 text-right tabular-nums">
                {formatRate(teamTotals.ERA)}
              </td>
              <td className="p-3 text-right tabular-nums">{teamTotals.K}</td>
              <td className="p-3 text-right tabular-nums">
                {formatRate(teamTotals.WHIP)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
