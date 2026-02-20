"use client";

import { teams } from "@/lib/fixtures";

export default function OpponentsPage() {
  const myTeam = teams.find((t) => t.is_my_team);

  return (
    <div className="p-8">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <h1 className="text-4xl font-bold">Opponents</h1>
        <span className="text-4xl font-bold text-brand-blue">{myTeam?.name ?? "Power Hitters"}</span>
      </div>
    </div>
  );
}
