import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftPicksPanel } from "./draft-picks-panel";
import type { DraftPick } from "@/lib/types";

const samplePicks: DraftPick[] = [
  { round: 1, pick_in_round: 1, team_id: 2, team_name: "Ace Pitchers", from_team_name: null, scheduled_time: "2026-03-15T10:00:00-07:00" },
  { round: 1, pick_in_round: 2, team_id: 3, team_name: "Speed Demons", from_team_name: null, scheduled_time: "2026-03-15T11:30:00-07:00" },
  { round: 1, pick_in_round: 3, team_id: 1, team_name: "Power Hitters", from_team_name: null, scheduled_time: "2026-03-16T10:00:00-07:00" },
  { round: 1, pick_in_round: 4, team_id: 4, team_name: "Dingers", from_team_name: "Ace Pitchers", scheduled_time: "2026-03-16T11:30:00-07:00" },
];

const defaultProps = {
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

  it("renders picks with team names", () => {
    render(<DraftPicksPanel {...defaultProps} />);

    expect(screen.getAllByText(/Ace Pitchers/).length).toBeGreaterThan(0);
    expect(screen.getByText("Speed Demons")).toBeInTheDocument();
    expect(screen.getByText(/Power Hitters/)).toBeInTheDocument();
  });

  it("shows 'from Team' for traded picks", () => {
    render(<DraftPicksPanel {...defaultProps} />);
    expect(screen.getByText(/\(from Ace Pitchers\)/)).toBeInTheDocument();
  });

  it("filters to only my picks in 'mine' mode", () => {
    render(<DraftPicksPanel {...defaultProps} filterMode="mine" />);

    expect(screen.getByText(/Power Hitters/)).toBeInTheDocument();
    expect(screen.queryByText("Speed Demons")).not.toBeInTheDocument();
  });

  it("highlights my team's picks", () => {
    render(<DraftPicksPanel {...defaultProps} />);

    const powerHittersText = screen.getByText(/Power Hitters/);
    const powerHittersPick = powerHittersText.closest("div.bg-primary\\/10");
    expect(powerHittersPick).toBeInTheDocument();
    expect(powerHittersPick).toHaveClass("border-l-2");
    expect(powerHittersPick).toHaveClass("border-primary");
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
    expect(screen.getAllByText(/Ace Pitchers/).length).toBeGreaterThan(0);
  });
});
