"use client";

import { PageHeader } from "@/components/layout/page-header";
import { OpponentsGrid } from "@/components/opponents/opponents-grid";

export default function OpponentsPage() {
  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Opponents" />
      <OpponentsGrid />
    </div>
  );
}
