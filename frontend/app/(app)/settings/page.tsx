"use client";

import { useState, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useSession, signOut } from "next-auth/react";
import { useTeamContext } from "@/lib/contexts/team-context";
import { useSettingsContext } from "@/lib/contexts/settings-context";
import { usePageDefaults } from "@/lib/hooks/use-page-defaults";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddTeamDialog } from "@/components/settings/add-team-dialog";
import { fetchMyTeams, removeMyTeam } from "@/lib/api";
import type { MyTeam } from "@/lib/types";
import type { DateRangePreset, SortPreference } from "@/lib/settings-types";
import { DEFAULT_HITTER_SORT, DEFAULT_PITCHER_SORT, getSeasonalDefaults } from "@/lib/defaults";
import { SORT_COLUMNS_BY_PAGE } from "@/lib/sort-columns";

type StatsSourceOption = "default" | "actual" | "projected";
type DateRangeOption = DateRangePreset;

interface SortSelectProps {
  value: SortPreference | null;
  columns: string[];
  defaultSort: { column: string; direction: "asc" | "desc" };
  onChange: (value: SortPreference | null) => void;
  label: string;
}

function SortSelect({ value, columns, defaultSort, onChange, label }: SortSelectProps) {
  const colValue = value?.column ?? "default";
  const dirValue = value?.direction ?? "default";

  const handleColumnChange = (col: string) => {
    if (col === "default") {
      onChange(null);
    } else {
      onChange({ column: col, direction: dirValue as "asc" | "desc" | "default" });
    }
  };

  const handleDirChange = (dir: string) => {
    if (colValue === "default") {
      onChange(null);
    } else {
      onChange({ column: colValue, direction: dir as "asc" | "desc" | "default" });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground w-48">{label}</span>
      <select
        value={colValue}
        onChange={(e) => handleColumnChange(e.target.value)}
        className="px-2 py-1 border rounded text-sm"
      >
        <option value="default">Default ({defaultSort.column})</option>
        {columns.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select
        value={dirValue}
        onChange={(e) => handleDirChange(e.target.value)}
        className="px-2 py-1 border rounded text-sm"
      >
        <option value="default">Default ({defaultSort.direction})</option>
        <option value="desc">Desc</option>
        <option value="asc">Asc</option>
      </select>
    </div>
  );
}

interface PageDefaultsSectionProps {
  page: "dashboard" | "players" | "opponents" | "draft";
  title: string;
}

function PageDefaultsSection({ page, title }: PageDefaultsSectionProps) {
  const { settings, updatePageSettings } = useSettingsContext();
  const resolved = usePageDefaults(page);
  const seasonal = getSeasonalDefaults(new Date());
  const pageSettings = settings[page];

  const sourceLabel = seasonal.statsSource === "projected" ? "Projected" : "Actual";
  const rangeLabel = (() => {
    const r = seasonal.dateRanges[page];
    if (!r) return "Season";
    switch (r.type) {
      case "wtd": return "WTD";
      case "season": return "Season";
      case "last30": return "Last 30";
      case "last7": return "Last 7";
      case "last14": return "Last 14";
      default: return "Season";
    }
  })();

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-base">{title}</h3>

      {/* Stats Source */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-48">Stats Source</span>
        <select
          value={pageSettings.statsSource}
          onChange={(e) =>
            updatePageSettings(page, { statsSource: e.target.value as StatsSourceOption })
          }
          className="px-2 py-1 border rounded text-sm"
        >
          <option value="default">Default ({sourceLabel})</option>
          <option value="actual">Actual</option>
          <option value="projected">Projected</option>
        </select>
        {pageSettings.statsSource !== "default" && (
          <span className="text-xs text-muted-foreground">overrides seasonal default</span>
        )}
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-48">Date Range</span>
        <select
          value={pageSettings.dateRange}
          onChange={(e) =>
            updatePageSettings(page, { dateRange: e.target.value as DateRangeOption })
          }
          className="px-2 py-1 border rounded text-sm"
        >
          <option value="default">Default ({rangeLabel})</option>
          <option value="season">Season to Date</option>
          <option value="wtd">Week to Date</option>
          <option value="last7">Last 7 Days</option>
          <option value="last14">Last 14 Days</option>
          <option value="last30">Last 30 Days</option>
        </select>
      </div>

      {/* Sort overrides for Dashboard */}
      {page === "dashboard" && (
        <>
          <SortSelect
            label="Roster Hitters Sort"
            value={settings.dashboard.rosterHittersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.dashboard.hitter]}
            defaultSort={DEFAULT_HITTER_SORT}
            onChange={(v) => updatePageSettings("dashboard", { rosterHittersSort: v })}
          />
          <SortSelect
            label="Roster Pitchers Sort"
            value={settings.dashboard.rosterPitchersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.dashboard.pitcher]}
            defaultSort={DEFAULT_PITCHER_SORT}
            onChange={(v) => updatePageSettings("dashboard", { rosterPitchersSort: v })}
          />
          <SortSelect
            label="Watchlist Hitters Sort"
            value={settings.dashboard.watchlistHittersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.dashboard.hitter]}
            defaultSort={DEFAULT_HITTER_SORT}
            onChange={(v) => updatePageSettings("dashboard", { watchlistHittersSort: v })}
          />
          <SortSelect
            label="Watchlist Pitchers Sort"
            value={settings.dashboard.watchlistPitchersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.dashboard.pitcher]}
            defaultSort={DEFAULT_PITCHER_SORT}
            onChange={(v) => updatePageSettings("dashboard", { watchlistPitchersSort: v })}
          />
        </>
      )}

      {/* Sort overrides for Players */}
      {page === "players" && (
        <>
          <SortSelect
            label="Hitters Sort"
            value={settings.players.hittersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.players.hitter]}
            defaultSort={resolved.hitterSort}
            onChange={(v) => updatePageSettings("players", { hittersSort: v })}
          />
          <SortSelect
            label="Pitchers Sort"
            value={settings.players.pitchersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.players.pitcher]}
            defaultSort={resolved.pitcherSort}
            onChange={(v) => updatePageSettings("players", { pitchersSort: v })}
          />
        </>
      )}

      {/* Sort overrides for Opponents */}
      {page === "opponents" && (
        <>
          <SortSelect
            label="Hitters Sort"
            value={settings.opponents.hittersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.opponents.hitter]}
            defaultSort={resolved.hitterSort}
            onChange={(v) => updatePageSettings("opponents", { hittersSort: v })}
          />
          <SortSelect
            label="Pitchers Sort"
            value={settings.opponents.pitchersSort}
            columns={[...SORT_COLUMNS_BY_PAGE.opponents.pitcher]}
            defaultSort={resolved.pitcherSort}
            onChange={(v) => updatePageSettings("opponents", { pitchersSort: v })}
          />
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { currentTeam } = useTeamContext();
  const { resetSettings } = useSettingsContext();
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();
  const {
    data: myTeams,
    isLoading,
    error,
  } = useSWR<MyTeam[]>("me/teams", fetchMyTeams, {
    revalidateOnFocus: false,
  });

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MyTeam | null>(null);
  const [removeError, setRemoveError] = useState("");

  const handleRemoveConfirm = useCallback(async () => {
    if (!removeTarget) return;
    setRemoveError("");
    try {
      await removeMyTeam(removeTarget.id);
      setRemoveTarget(null);
      mutate("me/teams");
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove team.");
    }
  }, [removeTarget, mutate]);

  const showRemoveButtons = (myTeams?.length ?? 0) > 1;

  return (
    <div className="p-8 space-y-8">
      <PageHeader title="Settings" />

      {/* Account */}
      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{session?.user?.email ?? ""}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Session</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Log Out
            </Button>
          </div>
        </div>
      </section>

      {/* My Teams */}
      <section className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">My Teams</h2>
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
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
                {showRemoveButtons && <th className="pb-2 font-medium" />}
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
                  {showRemoveButtons && (
                    <td className="py-2 pl-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setRemoveError("");
                          setRemoveTarget(team);
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {removeError && (
          <p className="text-sm text-destructive mt-2">{removeError}</p>
        )}
      </section>

      {/* Defaults */}
      <section className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Defaults</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSettings}
          >
            Reset All to Defaults
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Seasonal defaults apply automatically based on the baseball calendar: projected stats
          during preseason, actuals during the season. Override per-page below.
        </p>

        <div className="space-y-8">
          <PageDefaultsSection page="dashboard" title="Dashboard" />
          <PageDefaultsSection page="players" title="Players" />
          <PageDefaultsSection page="opponents" title="Opponents" />
          <PageDefaultsSection page="draft" title="Draft" />
        </div>
      </section>

      {/* Add Team Dialog */}
      <AddTeamDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdded={() => mutate("me/teams")}
      />

      {/* Remove Team Confirm Dialog */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove Team"
        description={
          removeTarget
            ? `Remove "${removeTarget.name}" from your teams? This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
