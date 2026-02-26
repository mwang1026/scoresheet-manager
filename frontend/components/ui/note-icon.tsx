"use client";

import { StickyNote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NoteModal } from "./note-modal";

function TooltipOverlay({
  iconRef,
  onClick,
  children,
}: {
  iconRef: React.RefObject<HTMLSpanElement | null>;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const icon = iconRef.current;
    const tooltip = tooltipRef.current;
    if (!icon || !tooltip) return;

    const rect = icon.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight;
    const GAP = 6;

    // Default: above the icon. If clipped at top, flip below.
    const above = rect.top - tooltipHeight - GAP;
    const top = above < 8 ? rect.bottom + GAP : above;
    const left = rect.left + rect.width / 2;

    setPos({ top, left });
  }, [iconRef]);

  return (
    <div
      ref={tooltipRef}
      className="fixed -translate-x-1/2 px-2 py-1 bg-popover border rounded text-xs max-w-xs whitespace-pre-wrap break-words shadow-md cursor-pointer z-50"
      style={
        pos
          ? { top: pos.top, left: pos.left }
          : { visibility: "hidden", top: 0, left: 0 }
      }
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export interface NoteIconProps {
  playerId: number;
  playerName: string;
  noteContent: string;
  onSave: (playerId: number, content: string) => void;
}

export function NoteIcon({
  playerId,
  playerName,
  noteContent,
  onSave,
}: NoteIconProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const hasNote = noteContent.length > 0;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setTooltipVisible(false);
      setModalOpen(true);
    },
    []
  );

  const handleMouseEnter = useCallback(() => {
    if (!hasNote) return;
    hoverTimeout.current = setTimeout(() => {
      setTooltipVisible(true);
    }, 200);
  }, [hasNote]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setTooltipVisible(false);
  }, []);

  const handleSave = useCallback(
    (content: string) => {
      onSave(playerId, content);
      setModalOpen(false);
    },
    [playerId, onSave]
  );

  const handleCancel = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      <span
        ref={iconRef}
        className="relative inline-flex items-center ml-1.5 cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <StickyNote
          className={`w-3.5 h-3.5 ${
            hasNote ? "text-brand-blue" : "text-muted-foreground/40"
          }`}
          onClick={handleClick}
        />
      </span>

      {tooltipVisible && hasNote && typeof document !== "undefined" &&
        createPortal(
          <TooltipOverlay iconRef={iconRef} onClick={handleClick}>
            {noteContent}
          </TooltipOverlay>,
          document.body
        )}

      <NoteModal
        open={modalOpen}
        playerName={playerName}
        initialContent={noteContent}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
}
