"use client";

import { Suspense } from "react";
import { PlayersTable } from "@/components/players/players-table";
import { teams } from "@/lib/fixtures";

export default function PlayersPage() {
  const myTeam = teams.find((t) => t.is_my_team);

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <h1 className="text-4xl font-bold">Players</h1>
        <span className="text-4xl font-bold text-brand-blue">{myTeam?.name ?? "Power Hitters"}</span>
      </div>
      <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
        <PlayersTable />
      </Suspense>
    </div>
  );
}
