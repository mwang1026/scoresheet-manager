"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  usePlayers,
  useProjections,
  useStatsForSource,
  useTeams,
} from "@/lib/hooks/use-players-data";
import { useTeamLineups } from "@/lib/hooks/use-lineups";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import { usePlayerNotes } from "@/lib/hooks/use-player-notes";
import { useNewsFlags } from "@/lib/hooks/use-news-data";
import {
  aggregateRosterHitters,
  aggregateRosterPitchers,
  buildStatsMaps,
  getAvailableProjectionSources,
  isPlayerPitcher,
  usesDateRange,
  type DateRange,
  type StatsSource,
} from "@/lib/stats";
import { buildTeamRoles, computeStarterTotals, describeLineupSource, hasScrapedLineup } from "@/lib/lineups";
import { StatsSourceToggle } from "@/components/ui/stats-source-toggle";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { ProjectionSourceSelect } from "@/components/ui/projection-source-select";
import { PlayoffModeNote } from "@/components/ui/playoff-mode-note";
import { TeamStatsSummary } from "@/components/dashboard/team-stats-summary";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { SectionPanel } from "@/components/ui/section-panel";
import { TeamHittersTable } from "./team-hitters-table";
import { TeamPitchersTable } from "./team-pitchers-table";
import { BattingOrderPanel, PitchingPanel } from "./lineup-panels";

interface TeamDetailProps {
  teamId: number;
}

