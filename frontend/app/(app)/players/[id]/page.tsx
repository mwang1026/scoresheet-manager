"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, ListPlus } from "lucide-react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import {
  usePlayers,
  useTeams,
  useHitterStats,
  usePitcherStats,
  useProjections,
} from "@/lib/hooks/use-players-data";
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
import { getSeasonYear, getSeasonStartStr, getSeasonEndStr } from "@/lib/defaults";
import { PROJECTION_SENTINEL_DATE } from "@/lib/constants";

/**
 * Format date range labels for display
 *
 * IMPORTANT: We parse the date string directly (split on '-') instead of
 * using `new Date()` to avoid timezone issues.
 *
 * Example problem:
 * - Date picker value: "2025-04-01" (April 1st)
 * - new Date("2025-04-01") = UTC midnight = March 31st 5pm PST
 * - getMonth() returns 2 (March) instead of 3 (April) ❌
 *
 * Solution: Parse string components directly to get exact calendar date.
 */
function formatDateRangeLabel(start: string, end: string): string {
  // Parse date string directly to avoid timezone issues
  const [, startMonth, startDay] = start.split('-').map(Number);
  const [, endMonth, endDay] = end.split('-').map(Number);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `Custom (${monthNames[startMonth - 1]} ${startDay} – ${monthNames[endMonth - 1]} ${endDay})`;
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const playerId = Number(id);
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } =
    usePlayerLists();
  const seasonYear = getSeasonYear(new Date());
  const [customStart, setCustomStart] = useState(`${seasonYear}-04-01`);
  const [customEnd, setCustomEnd] = useState(`${seasonYear}-09-30`);

  // Fetch data from API
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();

  // Fetch stats spanning current + 3 historical seasons (filter sub-ranges client-side)
  const historicalStart = getSeasonStartStr(seasonYear - 3);
  const currentEnd = getSeasonEndStr(seasonYear);
  const {
    stats: hitterStatsData,
    isLoading: hitterStatsLoading,
    error: hitterStatsError,
  } = useHitterStats({ type: "custom", start: historicalStart, end: currentEnd }, playerId);
  const {
    stats: pitcherStatsData,
    isLoading: pitcherStatsLoading,
    error: pitcherStatsError,
  } = usePitcherStats({ type: "custom", start: historicalStart, end: currentEnd }, playerId);
  const {
    projections: playerProjections,
    isLoading: projectionsLoading,
    error: projectionsError,
  } = useProjections(undefined, playerId);

  const player = players?.find((p) => p.id === playerId);
  const team = player?.team_id ? teams?.find((t) => t.id === player.team_id) : null;

  // Loading state
  const isLoading =
    playersLoading || teamsLoading || hitterStatsLoading || pitcherStatsLoading || projectionsLoading;

  // Error state
  const error = playersError || teamsError || hitterStatsError || pitcherStatsError || projectionsError;

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">Error loading player data: {error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading player...</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Player not found</p>
      </div>
    );
  }

  const isPitcher = isPlayerPitcher(player);
  const eligiblePositions = getEligiblePositions(player);

  // Helper function to calculate stats for a date range
  const calculateStats = (range: DateRange) => {
    if (isPitcher) {
      const allStats = pitcherStatsData || [];
      const filtered = filterStatsByDateRange(allStats, range);
      return filtered.length > 0 ? aggregatePitcherStats(filtered) : null;
    } else {
      const allStats = hitterStatsData || [];
      const filtered = filterStatsByDateRange(allStats, range);
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
    { label: "Season", stats: calculateStats({ type: "season", year: seasonYear }), section: "actuals" },
  ];

  // Section 2 - Projections
  type StatsRow = {
    label: string;
    stats: ReturnType<typeof aggregateHitterStats> | ReturnType<typeof aggregatePitcherStats> | null;
    section: string;
  };
  const projectionRows = (playerProjections || [])
    .map((proj) => {
      // Cast projection to daily stats format with dummy date
      if (isPitcher && proj.player_type === "pitcher") {
        const projAsDaily = { ...proj, date: PROJECTION_SENTINEL_DATE };
        const stats = aggregatePitcherStats([projAsDaily]);
        return { label: `Proj (${proj.source})`, stats, section: "projections" } as StatsRow;
      } else if (!isPitcher && proj.player_type === "hitter") {
        const projAsDaily = { ...proj, date: PROJECTION_SENTINEL_DATE };
        const stats = aggregateHitterStats([projAsDaily]);
        return { label: `Proj (${proj.source})`, stats, section: "projections" } as StatsRow;
      }
      return null;
    })
    .filter((row): row is StatsRow => row !== null);

  // Section 3 - Historical seasons (always 3 years back from current season)
  const historicalRows = [
    { label: `${seasonYear - 1}`, stats: calculateStats({ type: "season", year: seasonYear - 1 }), section: "historical" },
    { label: `${seasonYear - 2}`, stats: calculateStats({ type: "season", year: seasonYear - 2 }), section: "historical" },
    { label: `${seasonYear - 3}`, stats: calculateStats({ type: "season", year: seasonYear - 3 }), section: "historical" },
  ];

  // Combine all rows
  const allStatsRows = [...statsRows, ...projectionRows, ...historicalRows];

  return (
    <div className="p-8 space-y-6">
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
                  <ListPlus className="w-4 h-4 text-brand-blue" />
                  <span className="text-sm">In Queue</span>
                </>
              ) : (
                <>
                  <ListPlus className="w-4 h-4 text-muted-foreground/40" />
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
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted border-b-2 border-border">
              {isPitcher ? (
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold text-foreground">Period</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">G</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">GS</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">IP</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">W-L</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">K</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">ER</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">R</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">BB</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">ERA</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">WHIP</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">K/9</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">SV</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold text-foreground">Period</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">PA</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">AB</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">H</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">HR</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">R</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">RBI</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">SB</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">CS</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">AVG</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">OBP</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">SLG</th>
                  <th className="py-1.5 px-2 text-right tabular-nums font-semibold text-foreground">OPS</th>
                </tr>
              )}
            </thead>
            <tbody>
              {allStatsRows.map(({ label, stats, section }, index) => {
                // Add border between sections
                const prevSection = index > 0 ? allStatsRows[index - 1].section : null;
                const needsSeparator = section !== prevSection;
                const borderClass = needsSeparator ? "border-t-2 border-border" : "";

                if (isPitcher) {
                  const pitcherStats = stats as ReturnType<typeof aggregatePitcherStats> | null;
                  return (
                    <tr key={label} className={`even:bg-muted hover:bg-muted ${borderClass}`}>
                      <td className="py-1.5 px-2 font-medium">{label}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.G : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.GS : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? formatIP(pitcherStats.IP_outs) : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? `${pitcherStats.W}-${pitcherStats.L}` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.K : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.ER : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.R : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.BB : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.ERA) : "---"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.WHIP) : "---"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.K9) : "---"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {pitcherStats ? pitcherStats.SV : "—"}
                      </td>
                    </tr>
                  );
                } else {
                  const hitterStats = stats as ReturnType<typeof aggregateHitterStats> | null;
                  return (
                    <tr key={label} className={`even:bg-muted hover:bg-muted ${borderClass}`}>
                      <td className="py-1.5 px-2 font-medium">{label}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.PA : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.AB : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.H : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.HR : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.R : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.RBI : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.SB : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? hitterStats.CS : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.AVG) : "---"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.OBP) : "---"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.SLG) : "---"}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
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
