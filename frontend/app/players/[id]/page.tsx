"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, ListPlus } from "lucide-react";
import { players, teams, hitterStats, pitcherStats, projections } from "@/lib/fixtures";
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

// Helper to format date range labels
function formatDateRangeLabel(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Custom (${monthNames[startDate.getMonth()]} ${startDate.getDate()} – ${monthNames[endDate.getMonth()]} ${endDate.getDate()})`;
}

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const playerId = Number(params.id);
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } = usePlayerLists();
  const [customStart, setCustomStart] = useState("2025-04-01");
  const [customEnd, setCustomEnd] = useState("2025-09-30");

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

  // Helper function to calculate stats for a date range
  const calculateStats = (range: DateRange) => {
    if (isPitcher) {
      const filtered = filterStatsByDateRange(pitcherStats, range).filter(
        (s) => s.player_id === playerId
      );
      return filtered.length > 0 ? aggregatePitcherStats(filtered) : null;
    } else {
      const filtered = filterStatsByDateRange(hitterStats, range).filter(
        (s) => s.player_id === playerId
      );
      return filtered.length > 0 ? aggregateHitterStats(filtered) : null;
    }
  };

  // Section 1 - Actuals (recent)
  const statsRows = [
    {
      label: formatDateRangeLabel(customStart, customEnd),
      stats: calculateStats({ type: "custom", start: customStart, end: customEnd }),
      section: "actuals"
    },
    { label: "Last 7", stats: calculateStats({ type: "last7" }), section: "actuals" },
    { label: "Last 14", stats: calculateStats({ type: "last14" }), section: "actuals" },
    { label: "Last 30", stats: calculateStats({ type: "last30" }), section: "actuals" },
    { label: "Season", stats: calculateStats({ type: "season", year: 2025 }), section: "actuals" },
  ];

  // Section 2 - Projections
  const playerProjections = projections.filter((p) => p.player_id === playerId);
  type StatsRow = {
    label: string;
    stats: ReturnType<typeof aggregateHitterStats> | ReturnType<typeof aggregatePitcherStats> | null;
    section: string;
  };
  const projectionRows = playerProjections
    .map((proj) => {
      // Cast projection to daily stats format with dummy date
      if (isPitcher && proj.player_type === "pitcher") {
        const projAsDaily = { ...proj, date: "2025-01-01" };
        const stats = aggregatePitcherStats([projAsDaily]);
        return { label: `Proj (${proj.source})`, stats, section: "projections" } as StatsRow;
      } else if (!isPitcher && proj.player_type === "hitter") {
        const projAsDaily = { ...proj, date: "2025-01-01" };
        const stats = aggregateHitterStats([projAsDaily]);
        return { label: `Proj (${proj.source})`, stats, section: "projections" } as StatsRow;
      }
      return null;
    })
    .filter((row): row is StatsRow => row !== null);

  // Section 3 - Historical seasons
  const historicalRows = [
    { label: "2024", stats: calculateStats({ type: "season", year: 2024 }), section: "historical" },
    { label: "2023", stats: calculateStats({ type: "season", year: 2023 }), section: "historical" },
    { label: "2022", stats: calculateStats({ type: "season", year: 2022 }), section: "historical" },
  ];

  // Combine all rows
  const allStatsRows = [...statsRows, ...projectionRows, ...historicalRows];

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
            <h1 className="text-4xl font-bold">{player.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base">
              <span>
                <span className="font-medium">Position:</span> {player.primary_position}
              </span>
              <span>
                <span className="font-medium">Eligible:</span> {eligiblePositions.join(", ")}
              </span>
              <span>
                <span className="font-medium">MLB Team:</span> {player.current_team}
              </span>
              <span>
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

        {/* Custom Date Range Pickers */}
        <div className="mb-4 flex gap-4 items-center text-sm">
          <label className="flex items-center gap-2">
            <span className="font-medium">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 border rounded"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 border rounded"
            />
          </label>
        </div>

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
              {allStatsRows.map(({ label, stats, section }, index) => {
                // Add border between sections
                const prevSection = index > 0 ? allStatsRows[index - 1].section : null;
                const needsSeparator = section !== prevSection;
                const borderClass = needsSeparator ? "border-t-2" : "";

                if (isPitcher) {
                  const pitcherStats = stats as ReturnType<typeof aggregatePitcherStats> | null;
                  return (
                    <tr key={label} className={`even:bg-muted/50 ${borderClass}`}>
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
                    <tr key={label} className={`even:bg-muted/50 ${borderClass}`}>
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
