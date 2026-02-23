import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

const contextState = {
  currentTeam: null as { id: number; name: string; league_name: string; scoresheet_id: number; league_id: number; is_my_team: boolean } | null,
};

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => contextState,
}));

describe("PageHeader", () => {
  it("renders the page title", () => {
    contextState.currentTeam = null;
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders league and team in 'League — Team' format", () => {
    contextState.currentTeam = {
      id: 1,
      name: "Power Hitters",
      league_name: "Alpha League",
      scoresheet_id: 1,
      league_id: 1,
      is_my_team: true,
    };
    render(<PageHeader title="Players" />);
    expect(screen.getByText(/Alpha League/)).toBeInTheDocument();
    expect(screen.getByText(/Power Hitters/)).toBeInTheDocument();
  });

  it("hides team span when currentTeam is null", () => {
    contextState.currentTeam = null;
    render(<PageHeader title="Opponents" />);
    // No team text should appear
    expect(screen.queryByText(/\u2014/)).not.toBeInTheDocument();
  });
});
