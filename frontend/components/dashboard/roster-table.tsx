import Link from "next/link";
import { formatAvg, formatRate, formatIP, isPlayerPitcher } from "@/lib/stats";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface RosterTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
}

export function RosterTable({ players, hitterStatsMap, pitcherStatsMap }: RosterTableProps) {
  // Split into hitters and pitchers
  const hitters = players.filter((p) => !isPlayerPitcher(p));
  const pitchers = players.filter((p) => isPlayerPitcher(p));

  return (
    <div className="border rounded-lg">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">My Roster ({players.length})</h2>
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
            {/* Hitters */}
            {hitters.map((player) => {
              const stats = hitterStatsMap.get(player.id);
              return (
                <tr key={player.id} className="even:bg-muted/50 hover:bg-muted">
                  <td className="p-3 font-medium">
                    <Link href={`/players/${player.id}`} className="text-primary hover:underline">
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

            {/* Separator between hitters and pitchers */}
            {hitters.length > 0 && pitchers.length > 0 && (
              <tr>
                <td colSpan={8} className="border-t-2" />
              </tr>
            )}

            {/* Pitchers - different header row */}
            {pitchers.length > 0 && (
              <>
                <tr className="bg-muted/30">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Pos</th>
                  <th className="p-3 text-left">Team</th>
                  <th className="p-3 text-right tabular-nums">IP</th>
                  <th className="p-3 text-right tabular-nums">W-L</th>
                  <th className="p-3 text-right tabular-nums">ERA</th>
                  <th className="p-3 text-right tabular-nums">K</th>
                  <th className="p-3 text-right tabular-nums">WHIP</th>
                </tr>
                {pitchers.map((player) => {
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
                        {stats && "W" in stats && "L" in stats ? `${stats.W}-${stats.L}` : "—"}
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
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
