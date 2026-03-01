"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { fetchScrapedLeagues, fetchScrapedTeams, addMyTeam } from "@/lib/api";
import type { ScrapedLeague, ScrapedTeam } from "@/lib/types";

export interface AddTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddTeamDialog({ open, onClose, onAdded }: AddTeamDialogProps) {
  const [leagues, setLeagues] = useState<ScrapedLeague[]>([]);
  const [teams, setTeams] = useState<ScrapedTeam[]>([]);
  const [selectedDataPath, setSelectedDataPath] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [leagueError, setLeagueError] = useState("");
  const [teamError, setTeamError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [leagueLoading, setLeagueLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return;

    setSelectedDataPath("");
    setSelectedTeamId(null);
    setTeams([]);
    setLeagueError("");
    setTeamError("");
    setSubmitError("");

    setLeagueLoading(true);
    fetchScrapedLeagues()
      .then((data) => setLeagues(data))
      .catch(() => setLeagueError("Failed to load leagues."))
      .finally(() => setLeagueLoading(false));
  }, [open]);

  // Auto-focus cancel button when dialog opens
  useEffect(() => {
    if (open && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  function handleLeagueChange(dataPath: string) {
    setSelectedDataPath(dataPath);
    setSelectedTeamId(null);
    setTeams([]);
    setTeamError("");

    if (!dataPath) return;

    setTeamLoading(true);
    fetchScrapedTeams(dataPath)
      .then((data) => setTeams(data))
      .catch(() => setTeamError("Failed to load teams."))
      .finally(() => setTeamLoading(false));
  }

  async function handleSubmit() {
    if (!selectedDataPath || selectedTeamId === null) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      await addMyTeam(selectedDataPath, selectedTeamId);
      onAdded();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to add team.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-team-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 id="add-team-dialog-title" className="text-lg font-semibold mb-4">
          Add Team
        </h2>

        {/* League select */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" htmlFor="league-select">
            League
          </label>
          {leagueLoading ? (
            <p className="text-sm text-muted-foreground">Loading leagues...</p>
          ) : leagueError ? (
            <p className="text-sm text-destructive">{leagueError}</p>
          ) : (
            <FormSelect
              id="league-select"
              fullWidth
              value={selectedDataPath}
              onChange={(e) => handleLeagueChange(e.target.value)}
            >
              <option value="">Select a league…</option>
              {leagues.map((lg) => (
                <option key={lg.data_path} value={lg.data_path}>
                  {lg.name}
                </option>
              ))}
            </FormSelect>
          )}
        </div>

        {/* Team select */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1" htmlFor="team-select">
            Team
          </label>
          {teamLoading ? (
            <p className="text-sm text-muted-foreground">Loading teams...</p>
          ) : teamError ? (
            <p className="text-sm text-destructive">{teamError}</p>
          ) : (
            <FormSelect
              id="team-select"
              fullWidth
              value={selectedTeamId ?? ""}
              onChange={(e) =>
                setSelectedTeamId(e.target.value ? Number(e.target.value) : null)
              }
              disabled={!selectedDataPath || teams.length === 0}
            >
              <option value="">Select a team…</option>
              {teams.map((t) => (
                <option key={t.scoresheet_id} value={t.scoresheet_id}>
                  Team #{t.scoresheet_id} — {t.owner_name}
                </option>
              ))}
            </FormSelect>
          )}
        </div>

        {submitError && (
          <p className="text-sm text-destructive mb-4">{submitError}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button ref={cancelButtonRef} variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDataPath || selectedTeamId === null || submitting}
          >
            {submitting ? "Adding…" : "Add Team"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
