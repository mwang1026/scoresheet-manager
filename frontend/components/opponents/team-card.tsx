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
  } = data;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-3 border-b bg-muted/30 text-base font-semibold">
        {team.name}
      </div>
      <div>
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b">
          Hitters ({hitters.length})
        </div>
        <TeamHittersTable
          players={hitters}
          hitterStatsMap={hitterStatsMap}
          teamTotals={teamHitterTotals}
        />
      </div>
      <div className="border-t">
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-b">
          Pitchers ({pitchers.length})
        </div>
        <TeamPitchersTable
          players={pitchers}
          pitcherStatsMap={pitcherStatsMap}
          teamTotals={teamPitcherTotals}
        />
      </div>
    </div>
  );
}
