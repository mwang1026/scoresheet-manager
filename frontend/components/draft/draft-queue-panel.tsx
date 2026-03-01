"use client";

import { useState } from "react";
import Link from "next/link";
import { ListX, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  formatAvg,
  formatRate,
  formatIP,
  isPlayerPitcher,
  getDefenseDisplay,
} from "@/lib/stats";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SectionPanel } from "@/components/ui/section-panel";
import { NoteIcon } from "@/components/ui/note-icon";
import { NewsIcon } from "@/components/ui/news-icon";
import { ILIcon } from "@/components/ui/il-icon";
import type { Player } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface DraftQueuePanelProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  onRemove: (playerId: number) => void;
  onRemoveFromWatchlist?: (playerId: number) => void;
  onReorder: (newOrder: number[]) => void;
  isHydrated: boolean;
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
}

function StatCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-mono tabular-nums">{value}</span>
    </span>
  );
}

interface SortableQueueTileProps {
  player: Player;
  index: number;
  stats: AggregatedHitterStats | AggregatedPitcherStats | undefined;
  onRemoveClick: (player: Player) => void;
  isHydrated: boolean;
  getNote: (playerId: number) => string;
  saveNote: (playerId: number, content: string) => void;
  newsPlayerIds?: Set<number>;
}

function SortableQueueTile({
  player,
  index,
  stats,
  onRemoveClick,
  isHydrated,
  getNote,
  saveNote,
  newsPlayerIds,
}: SortableQueueTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPitcher = isPlayerPitcher(player);

  // Build structured stat cells
  const statCells: { label: string; value: string; className: string }[] = [];
  if (isPitcher && stats && "ERA" in stats) {
    statCells.push(
      { label: "IP", value: formatIP(stats.IP_outs), className: "min-w-[46px]" },
      { label: "ERA", value: stats.ERA != null ? formatRate(stats.ERA) : "\u2014", className: "min-w-[50px]" },
      { label: "WHIP", value: stats.WHIP != null ? formatRate(stats.WHIP) : "\u2014", className: "min-w-[56px]" },
      { label: "K", value: String(stats.K), className: "min-w-[32px]" },
      { label: "BB", value: String(stats.BB), className: "min-w-[36px]" },
    );
  } else if (!isPitcher && stats && "AVG" in stats) {
    statCells.push(
      { label: "PA", value: String(stats.PA), className: "min-w-[38px]" },
      { label: "AVG", value: stats.AVG != null ? formatAvg(stats.AVG) : "\u2014", className: "min-w-[52px]" },
      { label: "OPS", value: stats.OPS != null ? formatAvg(stats.OPS) : "\u2014", className: "min-w-[52px]" },
      { label: "RBI", value: String(stats.RBI), className: "min-w-[38px]" },
      { label: "HR", value: String(stats.HR), className: "min-w-[34px]" },
      { label: "SB", value: String(stats.SB), className: "min-w-[34px]" },
    );
  }

  const teamPosLabel = `· ${player.current_team} · ${getDefenseDisplay(player)}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-md px-2 py-1.5 bg-card hover:bg-accent/30 transition-colors"
    >
      {/* Row 1: identity + (wide: stats) + remove */}
      <div className="flex items-center gap-x-2 text-sm min-w-0">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing flex-none"
          aria-label={`Reorder ${player.name}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Position number */}
        <span className="font-medium text-muted-foreground font-mono tabular-nums flex-none">
          #{index + 1}
        </span>

        {/* Name + team/pos + icons — clipped container so long names truncate */}
        <div className="flex items-center gap-x-1.5 min-w-0 overflow-hidden">
          <Link
            href={`/players/${player.id}`}
            className="text-primary hover:underline font-semibold truncate"
          >
            {player.name}
          </Link>
          <span className="text-muted-foreground flex-none">
            {teamPosLabel}
          </span>
          <NoteIcon playerId={player.id} playerName={player.name} noteContent={getNote(player.id)} onSave={saveNote} />
          <NewsIcon playerId={player.id} hasNews={newsPlayerIds?.has(player.id) ?? false} />
          <ILIcon ilType={player.il_type} ilDate={player.il_date} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats — visible at wide container only */}
        <div className="queue-tile-wide-stats items-baseline gap-x-3">
          {statCells.map((c) => (
            <StatCell key={c.label} label={c.label} value={c.value} className={c.className} />
          ))}
        </div>

        {/* Remove button */}
        {isHydrated && (
          <button
            onClick={() => onRemoveClick(player)}
            className="text-muted-foreground hover:text-foreground flex-none"
            aria-label={`Remove ${player.name} from queue`}
          >
            <ListX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row 2: stats only — visible at narrow container only */}
      <div className="queue-tile-narrow-row items-baseline gap-x-3 text-sm pl-10 pt-0.5">
        {statCells.map((c) => (
          <StatCell key={c.label} label={c.label} value={c.value} className={c.className} />
        ))}
      </div>
    </div>
  );
}

export function DraftQueuePanel({
  players,
  hitterStatsMap,
  pitcherStatsMap,
  onRemove,
  onRemoveFromWatchlist,
  onReorder,
  isHydrated,
  getNote,
  saveNote,
  newsPlayerIds,
}: DraftQueuePanelProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<Player | null>(null);
  const [alsoRemoveFromWatchlist, setAlsoRemoveFromWatchlist] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);

      const newOrder = arrayMove(
        players.map((p) => p.id),
        oldIndex,
        newIndex
      );
      onReorder(newOrder);
    }
  };

  const handleRemoveClick = (player: Player) => {
    setPlayerToRemove(player);
    setAlsoRemoveFromWatchlist(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRemove = () => {
    if (playerToRemove) {
      onRemove(playerToRemove.id);
      if (alsoRemoveFromWatchlist && onRemoveFromWatchlist) {
        onRemoveFromWatchlist(playerToRemove.id);
      }
      setConfirmDialogOpen(false);
      setPlayerToRemove(null);
      setAlsoRemoveFromWatchlist(false);
    }
  };

  const handleCancelRemove = () => {
    setConfirmDialogOpen(false);
    setPlayerToRemove(null);
    setAlsoRemoveFromWatchlist(false);
  };

  return (
    <>
      <SectionPanel title="Draft Queue" badge={`${players.length}`}>
        <div className="flex flex-col h-full p-4">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No players in your draft queue.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={players.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="queue-tile-container space-y-1.5 flex-1 overflow-y-auto">
                {players.map((player, index) => {
                  const isPitcher = isPlayerPitcher(player);
                  const stats = isPitcher
                    ? pitcherStatsMap.get(player.id)
                    : hitterStatsMap.get(player.id);

                  return (
                    <SortableQueueTile
                      key={player.id}
                      player={player}
                      index={index}
                      stats={stats}
                      onRemoveClick={handleRemoveClick}
                      isHydrated={isHydrated}
                      getNote={getNote}
                      saveNote={saveNote}
                      newsPlayerIds={newsPlayerIds}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
        </div>
      </SectionPanel>

      <ConfirmDialog
        open={confirmDialogOpen}
        title={`Remove ${playerToRemove?.name} from draft queue?`}
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelRemove}
      >
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={alsoRemoveFromWatchlist}
            onChange={(e) => setAlsoRemoveFromWatchlist(e.target.checked)}
            className="rounded"
          />
          <span>Also remove from watchlist</span>
        </label>
      </ConfirmDialog>
    </>
  );
}
