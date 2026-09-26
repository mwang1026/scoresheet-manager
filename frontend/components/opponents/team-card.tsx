import Link from "next/link";
import { SectionPanel } from "@/components/ui/section-panel";
import { formatAvg, formatRate } from "@/lib/stats";
import type { LineupRoleMap } from "@/lib/lineups";
import type { Player, Team } from "@/lib/types";
import type {
  AggregatedHitterStats,
  AggregatedPitcherStats,
  PlayoffHitterMeta,
  PlayoffPitcherMeta,
} from "@/lib/stats";
import type { TableColumnSet } from "@/components/ui/playoff-cells";
import { TeamHittersTable } from "./team-hitters-table";
import { TeamPitchersTable } from "./team-pitchers-table";

export interface OpponentTeamData {
  team: Team;
  hitters: Player[];
  pitchers: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  teamHitterTotals: AggregatedHitterStats;
  teamPitcherTotals: AggregatedPitcherStats;
  defaultHitterSort?: { column: string; direction: "asc" | "desc" };
  defaultPitcherSort?: { column: string; direction: "asc" | "desc" };
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
  columnSet?: TableColumnSet;
  playoffHitterMeta?: Map<number, PlayoffHitterMeta>;
  playoffPitcherMeta?: Map<number, PlayoffPitcherMeta>;
  lineupRoles?: LineupRoleMap;
  starterHitterTotals?: AggregatedHitterStats;
  starterPitcherTotals?: AggregatedPitcherStats;
  lineupNote?: string;
}

interface TeamCardProps {
  data: OpponentTeamData;
}

export function TeamCard({ data }: TeamCardProps) {
  const {
    team,
    hitters,
    pitchers,
    hitterStatsMap,
    pitcherStatsMap,
    teamHitterTotals,
    teamPitcherTotals,
    defaultHitterSort,
    defaultPitcherSort,
    getNote,
    saveNote,
    newsPlayerIds,
    columnSet,
    playoffHitterMeta,
    playoffPitcherMeta,
    lineupRoles,
    starterHitterTotals,
    starterPitcherTotals,
    lineupNote,
  } = data;

  return (
    <SectionPanel
      title={
        <Link href={`/opponents/${team.id}`} className="hover:underline" title="Open team detail">
          {team.name}
        </Link>
      }
    >
      {starterHitterTotals && starterPitcherTotals && (
        <div
          className="px-2 py-1 text-xs bg-card-elevated border-b flex flex-wrap items-baseline gap-x-4 gap-y-0.5"
          data-testid="starter-line"
        >
          <span className="text-muted-foreground uppercase tracking-wide">Starters</span>
          <span className="font-mono tabular-nums">
            OPS <span className="font-semibold">{formatAvg(starterHitterTotals.OPS)}</span>
            {" · "}ERA <span className="font-semibold">{formatRate(starterPitcherTotals.ERA)}</span>
            {" · "}WHIP <span className="font-semibold">{formatRate(starterPitcherTotals.WHIP)}</span>
          </span>
          {lineupNote && <span className="text-muted-foreground">{lineupNote}</span>}
        </div>
      )}
      <div>
        <div className="px-2 py-1 text-xs font-semibold bg-card-elevated text-muted-foreground uppercase tracking-wide border-b">
          Hitters ({hitters.length})
        </div>
        <TeamHittersTable
          players={hitters}
          hitterStatsMap={hitterStatsMap}
          teamTotals={teamHitterTotals}
          defaultSort={defaultHitterSort}
          getNote={getNote}
          saveNote={saveNote}
          newsPlayerIds={newsPlayerIds}
          columnSet={columnSet}
          playoffMeta={playoffHitterMeta}
          lineupRoles={lineupRoles}
          starterTotals={starterHitterTotals}
        />
      </div>
      <div className="border-t mt-3">
        <div className="px-2 py-1 text-xs font-semibold bg-card-elevated text-muted-foreground uppercase tracking-wide border-b">
          Pitchers ({pitchers.length})
        </div>
        <TeamPitchersTable
          players={pitchers}
          pitcherStatsMap={pitcherStatsMap}
          teamTotals={teamPitcherTotals}
          defaultSort={defaultPitcherSort}
          getNote={getNote}
          saveNote={saveNote}
          newsPlayerIds={newsPlayerIds}
          columnSet={columnSet}
          playoffMeta={playoffPitcherMeta}
          lineupRoles={lineupRoles}
          starterTotals={starterPitcherTotals}
        />
      </div>
    </SectionPanel>
  );
}
