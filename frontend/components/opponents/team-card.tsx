import { SectionPanel } from "@/components/ui/section-panel";
import type { Player, Team } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";
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
  } = data;

  return (
    <SectionPanel title={team.name}>
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
        />
      </div>
    </SectionPanel>
  );
}
