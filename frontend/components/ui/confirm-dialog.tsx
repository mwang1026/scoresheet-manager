"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
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

  // Auto-focus cancel button when dialog opens
  useEffect(() => {
    if (open && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold mb-2"
        >
          {title}
        </h2>

        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}

        {children && <div className="mb-4">{children}</div>}

        <div className="flex gap-3 justify-end">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
