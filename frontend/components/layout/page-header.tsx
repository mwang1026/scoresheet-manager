"use client";

import { useTeamContext } from "@/lib/contexts/team-context";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const { currentTeam } = useTeamContext();

  return (
    <div className="flex justify-between items-baseline flex-wrap gap-2">
      <h1 className="text-4xl font-bold">{title}</h1>
      {currentTeam && (
        <span className="text-4xl font-bold text-brand-blue">
          {currentTeam.league_name} &mdash; {currentTeam.name}
        </span>
      )}
    </div>
  );
}
