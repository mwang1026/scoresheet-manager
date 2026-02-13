"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Star, ListPlus } from "lucide-react";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  filterStatsByDateRange,
  aggregateHitterStats,
  aggregatePitcherStats,
  formatIP,
  formatAvg,
  formatRate,
  isPlayerPitcher,
  getEligiblePositions,
  type DateRange,
} from "@/lib/stats";

const DATE_RANGES: { label: string; range: DateRange }[] = [
  { label: "Season", range: { type: "season", year: 2025 } },
  { label: "Last 30", range: { type: "last30" } },
  { label: "Last 14", range: { type: "last14" } },
  { label: "Last 7", range: { type: "last7" } },
];

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const playerId = Number(params.id);
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } = usePlayerLists();

  const player = players.find((p) => p.id === playerId);
  const team = player?.team_id ? teams.find((t) => t.id === player.team_id) : null;

  if (!player) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Player not found</p>
      </div>
    );
  }

  const isPitcher = isPlayerPitcher(player);
  const eligiblePositions = getEligiblePositions(player);

  // Calculate stats for each date range
  const statsRows = DATE_RANGES.map(({ label, range }) => {
    if (isPitcher) {
      const filtered = filterStatsByDateRange(pitcherStats, range).filter(
        (s) => s.player_id === playerId
      );
      const stats = filtered.length > 0 ? aggregatePitcherStats(filtered) : null;
      return { label, stats };
    } else {
      const filtered = filterStatsByDateRange(hitterStats, range).filter(
        (s) => s.player_id === playerId
      );
      const stats = filtered.length > 0 ? aggregateHitterStats(filtered) : null;
      return { label, stats };
    }
  });

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Players
      </button>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{player.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium">Position:</span> {player.primary_position}
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium">Eligible:</span> {eligiblePositions.join(", ")}
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium">MLB Team:</span> {player.current_team}
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium">Fantasy Team:</span>{" "}
                {team ? team.name : "Available"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleWatchlist(playerId)}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-muted"
            >
              {isHydrated && isWatchlisted(playerId) ? (
                <>
                  <Star className="w-4 h-4 fill-current text-yellow-500" />
                  <span className="text-sm">Watchlisted</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  <span className="text-sm">Add to Watchlist</span>
                </>
              )}
            </button>
            <button
              onClick={() => toggleQueue(playerId)}
              className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-muted"
            >
              {isHydrated && isInQueue(playerId) ? (
                <>
                  <ListPlus className="w-4 h-4 text-primary" />
                  <span className="text-sm">In Queue</span>
                </>
              ) : (
                <>
                  <ListPlus className="w-4 h-4" />
                  <span className="text-sm">Add to Queue</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Stats</h2>
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              {isPitcher ? (
                <tr>
                  <th className="p-3 text-left">Period</th>
                  <th className="p-3 text-right tabular-nums">G</th>
                  <th className="p-3 text-right tabular-nums">GS</th>
                  <th className="p-3 text-right tabular-nums">IP</th>
                  <th className="p-3 text-right tabular-nums">W-L</th>
                  <th className="p-3 text-right tabular-nums">K</th>
                  <th className="p-3 text-right tabular-nums">ER</th>
                  <th className="p-3 text-right tabular-nums">R</th>
                  <th className="p-3 text-right tabular-nums">BB</th>
                  <th className="p-3 text-right tabular-nums">ERA</th>
                  <th className="p-3 text-right tabular-nums">WHIP</th>
                  <th className="p-3 text-right tabular-nums">K/9</th>
                  <th className="p-3 text-right tabular-nums">SV</th>
                </tr>
              ) : (
                <tr>
                  <th className="p-3 text-left">Period</th>
                  <th className="p-3 text-right tabular-nums">PA</th>
                  <th className="p-3 text-right tabular-nums">AB</th>
                  <th className="p-3 text-right tabular-nums">H</th>
                  <th className="p-3 text-right tabular-nums">HR</th>
                  <th className="p-3 text-right tabular-nums">R</th>
                  <th className="p-3 text-right tabular-nums">RBI</th>
                  <th className="p-3 text-right tabular-nums">SB</th>
                  <th className="p-3 text-right tabular-nums">CS</th>
                  <th className="p-3 text-right tabular-nums">AVG</th>
                  <th className="p-3 text-right tabular-nums">OBP</th>
                  <th className="p-3 text-right tabular-nums">SLG</th>
                  <th className="p-3 text-right tabular-nums">OPS</th>
                </tr>
              )}
            </thead>
            <tbody>
              {statsRows.map(({ label, stats }) => {
                if (isPitcher) {
                  const pitcherStats = stats as ReturnType<typeof aggregatePitcherStats> | null;
                  return (
                    <tr key={label} className="even:bg-muted/50">
                      <td className="p-3 font-medium">{label}</td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.G : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.GS : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? formatIP(pitcherStats.IP_outs) : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? `${pitcherStats.W}-${pitcherStats.L}` : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.K : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.ER : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.R : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.BB : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.ERA) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.WHIP) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.K9) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.SV : "—"}
                      </td>
                    </tr>
                  );
                } else {
                  const hitterStats = stats as ReturnType<typeof aggregateHitterStats> | null;
                  return (
                    <tr key={label} className="even:bg-muted/50">
                      <td className="p-3 font-medium">{label}</td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.PA : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.AB : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.H : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.HR : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.R : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.RBI : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.SB : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? hitterStats.CS : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.AVG) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.OBP) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.SLG) : "---"}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.OPS) : "---"}
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
