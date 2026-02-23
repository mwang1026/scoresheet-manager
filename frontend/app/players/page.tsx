"use client";

import { Suspense } from "react";
import { PlayersTable } from "@/components/players/players-table";
import { PageHeader } from "@/components/layout/page-header";

export default function PlayersPage() {
  return (
    <div className="p-8 space-y-8">
      <PageHeader title="Players" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">Loading...</div>
        }
      >
        <PlayersTable />
      </Suspense>
    </div>
  );
}
