import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TeamDetailPage from "./page";

let mockTeamIdParam = "2";
vi.mock("next/navigation", () => ({
  useParams: () => ({ teamId: mockTeamIdParam }),
}));

vi.mock("@/components/opponents/team-detail", () => ({
  TeamDetail: ({ teamId }: { teamId: number }) => <div data-testid="team-detail">team {teamId}</div>,
}));

vi.mock("@/lib/hooks/use-players-data", () => ({
  useTeams: () => ({
    teams: [{ id: 2, name: "Los Alamos Atoms", scoresheet_id: 2, league_id: 1, league_name: "L", is_my_team: false }],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => ({
    currentTeam: { id: 1, name: "Power Hitters", league_name: "L", scoresheet_id: 1, league_id: 1, is_my_team: true },
    teams: [],
    teamId: 1,
    isLoading: false,
    setTeamId: vi.fn(),
  }),
}));

describe("TeamDetailPage", () => {
  it("renders the team name heading and the detail component for a valid id", () => {
    mockTeamIdParam = "2";
    render(<TeamDetailPage />);
    expect(screen.getByRole("heading", { name: "Los Alamos Atoms" })).toBeInTheDocument();
    expect(screen.getByTestId("team-detail")).toHaveTextContent("team 2");
  });

  it("rejects a non-numeric id", () => {
    mockTeamIdParam = "abc";
    render(<TeamDetailPage />);
    expect(screen.getByText("Invalid team id.")).toBeInTheDocument();
    expect(screen.queryByTestId("team-detail")).not.toBeInTheDocument();
  });
});
