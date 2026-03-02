"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Player } from "@/lib/types";

interface ExportQueueModalProps {
  open: boolean;
  players: Player[];
  onClose: () => void;
}

function formatQueueText(players: Player[]): string {
  return players.map((p) => `${p.scoresheet_id} ${p.name}`).join("\n");
}

export function ExportQueueModal({
  open,
  players,
  onClose,
}: ExportQueueModalProps) {
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const queueText = formatQueueText(players);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(queueText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-queue-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
        data-testid="export-modal-backdrop"
      />

      {/* Dialog card */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="export-queue-title"
            className="text-lg font-semibold"
          >
            Export Draft Queue
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your draft queue is empty.
          </p>
        ) : (
          <>
            <textarea
              readOnly
              value={queueText}
              className="w-full h-64 rounded border border-border bg-muted p-3 text-sm font-mono resize-none focus:outline-none"
              aria-label="Formatted queue text"
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCopy}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5 font-medium"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
