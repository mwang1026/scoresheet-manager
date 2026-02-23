"use client";

import { useTeamContext } from "@/lib/contexts/team-context";

export default function OpponentsPage() {
  const { currentTeam } = useTeamContext();

  return (
    <div className="p-8">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <h1 className="text-4xl font-bold">Opponents</h1>
        <span className="text-4xl font-bold text-brand-blue">{currentTeam?.name ?? "Power Hitters"}</span>
      </div>
    </div>
  );
}
