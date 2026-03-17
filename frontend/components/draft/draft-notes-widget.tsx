"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useDraftNotes } from "@/lib/hooks/use-draft-notes";

const STORAGE_KEY = "draft-notes-collapsed";

export function DraftNotesWidget() {
  const { content: serverContent, save } = useDraftNotes();
  const [localContent, setLocalContent] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });

  // Sync local content when server content changes
  useEffect(() => {
    setLocalContent(serverContent);
  }, [serverContent]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    await save(localContent);
  }, [save, localContent]);

  const isDirty = localContent !== serverContent;

  return (
    <div className="border border-border rounded-md overflow-hidden border-t-2 border-t-brand bg-card">
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        className="w-full px-4 py-2.5 border-b border-border flex items-center gap-2 bg-card-elevated hover:bg-muted/50 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-none" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-none" />
        )}
        <span className="text-sm font-semibold text-foreground">Draft Notes</span>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            placeholder="Draft strategy, targets, notes..."
            className="w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand rows-3 sm:rows-4"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="px-3 py-1.5 text-xs font-medium rounded bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
