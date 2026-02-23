"use client";

import { useState, useEffect, useRef } from "react";
import { useTeamContext } from "@/lib/contexts/team-context";

export function TeamSwitcher() {
  const { teams, currentTeam, isLoading, setTeamId } = useTeamContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (isLoading) {
    return <p className="text-sm text-brand-blue">Loading...</p>;
  }

  if (teams.length <= 1) {
    return (
      <div className="text-sm">
        <div className="text-xs text-muted-foreground">{currentTeam?.league_name ?? ""}</div>
        <div className="text-brand-blue">{currentTeam?.name ?? ""}</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative text-sm">
      <button
        aria-label="Switch team"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-left"
      >
        <div className="text-xs text-muted-foreground">{currentTeam?.league_name ?? ""}</div>
        <div className="text-brand-blue">{currentTeam?.name ?? ""}</div>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-background border rounded min-w-[160px] py-1">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                setTeamId(team.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-muted ${team.id === currentTeam?.id ? "bg-muted/50" : ""}`}
            >
              <div className="text-xs text-muted-foreground">{team.league_name}</div>
              <div className="text-brand-blue">{team.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
