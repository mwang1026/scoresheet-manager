"use client";

import { useTeamContext } from "@/lib/contexts/team-context";

export function TeamSwitcher() {
  const { teams, currentTeam, isLoading, setTeamId } = useTeamContext();

  if (isLoading) {
    return <p className="text-sm text-brand-blue">Loading...</p>;
  }

  if (teams.length <= 1) {
    return (
      <p className="text-sm text-brand-blue">
        {currentTeam
          ? `${currentTeam.league_name} \u2014 ${currentTeam.name}`
          : ""}
      </p>
    );
  }

  return (
    <select
      aria-label="Switch team"
      value={currentTeam?.id ?? ""}
      onChange={(e) => setTeamId(Number(e.target.value))}
      className="text-sm text-brand-blue bg-transparent border-none outline-none cursor-pointer w-full"
    >
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.league_name} &mdash; {team.name}
        </option>
      ))}
    </select>
  );
}
