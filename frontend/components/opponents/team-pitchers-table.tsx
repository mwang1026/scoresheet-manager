import Link from "next/link";
import { formatRate, formatIP } from "@/lib/stats";
import type { Player } from "@/lib/types";
import type { AggregatedPitcherStats } from "@/lib/stats";

interface TeamPitchersTableProps {
  players: Player[];
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  teamTotals: AggregatedPitcherStats;
}

export function TeamPitchersTable({
  players,
  pitcherStatsMap,
  teamTotals,
}: TeamPitchersTableProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background border-b">
          <tr>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-right tabular-nums">G</th>
            <th className="p-2 text-right tabular-nums">GS</th>
            <th className="p-2 text-right tabular-nums">IP</th>
            <th className="p-2 text-right tabular-nums">K</th>
            <th className="p-2 text-right tabular-nums">BB</th>
            <th className="p-2 text-right tabular-nums">ER</th>
            <th className="p-2 text-right tabular-nums">R</th>
            <th className="p-2 text-right tabular-nums">ERA</th>
            <th className="p-2 text-right tabular-nums">WHIP</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const stats = pitcherStatsMap.get(player.id);
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
                  {stats && "G" in stats ? stats.G : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "GS" in stats ? stats.GS : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "IP_outs" in stats ? formatIP(stats.IP_outs) : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "K" in stats ? stats.K : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "BB" in stats ? stats.BB : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "ER" in stats ? stats.ER : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "R" in stats ? stats.R : "—"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "ERA" in stats ? formatRate(stats.ERA) : "---"}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {stats && "WHIP" in stats ? formatRate(stats.WHIP) : "---"}
                </td>
              </tr>
            );
          })}

          {/* Total row */}
          <tr className="font-semibold bg-muted/30 border-t">
            <td className="p-2">Total</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.G}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.GS}</td>
            <td className="p-2 text-right tabular-nums">
              {formatIP(teamTotals.IP_outs)}
            </td>
            <td className="p-2 text-right tabular-nums">{teamTotals.K}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.BB}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.ER}</td>
            <td className="p-2 text-right tabular-nums">{teamTotals.R}</td>
            <td className="p-2 text-right tabular-nums">
              {formatRate(teamTotals.ERA)}
            </td>
            <td className="p-2 text-right tabular-nums">
              {formatRate(teamTotals.WHIP)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
