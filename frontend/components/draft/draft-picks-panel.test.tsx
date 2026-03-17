import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftPicksPanel } from "./draft-picks-panel";
import type { DraftPick, Team } from "@/lib/types";

const sampleTeams: Team[] = [
  { id: 1, name: "Power Hitters", scoresheet_id: 1, league_id: 1, league_name: "Test League", is_my_team: true },
  { id: 2, name: "Ace Pitchers", scoresheet_id: 2, league_id: 1, league_name: "Test League", is_my_team: false },
  { id: 3, name: "Speed Demons", scoresheet_id: 3, league_id: 1, league_name: "Test League", is_my_team: false },
  { id: 4, name: "Dingers", scoresheet_id: 4, league_id: 1, league_name: "Test League", is_my_team: false },
];

const samplePicks: DraftPick[] = [
  { round: 1, pick_in_round: 1, team_id: 2, team_name: "Ace Pitchers", from_team_name: null, scheduled_time: "2026-03-15T10:00:00-07:00" },
  { round: 1, pick_in_round: 2, team_id: 3, team_name: "Speed Demons", from_team_name: null, scheduled_time: "2026-03-15T11:30:00-07:00" },
  { round: 1, pick_in_round: 3, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2026-03-16T10:00:00-07:00" },
  { round: 1, pick_in_round: 4, team_id: 4, team_name: "Dingers", from_team_name: "Ace Pitchers", scheduled_time: "2026-03-16T11:30:00-07:00" },
];

const defaultProps = {
  teams: sampleTeams,
  picks: samplePicks,
  myTeamId: 1,
  filterMode: "all" as const,
  onFilterChange: vi.fn(),
  draftComplete: false,
  lastScrapedAt: new Date().toISOString(),
  onRefresh: vi.fn().mockResolvedValue(undefined),
  isRefreshing: false,
};

describe("DraftPicksPanel", () => {
  it("renders the header", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    expect(screen.getByText("Draft Picks")).toBeInTheDocument();
  });

  it("renders filter toggle buttons", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    expect(screen.getByText("All Picks")).toBeInTheDocument();
    expect(screen.getByText("My Picks")).toBeInTheDocument();
  });

  it("renders picks with abbreviated team names", () => {
    render(<DraftPicksPanel {...defaultProps} />);

    expect(screen.getAllByText(/Team #2/).length).toBeGreaterThan(0); // Ace Pitchers → Team #2
    expect(screen.getByText("Team #3")).toBeInTheDocument();          // Speed Demons → Team #3
    expect(screen.getByText(/Team #1/)).toBeInTheDocument();          // Power Hitters → Team #1
  });

  it("shows abbreviated 'from Team' for traded picks", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    expect(screen.getByText(/\(from Team #2\)/)).toBeInTheDocument(); // from Ace Pitchers → from Team #2
  });

  it("falls back to full name when team not in teams list", () => {
    render(<DraftPicksPanel {...defaultProps} teams={[]} />);

    // Without teams mapping, full names should display
    expect(screen.getAllByText(/Ace Pitchers/).length).toBeGreaterThan(0);
    expect(screen.getByText("Speed Demons")).toBeInTheDocument();
  });

  it("filters to only my picks in 'mine' mode", () => {
    render(<DraftPicksPanel {...defaultProps} filterMode="mine" />);

    expect(screen.getByText(/Team #1/)).toBeInTheDocument();          // Power Hitters
    expect(screen.queryByText("Team #3")).not.toBeInTheDocument();     // Speed Demons filtered out
  });

  it("highlights my team's picks", () => {
    render(<DraftPicksPanel {...defaultProps} />);

    const myTeamText = screen.getByText(/Team #1/);
    const myTeamPick = myTeamText.closest("div.bg-brand\\/10");
    expect(myTeamPick).toBeInTheDocument();
    expect(myTeamPick).toHaveClass("border-l-2");
    expect(myTeamPick).toHaveClass("border-brand");
  });

  it("calls onFilterChange when toggling", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    render(<DraftPicksPanel {...defaultProps} filterMode="all" onFilterChange={onFilterChange} />);

    await user.click(screen.getByText("My Picks"));
    expect(onFilterChange).toHaveBeenCalledWith("mine");
  });

  it("displays round info", () => {
    render(<DraftPicksPanel {...defaultProps} />);

    expect(screen.getByText("Rd 1.1")).toBeInTheDocument();
    expect(screen.getByText("Rd 1.3")).toBeInTheDocument();
  });

  it("displays date and time for picks", () => {
    render(<DraftPicksPanel {...defaultProps} />);

    const mar15Elements = screen.getAllByText(/Mar 15/);
    const mar16Elements = screen.getAllByText(/Mar 16/);
    expect(mar15Elements.length).toBeGreaterThan(0);
    expect(mar16Elements.length).toBeGreaterThan(0);
  });

  it("shows Refresh button", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
  });

  it("calls onRefresh when Refresh is clicked", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DraftPicksPanel {...defaultProps} onRefresh={onRefresh} />);

    await user.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows 'Refreshing...' when isRefreshing is true", () => {
    render(<DraftPicksPanel {...defaultProps} isRefreshing={true} />);

    const btn = screen.getByRole("button", { name: /refreshing/i });
    expect(btn).toBeDisabled();
  });

  it("shows last updated time", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it("shows 'Never updated' when lastScrapedAt is null", () => {
    render(<DraftPicksPanel {...defaultProps} lastScrapedAt={null} />);
    expect(screen.getByText("Never updated")).toBeInTheDocument();
  });

  it("shows Draft Complete when draft_complete is true", () => {
    render(<DraftPicksPanel {...defaultProps} draftComplete={true} picks={[]} />);
    expect(screen.getByText("Draft Complete")).toBeInTheDocument();
  });

  it("shows 'No active draft' for empty picks when not complete", () => {
    render(<DraftPicksPanel {...defaultProps} picks={[]} />);
    expect(screen.getByText("No active draft")).toBeInTheDocument();
  });

  it("handles missing myTeamId gracefully", () => {
    render(<DraftPicksPanel {...defaultProps} myTeamId={undefined} />);
    expect(screen.getByText("Draft Picks")).toBeInTheDocument();
    expect(screen.getAllByText(/Team #2/).length).toBeGreaterThan(0);
  });

  it("shows picks remaining badge for my team", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    // Team 1 has 1 pick in samplePicks
    expect(screen.getByText("1 picks left")).toBeInTheDocument();
  });

  it("shows correct count with multiple picks for my team", () => {
    const extraPicks: DraftPick[] = [
      ...samplePicks,
      { round: 2, pick_in_round: 1, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2026-03-17T10:00:00-07:00" },
    ];
    render(<DraftPicksPanel {...defaultProps} picks={extraPicks} />);
    expect(screen.getByText("2 picks left")).toBeInTheDocument();
  });

  it("hides badge when no myTeamId", () => {
    render(<DraftPicksPanel {...defaultProps} myTeamId={undefined} />);
    expect(screen.queryByText(/picks left/)).not.toBeInTheDocument();
  });

  it("hides badge when no picks remain for my team", () => {
    const otherPicks = samplePicks.filter((p) => p.team_id !== 1);
    render(<DraftPicksPanel {...defaultProps} picks={otherPicks} />);
    expect(screen.queryByText(/picks left/)).not.toBeInTheDocument();
  });
});
