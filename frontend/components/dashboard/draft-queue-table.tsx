import Link from "next/link";
import { ListX } from "lucide-react";
import { formatAvg, formatRate, isPlayerPitcher } from "@/lib/stats";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface DraftQueueTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  onRemove: (playerId: number) => void;
  isHydrated: boolean;
}

export function DraftQueueTable({
  players,
  hitterStatsMap,
  pitcherStatsMap,
  onRemove,
  isHydrated,
}: DraftQueueTableProps) {
  if (players.length === 0) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Draft Queue ({players.length})</h2>
        <p className="text-sm text-muted-foreground">No players in your draft queue.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Draft Queue ({players.length})</h2>
      <div className="space-y-2">
        {players.map((player, index) => {
          const isPitcher = isPlayerPitcher(player);
          const stats = isPitcher
            ? pitcherStatsMap.get(player.id)
            : hitterStatsMap.get(player.id);

          let keyStat = "—";
          if (isPitcher && stats && "ERA" in stats) {
            keyStat = formatRate(stats.ERA);
          } else if (!isPitcher && stats && "OPS" in stats) {
            keyStat = formatAvg(stats.OPS);
          }

          return (
            <div
              key={player.id}
              className="flex items-center gap-2 text-sm border-b pb-2 last:border-b-0 last:pb-0"
            >
              <div className="w-6 text-muted-foreground font-medium">{index + 1}.</div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/players/${player.id}`}
                  className="text-primary hover:underline font-medium truncate block"
                >
                  {player.name}
                </Link>
              </div>
              <div className="w-8 text-muted-foreground">{player.primary_position}</div>
              <div className="w-16 text-right tabular-nums">{keyStat}</div>
              {isHydrated && (
                <button
                  onClick={() => onRemove(player.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${player.name} from queue`}
                >
                  <ListX className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
