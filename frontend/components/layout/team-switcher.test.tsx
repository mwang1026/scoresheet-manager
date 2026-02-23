import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamSwitcher } from "./team-switcher";

const mockSetTeamId = vi.fn();

function mockContext(overrides: object) {
  vi.mock("@/lib/contexts/team-context", () => ({
    useTeamContext: () => ({
      teams: [],
      currentTeam: null,
      isLoading: false,
      setTeamId: mockSetTeamId,
      teamId: null,
      ...overrides,
    }),
  }));
}

// We use vi.mock at the top level and override per-test via different module setups.
// Instead, we'll use a factory pattern with a mutable config object.

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
const teamB = { id: 2, name: "Sluggers", league_name: "Beta League", scoresheet_id: 2, league_id: 2, is_my_team: false };

describe("TeamSwitcher", () => {
  it("shows loading state", () => {
    contextState.isLoading = true;
    contextState.teams = [];
    contextState.currentTeam = null;

    render(<TeamSwitcher />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows static text when single team", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    expect(screen.getByText("Alpha League \u2014 Power Hitters")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders dropdown when multiple teams", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    expect(screen.getByRole("combobox", { name: /switch team/i })).toBeInTheDocument();
  });

  it("formats options as 'League — Team'", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;

    render(<TeamSwitcher />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("Alpha League");
    expect(options[0].textContent).toContain("Power Hitters");
    expect(options[1].textContent).toContain("Beta League");
    expect(options[1].textContent).toContain("Sluggers");
  });

  it("calls setTeamId when selection changes", () => {
    contextState.isLoading = false;
    contextState.teams = [teamA, teamB];
    contextState.currentTeam = teamA;
    mockSetTeamId.mockClear();

    render(<TeamSwitcher />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "2" } });
    expect(mockSetTeamId).toHaveBeenCalledWith(2);
  });
});
