"use client";

import { StickyNote } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NoteModal } from "./note-modal";
import { TooltipOverlay } from "./tooltip-overlay";

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
            hasNote ? "text-brand" : "text-muted-foreground/40"
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
