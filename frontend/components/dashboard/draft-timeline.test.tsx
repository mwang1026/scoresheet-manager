import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraftTimeline } from "./draft-timeline";
import type { DraftPick } from "@/lib/types";

// Sample picks matching team 1 (Power Hitters)
const samplePicks: DraftPick[] = [
  { round: 1, pick_in_round: 3, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2025-03-15T13:00:00-07:00" },
  { round: 2, pick_in_round: 8, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2025-03-16T10:00:00-07:00" },
  { round: 3, pick_in_round: 3, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2025-03-17T13:00:00-07:00" },
  { round: 4, pick_in_round: 8, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2025-03-18T10:00:00-07:00" },
  // Other team picks
  { round: 1, pick_in_round: 1, team_id: 2, team_name: "Sluggers", from_team_name: null, scheduled_time: "2025-03-15T10:00:00-07:00" },
  { round: 1, pick_in_round: 2, team_id: 3, team_name: "Aces", from_team_name: null, scheduled_time: "2025-03-15T11:30:00-07:00" },
];

describe("DraftTimeline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath="FOR_WWW1/AL_Catfish_Hunter"
        scoresheetTeamId={1}
      />
    );
    expect(screen.getByText("Draft Timeline")).toBeInTheDocument();
  });

  it("shows picks for given team", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );
    // Team 1 has 4 picks: R1P3, R2P8, R3P3, R4P8
    expect(screen.getByText("Round 1, Pick 3")).toBeInTheDocument();
    expect(screen.getByText("Round 2, Pick 8")).toBeInTheDocument();
    expect(screen.getByText("Round 3, Pick 3")).toBeInTheDocument();
    expect(screen.getByText("Round 4, Pick 8")).toBeInTheDocument();
  });

  it("fewer than 5 picks shows all available", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );
    // Team 1 has exactly 4 picks — all 4 display
    const pickEntries = screen.getAllByText(/^Round \d, Pick \d+$/);
    expect(pickEntries).toHaveLength(4);
  });

  it("displays formatted date/time", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );
    // Each pick row contains the date/time after an em dash
    const dateTexts = screen.getAllByText(
      /— [A-Z][a-z]{2} \d{1,2}, \d{2}:\d{2} \(.+\)/
    );
    expect(dateTexts.length).toBeGreaterThanOrEqual(4);
  });

  it("highlights picks within 24 hours with amber", () => {
    // Team 1's first pick: 2025-03-15T13:00:00-07:00
    // Set now to 12 hours before that pick
    const pickTime = new Date("2025-03-15T13:00:00-07:00").getTime();
    vi.spyOn(Date, "now").mockReturnValue(pickTime - 12 * 3600000);

    const { container } = render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );

    // First pick (R1P3) should have amber highlight
    const amberElements = container.querySelectorAll(".border-amber-500");
    expect(amberElements.length).toBeGreaterThanOrEqual(1);

    // Last pick (R4P8 on Mar 18) should NOT have amber — it's ~3 days away
    const allBorders = container.querySelectorAll(".border-muted");
    expect(allBorders.length).toBeGreaterThanOrEqual(1);
  });

  it("has no amber highlight when all picks are far away", () => {
    // Default Date.now() is far from 2025-03-15 fixture dates
    const { container } = render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );

    const amberElements = container.querySelectorAll(".border-amber-500");
    expect(amberElements).toHaveLength(0);
  });

  it("shows empty state when no teamId", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={undefined}
        scoresheetDataPath={null}
        scoresheetTeamId={undefined}
      />
    );
    expect(
      screen.getByText("No upcoming picks for your team.")
    ).toBeInTheDocument();
  });

  it("shows empty state when picks array is empty", () => {
    render(
      <DraftTimeline
        picks={[]}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );
    expect(
      screen.getByText("No upcoming picks for your team.")
    ).toBeInTheDocument();
  });

  it("renders external link button when scoresheetDataPath is present", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath="FOR_WWW1/AL_Catfish_Hunter"
        scoresheetTeamId={1}
      />
    );

    const link = screen.getByText("Scoresheet Draft").closest("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("href")).toBe(
      "https://www.scoresheet.com/htm-lib/picks.htm?dir_lgw=/FOR_WWW1/AL_Catfish_Hunter;all;team_n=1#now"
    );
  });

  it("does not render external link when scoresheetDataPath is null", () => {
    render(
      <DraftTimeline
        picks={samplePicks}
        teamId={1}
        scoresheetDataPath={null}
        scoresheetTeamId={1}
      />
    );

    expect(
      screen.queryByText("Scoresheet Draft")
    ).not.toBeInTheDocument();
  });
});
