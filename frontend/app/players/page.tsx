import { Suspense } from "react";
import { PlayersTable } from "@/components/players/players-table";

export default function PlayersPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and filter all players with stats.
        </p>
      </div>
      <div className="flex-1 overflow-hidden p-6">
        <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
          <PlayersTable />
        </Suspense>
      </div>
    </div>
  );
}
