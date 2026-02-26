import { ExternalLink } from "lucide-react";
import type { DraftPick } from "@/lib/types";
import { formatDateTime, isWithinHours } from "@/lib/format";

interface DraftTimelineProps {
  picks: DraftPick[];
  teamId: number | undefined;
  scoresheetDataPath: string | null | undefined;
  scoresheetTeamId: number | undefined;
}

export function DraftTimeline({
  picks,
  teamId,
  scoresheetDataPath,
  scoresheetTeamId,
}: DraftTimelineProps) {
  const upcomingPicks = teamId
    ? picks
        .filter((p) => p.team_id === teamId)
        .slice(0, 5)
    : [];

  const transactionsUrl =
    scoresheetDataPath && scoresheetTeamId != null
      ? `https://www.scoresheet.com/htm-lib/picks.htm?dir_lgw=/${scoresheetDataPath};all;team_n=${scoresheetTeamId}#now`
      : null;

  return (
    <div className="border rounded-lg">
      <div className="p-4 bg-brand text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Draft Timeline</h2>
          {transactionsUrl && (
            <a
              href={transactionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white border border-white/30 rounded px-2 py-1"
            >
              Scoresheet Draft
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
      <div className="p-4">
        {upcomingPicks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming picks for your team.
          </p>
        ) : (
          <div className="space-y-1">
            {upcomingPicks.map((pick) => {
              const urgent = isWithinHours(pick.scheduled_time, 24);
              return (
                <div
                  key={`${pick.round}-${pick.pick_in_round}`}
                  className={`border-l-2 pl-3 py-1.5 rounded-r text-sm ${
                    urgent
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500"
                      : "border-muted"
                  }`}
                >
                  <span className="font-medium">
                    Round {pick.round}, Pick {pick.pick_in_round}
                  </span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {formatDateTime(pick.scheduled_time)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
