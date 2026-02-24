import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OpponentsPage from "./page";

// Mock the OpponentsGrid component to avoid needing to mock all data hooks
vi.mock("@/components/opponents/opponents-grid", () => ({
  OpponentsGrid: () => <div data-testid="opponents-grid">Opponents Grid</div>,
}));

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => ({
    currentTeam: { id: 1, name: "Power Hitters", scoresheet_id: 1, league_id: 1, is_my_team: true },
    teams: [],
    teamId: 1,
    isLoading: false,
    setTeamId: vi.fn(),
  }),
}));

describe("OpponentsPage", () => {
  it("renders the Opponents heading", () => {
    render(<OpponentsPage />);
    expect(screen.getByRole("heading", { name: /opponents/i })).toBeInTheDocument();
  });

  it("renders the OpponentsGrid component", () => {
    render(<OpponentsPage />);
    expect(screen.getByTestId("opponents-grid")).toBeInTheDocument();
  });
});
