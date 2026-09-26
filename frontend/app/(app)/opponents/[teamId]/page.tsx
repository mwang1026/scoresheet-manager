"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TeamDetail } from "@/components/opponents/team-detail";
import { useTeams } from "@/lib/hooks/use-players-data";

export default function TeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = Number(params?.teamId);
  const { teams } = useTeams();
  const team = teams?.find((t) => t.id === teamId);

  return (
    <div className="px-3 py-6 sm:px-6 lg:px-8 space-y-6">
      <PageHeader title={team ? team.name : "Team"} />
      {Number.isInteger(teamId) && teamId > 0 ? (
        <TeamDetail teamId={teamId} />
      ) : (
        <p className="text-destructive">Invalid team id.</p>
      )}
    </div>
  );
}
