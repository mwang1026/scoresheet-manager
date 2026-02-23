"use client";

import useSWR from "swr";
import { useTeamContext } from "@/lib/contexts/team-context";
import { Button } from "@/components/ui/button";
import { fetchMyTeams } from "@/lib/api";
import type { MyTeam } from "@/lib/types";

export default function SettingsPage() {
  const { currentTeam } = useTeamContext();
  const {
    data: myTeams,
    isLoading,
    error,
  } = useSWR<MyTeam[]>("me/teams", fetchMyTeams, {
    revalidateOnFocus: false,
  });

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <h1 className="text-4xl font-bold">Settings</h1>
        <span className="text-4xl font-bold text-brand-blue">
          {currentTeam ? `${currentTeam.league_name} | ${currentTeam.name}` : ""}
        </span>
      </div>

      {/* My Teams */}
      <section className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">My Teams</h2>
          <Button variant="outline" size="sm" disabled>
            Add Team
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading teams...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load teams.</p>
        ) : !myTeams || myTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">Team</th>
                <th className="pb-2 font-medium">League</th>
                <th className="pb-2 font-medium tabular-nums">Season</th>
                <th className="pb-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {myTeams.map((team) => (
                <tr
                  key={team.id}
                  className={team.id === currentTeam?.id ? "bg-brand-blue/5" : ""}
                >
                  <td className="py-2 pr-4">
                    <span>{team.name}</span>
                    {team.id === currentTeam?.id && (
                      <span className="ml-2 text-xs text-brand-blue font-medium">
                        current
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{team.league_name}</td>
                  <td className="py-2 pr-4 tabular-nums">{team.league_season}</td>
                  <td className="py-2">{team.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Account */}
      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">user@example.com</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Session</span>
            <Button variant="destructive" size="sm" disabled>
              Log Out
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
