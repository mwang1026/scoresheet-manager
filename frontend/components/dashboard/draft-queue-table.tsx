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
import { formatAvg, formatRate, isPlayerPitcher } from "@/lib/stats";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Player } from "@/lib/fixtures";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

interface DraftQueueTableProps {
  players: Player[];
  hitterStatsMap: Map<number, AggregatedHitterStats>;
  pitcherStatsMap: Map<number, AggregatedPitcherStats>;
  onRemove: (playerId: number) => void;
  onRemoveFromWatchlist?: (playerId: number) => void;
  isWatchlisted?: (playerId: number) => boolean;
  onReorder: (newOrder: number[]) => void;
  isHydrated: boolean;
}

interface SortableQueueItemProps {
  player: Player;
  index: number;
  keyStat: string;
  onRemoveClick: (player: Player) => void;
  isHydrated: boolean;
}

function SortableQueueItem({
  player,
  index,
  keyStat,
  onRemoveClick,
  isHydrated,
}: SortableQueueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-sm border-b pb-2 last:border-b-0 last:pb-0"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label={`Reorder ${player.name}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>

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
          onClick={() => onRemoveClick(player)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Remove ${player.name} from queue`}
        >
          <ListX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function DraftQueueTable({
  players,
  hitterStatsMap,
  pitcherStatsMap,
  onRemove,
  onRemoveFromWatchlist,
  onReorder,
  isHydrated,
}: DraftQueueTableProps) {
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
    setAlsoRemoveFromWatchlist(false); // Reset checkbox
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

  if (players.length === 0) {
    return (
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Draft Queue ({players.length})</h2>
        <p className="text-sm text-muted-foreground">No players in your draft queue.</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Draft Queue ({players.length})</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={players.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
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
                  <SortableQueueItem
                    key={player.id}
                    player={player}
                    index={index}
                    keyStat={keyStat}
                    onRemoveClick={handleRemoveClick}
                    isHydrated={isHydrated}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

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
