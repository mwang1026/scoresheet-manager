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
  isPlayerPitcher,
  getDefenseDisplay,
} from "@/lib/stats";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
}

interface SortableQueueTileProps {
  player: Player;
  index: number;
  stats: AggregatedHitterStats | AggregatedPitcherStats | undefined;
  onRemoveClick: (player: Player) => void;
  isHydrated: boolean;
}

function SortableQueueTile({
  player,
  index,
  stats,
  onRemoveClick,
  isHydrated,
}: SortableQueueTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPitcher = isPlayerPitcher(player);

  // Build stats line
  let statsLine = "—";
  if (isPitcher && stats && "ERA" in stats) {
    const era = formatRate(stats.ERA);
    const whip = formatRate(stats.WHIP);
    const k9 = formatRate(stats.K9);
    statsLine = `${era} ERA  ${whip} WHIP  ${k9}K/9`;
  } else if (!isPitcher && stats && "AVG" in stats) {
    const avg = formatAvg(stats.AVG);
    const ops = formatAvg(stats.OPS);
    const hr = stats.HR;
    statsLine = `${avg} AVG  ${ops} OPS  ${hr} HR`;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-3 bg-card hover:bg-accent/5 transition-colors"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label={`Reorder ${player.name}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Position number */}
        <span className="text-sm font-medium text-muted-foreground flex-none">
          #{index + 1}
        </span>

        {/* Player name */}
        <Link
          href={`/players/${player.id}`}
          className="text-primary hover:underline font-semibold flex-none"
        >
          {player.name}
        </Link>

        {/* Separator */}
        <span className="text-sm text-muted-foreground/50 flex-none">|</span>

        {/* Position + defense + team */}
        <span className="text-sm text-foreground flex-none">
          {getDefenseDisplay(player)} · {player.current_team}
        </span>

        {/* Separator */}
        <span className="text-sm text-muted-foreground/50 flex-none">|</span>

        {/* Stats */}
        <span className="text-sm text-muted-foreground tabular-nums flex-none">
          {statsLine}
        </span>

        {/* Remove button */}
        {isHydrated && (
          <button
            onClick={() => onRemoveClick(player)}
            className="text-muted-foreground hover:text-foreground ml-auto"
            aria-label={`Remove ${player.name} from queue`}
          >
            <ListX className="w-4 h-4" />
          </button>
        )}
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
      <div className="flex flex-col h-full">
        <h2 className="text-lg font-semibold mb-4 flex-none">
          Draft Queue ({players.length})
        </h2>

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
              <div className="space-y-3 flex-1 overflow-y-auto">
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
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
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
