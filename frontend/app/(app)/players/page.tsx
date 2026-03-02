"use client";

import { Suspense } from "react";
import { PlayersTable } from "@/components/players/players-table";
import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function PlayersPage() {
  return (
    <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-8">
      <PageHeader title="Players" />
      <Suspense
        fallback={
          <TableSkeleton rows={20} columns={15} />
        }
      >
        <PlayersTable />
      </Suspense>
    </div>
  );
}