export function TeamDetail({ teamId }: TeamDetailProps) {
  const { players, isLoading: playersLoading, error: playersError } = usePlayers();
  const { teams, isLoading: teamsLoading, error: teamsError } = useTeams();
  const { projections } = useProjections();
  const { lineupsByTeam, weekEnd: lineupWeekEnd } = useTeamLineups();
  const { getNote, saveNote } = usePlayerNotes();
  const { newsPlayerIds } = useNewsFlags();

  const defaults = usePageDefaults("opponents");
  const { updatePageSettings } = useSettingsContext();
  const [dateRange, setDateRange] = useState<DateRange>(defaults.dateRange);
  const [statsSource, setStatsSource] = useState<StatsSource>(defaults.statsSource);

  const availableSources = useMemo(() => getAvailableProjectionSources(projections || []), [projections]);
  const [projectionSource, setProjectionSource] = useState(availableSources[0] ?? "");
  useEffect(() => {
    if (projectionSource === "" && availableSources.length > 0) setProjectionSource(availableSources[0]);
  }, [availableSources, projectionSource]);

  const handleStatsSourceChange = useCallback(
    (s: StatsSource) => {
      setStatsSource(s);
      updatePageSettings("opponents", { statsSource: s });
    },
    [updatePageSettings]
  );
  const handleProjectionSourceChange = useCallback(
    (s: string) => {
      setProjectionSource(s);
      updatePageSettings("opponents", { projectionSource: s });
    },
    [updatePageSettings]
  );

  const {
    hitterStats: hitterStatsData,
    pitcherStats: pitcherStatsData,
    isLoading: statsLoading,
    error: statsError,
  } = useStatsForSource(statsSource, dateRange, defaults.seasonYear);

  const team = useMemo(() => (teams ?? []).find((t) => t.id === teamId), [teams, teamId]);
  const isPlayoff = statsSource === "playoff";
  const columnSet = isPlayoff ? "playoff" : "default";

  const view = useMemo(() => {
    const playersList = players ?? [];
    const playerMap = new Map(playersList.map((p) => [p.id, p]));
    const teamPlayers = playersList.filter((p) => p.team_id === teamId);
    const hitters = teamPlayers.filter((p) => !isPlayerPitcher(p));
    const pitchers = teamPlayers.filter((p) => isPlayerPitcher(p));
    const maps = buildStatsMaps({
      statsSource,
      projectionSource,
      projections,
      hitterRows: hitterStatsData,
      pitcherRows: pitcherStatsData,
      seasonYear: defaults.seasonYear,
    });
    const lineup = lineupsByTeam.get(teamId);
    const teamRoles = team
      ? buildTeamRoles({
          team,
          lineup,
          players: teamPlayers,
          hitterStatsMap: maps.hitterStatsMap,
          pitcherStatsMap: maps.pitcherStatsMap,
          statsSource,
        })
      : { roles: new Map(), source: null };
    const starterTotals = teamRoles.source
      ? computeStarterTotals(
          hitters,
          pitchers,
          teamRoles.roles,
          maps.hitterStatsMap,
          maps.pitcherStatsMap,
          isPlayoff ? maps.playoffHitterMeta : undefined,
          isPlayoff ? maps.playoffPitcherMeta : undefined
        )
      : null;
    return {
      playerMap,
      hitters,
      pitchers,
      maps,
      lineup: hasScrapedLineup(lineup) ? lineup : undefined,
      lineupRoles: teamRoles.source ? teamRoles.roles : undefined,
      lineupNote: describeLineupSource(teamRoles.source, lineupWeekEnd),
      starterTotals,
      teamHitterTotals: aggregateRosterHitters(hitters, maps.hitterStatsMap),
      teamPitcherTotals: aggregateRosterPitchers(pitchers, maps.pitcherStatsMap),
    };
  }, [players, teamId, team, statsSource, projectionSource, projections, hitterStatsData, pitcherStatsData, defaults.seasonYear, lineupsByTeam, lineupWeekEnd, isPlayoff]);

  const isLoading = playersLoading || teamsLoading || statsLoading;
  const error = playersError || teamsError || statsError;

  if (error) {
    return <p className="text-destructive">Error loading data: {(error as Error).message}</p>;
  }
  if (isLoading) {
    return <TableSkeleton rows={12} columns={11} />;
  }
  if (!team) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Team not found.</p>
        <Link href="/opponents" className="text-primary hover:underline text-sm">Back to Opponents</Link>
      </div>
    );
  }

  const lineupDefaultSort = { column: "Lineup", direction: "asc" as const };
  const playoffHitterMeta = isPlayoff ? view.maps.playoffHitterMeta : undefined;
  const playoffPitcherMeta = isPlayoff ? view.maps.playoffPitcherMeta : undefined;

  return (
    <div className="space-y-6">
      <Link href="/opponents" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Opponents
      </Link>

      <div className="flex flex-wrap gap-4 items-center">
        <StatsSourceToggle value={statsSource} onChange={handleStatsSourceChange} />
        {statsSource === "projected" && (
          <ProjectionSourceSelect value={projectionSource} sources={availableSources} onChange={handleProjectionSourceChange} />
        )}
        {usesDateRange(statsSource) && (
          <DateRangeSelect dateRange={dateRange} onDateRangeChange={setDateRange} seasonYear={defaults.seasonYear} />
        )}
        {isPlayoff && <PlayoffModeNote seasonYear={defaults.seasonYear} />}
      </div>

      <TeamStatsSummary
        hitterStats={view.teamHitterTotals}
        pitcherStats={view.teamPitcherTotals}
        weighted={isPlayoff}
        starterHitterStats={view.starterTotals?.hitters}
        starterPitcherStats={view.starterTotals?.pitchers}
        starterNote={view.lineupNote}
      />

      {view.lineup ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="lineup-panels">
          <BattingOrderPanel
            title="Batting order vs RHP"
            slots={view.lineup.vs_rhp}
            teamId={teamId}
            playerMap={view.playerMap}
            hitterStatsMap={view.maps.hitterStatsMap}
            playoffMeta={playoffHitterMeta}
          />
          <BattingOrderPanel
            title="Batting order vs LHP"
            slots={view.lineup.vs_lhp}
            teamId={teamId}
            playerMap={view.playerMap}
            hitterStatsMap={view.maps.hitterStatsMap}
            playoffMeta={playoffHitterMeta}
          />
          <PitchingPanel
            title="Rotation"
            pitchers={view.lineup.rotation}
            isRotation
            teamId={teamId}
            playerMap={view.playerMap}
            pitcherStatsMap={view.maps.pitcherStatsMap}
            playoffMeta={playoffPitcherMeta}
            emptyMessage="No starting pitchers in the scraped week."
          />
          <PitchingPanel
            title="Bullpen"
            pitchers={view.lineup.relievers}
            isRotation={false}
            teamId={teamId}
            playerMap={view.playerMap}
            pitcherStatsMap={view.maps.pitcherStatsMap}
            playoffMeta={playoffPitcherMeta}
            emptyMessage="No relief appearances could be attributed to this team."
          />
        </div>
      ) : (
        <SectionPanel title="Lineup">
          <p className="p-3 text-xs text-muted-foreground">
            No scraped Scoresheet lineup for this team yet. Roles below are inferred from the depth chart.
          </p>
        </SectionPanel>
      )}

      <SectionPanel title="Hitters" badge={`${view.hitters.length}`}>
        <TeamHittersTable
          key={`hitters-${columnSet}`}
          players={view.hitters}
          hitterStatsMap={view.maps.hitterStatsMap}
          teamTotals={view.teamHitterTotals}
          defaultSort={isPlayoff && view.lineupRoles ? lineupDefaultSort : defaults.hitterSort}
          getNote={getNote}
          saveNote={saveNote}
          newsPlayerIds={newsPlayerIds}
          columnSet={columnSet}
          playoffMeta={view.maps.playoffHitterMeta}
          lineupRoles={view.lineupRoles}
          starterTotals={view.starterTotals?.hitters}
        />
      </SectionPanel>

      <SectionPanel title="Pitchers" badge={`${view.pitchers.length}`}>
        <TeamPitchersTable
          key={`pitchers-${columnSet}`}
          players={view.pitchers}
          pitcherStatsMap={view.maps.pitcherStatsMap}
          teamTotals={view.teamPitcherTotals}
          defaultSort={isPlayoff && view.lineupRoles ? lineupDefaultSort : defaults.pitcherSort}
          getNote={getNote}
          saveNote={saveNote}
          newsPlayerIds={newsPlayerIds}
          columnSet={columnSet}
          playoffMeta={view.maps.playoffPitcherMeta}
          lineupRoles={view.lineupRoles}
          starterTotals={view.starterTotals?.pitchers}
        />
      </SectionPanel>
    </div>
  );
}
