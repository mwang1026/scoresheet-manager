import Link from "next/link";
import { formatAvg, formatRate, isPlayerPitcher, getPositionsList } from "@/lib/stats";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import { SectionPanel } from "@/components/ui/section-panel";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface DraftQueueTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
}

function QueueItem({
  player,
  index,
  keyStat,
  keyStatLabel,
  getNote,
  saveNote,
  newsPlayerIds,
}: {
  player: Player;
  index: number;
  keyStat: string;
  keyStatLabel: string;
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
}) {
  const positions = getPositionsList(player).replaceAll("/", ", ");

  return (
    <div className="dash-queue-container text-sm border-b pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <div className="w-6 text-muted-foreground font-medium">{index + 1}.</div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/players/${player.id}`}
            className="text-primary hover:underline font-medium truncate inline"
          >
            {player.name}
          </Link>
          <NoteIcon playerId={player.id} playerName={player.name} noteContent={getNote(player.id)} onSave={saveNote} />
          <NewsIcon playerId={player.id} hasNews={newsPlayerIds?.has(player.id) ?? false} />
          <ILIcon ilType={player.il_type} ilDate={player.il_date} />
        </div>
        <div className="dash-queue-meta items-center gap-2">
          <div className="text-muted-foreground">{positions}</div>
          <div className="w-24 text-right">
            <span className="font-mono tabular-nums">{keyStat}</span>
            <span className="text-xs text-muted-foreground ml-1">{keyStatLabel}</span>
          </div>
        </div>
      </div>
      <div className="dash-queue-meta-wrap items-center gap-1 pl-8 text-xs text-muted-foreground">
        <span>{positions}</span>
        <span>·</span>
        <span>
          <span className="font-mono tabular-nums">{keyStat}</span>
          <span className="ml-1">{keyStatLabel}</span>
        </span>
      </div>
    </div>
  );
}

function ManageButton() {
  return (
    <Link
      href="/draft"
      className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
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
  newsPlayerIds,
}: DraftQueueTableProps) {
  if (players.length === 0) {
    return (
      <SectionPanel title="Draft Queue" badge={`${players.length}`} action={<ManageButton />}>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">No players in your draft queue.</p>
        </div>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Draft Queue" badge={`${players.length}`} action={<ManageButton />}>
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
                newsPlayerIds={newsPlayerIds}
              />
            );
          })}
        </div>
      </div>
    </SectionPanel>
  );
}
