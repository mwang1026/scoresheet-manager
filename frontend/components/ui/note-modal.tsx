"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export interface NoteModalProps {
  open: boolean;
  playerName: string;
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function NoteModal({
  open,
  playerName,
  initialContent,
  onSave,
  onCancel,
}: NoteModalProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content when modal opens with new initialContent
  useEffect(() => {
    if (open) {
      setContent(initialContent);
    }
  }, [open, initialContent]);

  // Auto-focus textarea on open
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  const isEditing = initialContent.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 id="note-modal-title" className="text-lg font-semibold mb-3">
          {playerName}
        </h2>

        <textarea
          ref={textareaRef}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
          placeholder="Add a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="flex gap-3 justify-end mt-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(content)}>
            {isEditing ? "Save Changes" : "Save Note"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
