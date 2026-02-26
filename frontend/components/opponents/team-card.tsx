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
  } = data;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 border-b bg-brand-blue text-white text-base font-semibold">
        {team.name}
      </div>
      <div>
        <div className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-900 border-b">
          Hitters ({hitters.length})
        </div>
        <TeamHittersTable
          players={hitters}
          hitterStatsMap={hitterStatsMap}
          teamTotals={teamHitterTotals}
          defaultSort={defaultHitterSort}
          getNote={getNote}
          saveNote={saveNote}
        />
      </div>
      <div className="border-t mt-3">
        <div className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-900 border-b">
          Pitchers ({pitchers.length})
        </div>
        <TeamPitchersTable
          players={pitchers}
          pitcherStatsMap={pitcherStatsMap}
          teamTotals={teamPitcherTotals}
          defaultSort={defaultPitcherSort}
          getNote={getNote}
          saveNote={saveNote}
        />
      </div>
    </div>
  );
}
