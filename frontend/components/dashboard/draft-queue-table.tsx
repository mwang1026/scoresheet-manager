import Link from "next/link";
import { formatAvg, formatRate, isPlayerPitcher, getPositionsList } from "@/lib/stats";
import { NoteIcon } from "@/components/ui/note-icon";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface DraftQueueTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
}

function QueueItem({
  player,
  index,
  keyStat,
  keyStatLabel,
  getNote,
  saveNote,
}: {
  player: Player;
  index: number;
  keyStat: string;
  keyStatLabel: string;
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm border-b pb-2 last:border-b-0 last:pb-0">
      <div className="w-6 text-muted-foreground font-medium">{index + 1}.</div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/players/${player.id}`}
          className="text-primary hover:underline font-medium truncate inline"
        >
          {player.name}
        </Link>
        <NoteIcon playerId={player.id} playerName={player.name} noteContent={getNote(player.id)} onSave={saveNote} />
      </div>
      <div className="w-auto text-muted-foreground">
        {getPositionsList(player).replaceAll("/", ", ")}
      </div>
      <div className="w-24 text-right">
        <span className="tabular-nums">{keyStat}</span>
        <span className="text-xs text-muted-foreground ml-1">{keyStatLabel}</span>
      </div>
    </div>
  );
}

function ManageButton() {
  return (
    <Link
      href="/draft"
      className="text-sm font-medium text-white/80 hover:text-white border border-white/30 rounded px-2 py-1"
    >
      Manage Draft Queue
    </Link>
  );
}

export function DraftQueueTable({
  players,
  hitterStatsMap,
  pitcherStatsMap,
  getNote,
  saveNote,
}: DraftQueueTableProps) {
  if (players.length === 0) {
    return (
      <div className="border rounded-lg">
        <div className="p-4 bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Draft Queue ({players.length})</h2>
            <ManageButton />
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">No players in your draft queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <div className="p-4 bg-brand text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Draft Queue ({players.length})</h2>
          <ManageButton />
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {players.map((player, index) => {
            const isPitcher = isPlayerPitcher(player);
            const stats = isPitcher
              ? pitcherStatsMap.get(player.id)
              : hitterStatsMap.get(player.id);

            let keyStat = "—";
            let keyStatLabel = "";
            if (isPitcher && stats && "ERA" in stats) {
              keyStat = formatRate(stats.ERA);
              keyStatLabel = "ERA";
            } else if (!isPitcher && stats && "OPS" in stats) {
              keyStat = formatAvg(stats.OPS);
              keyStatLabel = "OPS";
            }

            return (
              <QueueItem
                key={player.id}
                player={player}
                index={index}
                keyStat={keyStat}
                keyStatLabel={keyStatLabel}
                getNote={getNote}
                saveNote={saveNote}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
