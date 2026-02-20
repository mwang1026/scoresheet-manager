import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DraftPicksPanel } from "./draft-picks-panel";
import { type DraftPick, type Team } from "@/lib/fixtures/types";

describe("DraftPicksPanel", () => {
  const mockTeams: Team[] = [
    { id: 1, name: "Power Hitters", scoresheet_team_id: "PHI01", is_my_team: true },
    { id: 2, name: "Ace Pitchers", scoresheet_team_id: "ACE01", is_my_team: false },
    { id: 3, name: "Speed Demons", scoresheet_team_id: "SPD01", is_my_team: false },
  ];

  const mockPicks: DraftPick[] = [
    {
      pick_number: 1,
      round: 1,
      pick_in_round: 1,
      team_id: 2,
      player_id: null,
      scheduled_time: "2025-03-15T10:00:00-07:00",
    },
    {
      pick_number: 2,
      round: 1,
      pick_in_round: 2,
      team_id: 3,
      player_id: null,
      scheduled_time: "2025-03-15T11:30:00-07:00",
    },
    {
      pick_number: 3,
      round: 1,
      pick_in_round: 3,
      team_id: 1,
      player_id: null,
      scheduled_time: "2025-03-16T10:00:00-07:00",
    },
    {
      pick_number: 4,
      round: 1,
      pick_in_round: 4,
      team_id: 2,
      player_id: null,
      scheduled_time: "2025-03-16T11:30:00-07:00",
    },
  ];

  it("renders the header", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    expect(screen.getByText("Draft Picks")).toBeInTheDocument();
  });

  it("renders filter toggle buttons", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    expect(screen.getByText("All Picks")).toBeInTheDocument();
    expect(screen.getByText("My Picks")).toBeInTheDocument();
  });

  it("renders all picks in 'all' mode", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    expect(screen.getAllByText("Ace Pitchers").length).toBeGreaterThan(0);
    expect(screen.getByText("Speed Demons")).toBeInTheDocument();
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
  });

  it("filters to only my picks in 'mine' mode", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="mine"
        onFilterChange={onFilterChange}
      />
    );

    // Should only show Power Hitters (team_id 1)
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
    expect(screen.queryByText("Ace Pitchers")).not.toBeInTheDocument();
    expect(screen.queryByText("Speed Demons")).not.toBeInTheDocument();
  });

  it("highlights my team's picks", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    // Find the Power Hitters pick element - need to traverse up to the outer container div
    const powerHittersText = screen.getByText("Power Hitters");
    const powerHittersPick = powerHittersText.closest("div.bg-primary\\/10");
    expect(powerHittersPick).toBeInTheDocument();
    expect(powerHittersPick).toHaveClass("border-l-2");
    expect(powerHittersPick).toHaveClass("border-primary");
  });

  it("calls onFilterChange when toggling to 'all'", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="mine"
        onFilterChange={onFilterChange}
      />
    );

    await user.click(screen.getByText("All Picks"));
    expect(onFilterChange).toHaveBeenCalledWith("all");
  });

  it("calls onFilterChange when toggling to 'mine'", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    await user.click(screen.getByText("My Picks"));
    expect(onFilterChange).toHaveBeenCalledWith("mine");
  });

  it("displays round info", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    expect(screen.getByText("Rd 1.1")).toBeInTheDocument();
    expect(screen.getByText("Rd 1.3")).toBeInTheDocument();
  });

  it("displays date and time for picks", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    // Should show dates for both Mar 15 and Mar 16
    const mar15Elements = screen.getAllByText(/Mar 15/);
    const mar16Elements = screen.getAllByText(/Mar 16/);
    expect(mar15Elements.length).toBeGreaterThan(0);
    expect(mar16Elements.length).toBeGreaterThan(0);
  });

  it("renders footer note", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={1}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    expect(
      screen.getByText("Placeholder — configure draft order in Settings")
    ).toBeInTheDocument();
  });

  it("handles missing myTeamId gracefully", () => {
    const onFilterChange = vi.fn();
    render(
      <DraftPicksPanel
        picks={mockPicks}
        teams={mockTeams}
        myTeamId={undefined}
        filterMode="all"
        onFilterChange={onFilterChange}
      />
    );

    // Should still render without errors
    expect(screen.getByText("Draft Picks")).toBeInTheDocument();
    expect(screen.getAllByText("Ace Pitchers").length).toBeGreaterThan(0);
  });
});
