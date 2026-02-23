"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import type { Team } from "@/lib/types";
import { fetchTeams, setApiTeamId } from "@/lib/api";

interface TeamContextValue {
  teamId: number | null;
  teams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  setTeamId: (id: number) => void;
}

const TeamContext = createContext<TeamContextValue>({
  teamId: null,
  teams: [],
  currentTeam: null,
  isLoading: true,
  setTeamId: () => {},
});

export function useTeamContext(): TeamContextValue {
  return useContext(TeamContext);
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage on mount
  const [teamId, setTeamIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("scoresheet-team-id");
    return stored ? parseInt(stored, 10) : null;
  });

  // Keep api.ts in sync whenever teamId changes
  useEffect(() => {
    setApiTeamId(teamId);
  }, [teamId]);

  // Fetch teams — key includes teamId so is_my_team recomputes on team switch
  const swrKey = teamId !== null ? ["teams", teamId] : "teams";
  const { data: teamsData, isLoading } = useSWR<Team[]>(swrKey, () => fetchTeams(), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const teams = teamsData ?? [];

  // Once teams load, set a valid teamId if current one is null or invalid
  useEffect(() => {
    if (teams.length === 0) return;
    const teamExists = teamId !== null && teams.some((t) => t.id === teamId);
    if (!teamExists) {
      const defaultTeam = teams.find((t) => t.is_my_team) ?? teams[0];
      if (defaultTeam) {
        setTeamIdState(defaultTeam.id);
        if (typeof window !== "undefined") {
          localStorage.setItem("scoresheet-team-id", String(defaultTeam.id));
        }
      }
    }
  }, [teams, teamId]);

  const currentTeam = useMemo(
    () => teams.find((t) => t.id === teamId) ?? null,
    [teams, teamId]
  );

  const setTeamId = (id: number) => {
    setTeamIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("scoresheet-team-id", String(id));
    }
  };

  return (
    <TeamContext.Provider value={{ teamId, teams, currentTeam, isLoading, setTeamId }}>
      {children}
    </TeamContext.Provider>
  );
}
