"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, ListPlus } from "lucide-react";
import { usePlayerLists } from "@/lib/hooks/use-player-lists";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import { Button } from "@/components/ui/button";
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
  calculatePlatoonOPS,
  formatIP,
  formatAvg,
  formatRate,
  isPlayerPitcher,
  getEligiblePositions,
  type DateRange,
} from "@/lib/stats";
import { getSeasonYear, getSeasonStartStr, getSeasonEndStr } from "@/lib/defaults";
import { PROJECTION_SENTINEL_DATE } from "@/lib/constants";
import { PlayerNewsSection } from "@/components/players/player-news-section";
import { formatILDate } from "@/components/ui/il-icon";
import { Dash, RateDash } from "@/components/ui/stat-placeholder";
import { FormInput } from "@/components/ui/form-input";
import { Skeleton } from "@/components/ui/skeleton";

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

function PlayerNoteBox({
  playerId,
  getNote,
  saveNote,
}: {
  playerId: number;
  getNote: (id: number) => string;
  saveNote: (id: number, content: string) => void;
}) {
  const storedNote = getNote(playerId);
  const [localContent, setLocalContent] = useState(storedNote);
  const isDirty = localContent !== storedNote;

  // Sync local state when stored note changes (e.g., after save completes)
  useEffect(() => {
    setLocalContent(storedNote);
  }, [storedNote]);

  const handleSave = () => {
    saveNote(playerId, localContent);
  };

  return (
    <div className="flex-none w-full md:w-72">
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        rows={4}
        placeholder="Add a note..."
        value={localContent}
        onChange={(e) => setLocalContent(e.target.value)}
      />
      <div className="mt-1.5 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!isDirty}>
          Save Note
        </Button>
      </div>
    </div>
  );
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const playerId = Number(id);
  const { isWatchlisted, isInQueue, toggleWatchlist, toggleQueue, isHydrated } =
    usePlayerLists();
  const { getNote, saveNote } = usePlayerNotes();
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
      <div className="px-3 py-6 sm:px-6 lg:px-8">
        <p className="text-destructive">Error loading player data: {error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="px-3 py-6 sm:px-6 lg:px-8">
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
    <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-6">
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
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{player.name}</h1>
              <button
                onClick={() => toggleWatchlist(playerId)}
                className="p-1.5 border rounded hover:bg-muted"
                aria-label={isHydrated && isWatchlisted(playerId) ? "Remove from watchlist" : "Add to watchlist"}
              >
                {isHydrated && isWatchlisted(playerId) ? (
                  <Star className="w-4 h-4 fill-current text-brand" />
                ) : (
                  <Star className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => toggleQueue(playerId)}
                className="p-1.5 border rounded hover:bg-muted"
                aria-label={isHydrated && isInQueue(playerId) ? "Remove from queue" : "Add to queue"}
              >
                {isHydrated && isInQueue(playerId) ? (
                  <ListPlus className="w-4 h-4 text-brand" />
                ) : (
                  <ListPlus className="w-4 h-4 text-muted-foreground/40" />
                )}
              </button>
            </div>
            {player.il_type && (
              <div className="mt-1 text-sm text-destructive font-medium">
                {player.il_type}{player.il_date && ` \u00b7 since ${formatILDate(player.il_date)}`}
              </div>
            )}
            <div className="mt-2 flex flex-col gap-y-0.5 text-base">
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
              <span>
                <span className="font-medium">{isPitcher ? "Throws:" : "Bats:"}</span>{" "}
                {player.hand ?? "—"}
              </span>
            </div>
          </div>

          {/* Notes box */}
          <PlayerNoteBox playerId={playerId} getNote={getNote} saveNote={saveNote} />
        </div>
      </div>

      {/* Stats Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Stats</h2>

        {/* Custom Date Range Pickers */}
        <div className="mb-4 flex gap-4 items-center text-sm">
          <label className="flex items-center gap-2">
            <span className="font-medium">From:</span>
            <FormInput
              type="date"
              inputSize="sm"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="font-medium">To:</span>
            <FormInput
              type="date"
              inputSize="sm"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
        </div>

        <div className="overflow-auto border rounded">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted border-b-2 border-border">
              {isPitcher ? (
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold text-foreground">Period</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">G</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">GS</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">IP</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">W-L</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">K</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">ER</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">R</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">BB</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">ERA</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">WHIP</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">K/9</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">SV</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold text-foreground">Period</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">PA</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">AB</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">H</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">HR</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">R</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">RBI</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">SB</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">CS</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">AVG</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">OBP</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">SLG</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">OPS</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">vR</th>
                  <th className="py-1.5 px-2 text-right font-mono tabular-nums font-semibold text-foreground">vL</th>
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
                    <tr key={label} className={`even:bg-muted hover:bg-row-hover transition-colors duration-100 ${borderClass}`}>
                      <td className="py-1.5 px-2 font-medium">{label}</td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.G : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.GS : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? formatIP(pitcherStats.IP_outs) : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? `${pitcherStats.W}-${pitcherStats.L}` : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.K : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.ER : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.R : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.BB : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.ERA) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.WHIP) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? formatRate(pitcherStats.K9) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {pitcherStats ? pitcherStats.SV : <Dash />}
                      </td>
                    </tr>
                  );
                } else {
                  const hitterStats = stats as ReturnType<typeof aggregateHitterStats> | null;
                  return (
                    <tr key={label} className={`even:bg-muted hover:bg-row-hover transition-colors duration-100 ${borderClass}`}>
                      <td className="py-1.5 px-2 font-medium">{label}</td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.PA : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.AB : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.H : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.HR : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.R : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.RBI : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.SB : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? hitterStats.CS : <Dash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.AVG) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.OBP) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.SLG) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? formatAvg(hitterStats.OPS) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? formatAvg(calculatePlatoonOPS(hitterStats.OPS, player.ob_vr, player.sl_vr)) : <RateDash />}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {hitterStats ? formatAvg(calculatePlatoonOPS(hitterStats.OPS, player.ob_vl, player.sl_vl)) : <RateDash />}
                      </td>
                    </tr>
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* News Section */}
      <PlayerNewsSection playerId={playerId} />
    </div>
  );
}
