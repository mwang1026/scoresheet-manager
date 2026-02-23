import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamSwitcher } from "./team-switcher";

const mockSetTeamId = vi.fn();

const contextState = {
  teams: [] as { id: number; name: string; league_name: string; scoresheet_id: number; league_id: number; is_my_team: boolean }[],
  currentTeam: null as { id: number; name: string; league_name: string; scoresheet_id: number; league_id: number; is_my_team: boolean } | null,
  isLoading: false,
  setTeamId: mockSetTeamId,
  teamId: null as number | null,
};

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => contextState,
}));

const teamA = { id: 1, name: "Power Hitters", league_name: "Alpha League", scoresheet_id: 1, league_id: 1, is_my_team: true };
const teamB = { id: 2, name: "Sluggers", league_name: "Beta League", scoresheet_id: 2, league_id: 2, is_my_team: true };

describe("TeamSwitcher", () => {
  it("shows loading state", () => {
    contextState.isLoading = true;
    contextState.teams = [];
    contextState.currentTeam = null;

    render(<TeamSwitcher />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows static two-line text when single team", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    expect(screen.getByText("Alpha League")).toBeInTheDocument();
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch team/i })).not.toBeInTheDocument();
  });

  it("renders switch button when multiple teams", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    expect(screen.getByRole("button", { name: /switch team/i })).toBeInTheDocument();
  });

  it("shows current team in two-line format on the toggle button", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    expect(screen.getByText("Alpha League")).toBeInTheDocument();
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
  });

  it("opens dropdown with all teams on button click", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    // Second team not visible before opening
    expect(screen.queryByText("Sluggers")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));

    expect(screen.getByText("Beta League")).toBeInTheDocument();
    expect(screen.getByText("Sluggers")).toBeInTheDocument();
  });

  it("calls setTeamId when a dropdown item is clicked", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;
    mockSetTeamId.mockClear();

    render(<TeamSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));
    fireEvent.click(screen.getByText("Sluggers"));
    expect(mockSetTeamId).toHaveBeenCalledWith(2);
  });
});
