import { ExternalLink } from "lucide-react";
import { SectionPanel } from "@/components/ui/section-panel";
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

  const actionSlot = transactionsUrl ? (
    <a
      href={transactionsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
    >
      Scoresheet Draft
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  ) : undefined;

  return (
    <SectionPanel title="Draft Timeline" action={actionSlot}>
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
                      ? "bg-brand/10 border-brand"
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
    </SectionPanel>
  );
}
