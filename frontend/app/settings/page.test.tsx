import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "./page";
import type { MyTeam } from "@/lib/types";

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => ({
    currentTeam: { id: 1, name: "Power Hitters", scoresheet_id: 1, league_id: 1, is_my_team: true },
    teams: [],
    teamId: 1,
    isLoading: false,
    setTeamId: vi.fn(),
  }),
}));

vi.mock("swr", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  fetchMyTeams: vi.fn(),
}));

import useSWR from "swr";

const mockTeams: MyTeam[] = [
  {
    id: 1,
    name: "Power Hitters",
    scoresheet_id: 1,
    league_id: 1,
    league_name: "AL Catfish Hunter",
    league_season: 2026,
    role: "owner",
  },
  {
    id: 2,
    name: "Speed Demons",
    scoresheet_id: 2,
    league_id: 2,
    league_name: "NL Gaylord Perry",
    league_season: 2025,
    role: "owner",
  },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({
      data: mockTeams,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSWR>);
  });

  it("renders Settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders section headings for My Teams and Account", () => {
    render(<SettingsPage />);
    expect(screen.getByText("My Teams")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders teams table with name, league, season, and role", () => {
    render(<SettingsPage />);
    // "Speed Demons" only appears in the table (not the header)
    expect(screen.getByText("Speed Demons")).toBeInTheDocument();
    expect(screen.getByText("AL Catfish Hunter")).toBeInTheDocument();
    expect(screen.getByText("NL Gaylord Perry")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("marks the current team with a 'current' badge", () => {
    render(<SettingsPage />);
    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it("renders Add Team button as disabled", () => {
    render(<SettingsPage />);
    const btn = screen.getByRole("button", { name: /add team/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it("renders email and Log Out button", () => {
    render(<SettingsPage />);
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    const logoutBtn = screen.getByRole("button", { name: /log out/i });
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn).toBeDisabled();
  });

  it("renders loading state", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    } as ReturnType<typeof useSWR>);
    render(<SettingsPage />);
    expect(screen.getByText(/loading teams/i)).toBeInTheDocument();
  });

  it("renders empty state when no teams", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSWR>);
    render(<SettingsPage />);
    expect(screen.getByText(/no teams found/i)).toBeInTheDocument();
  });

  it("renders error state on fetch failure", () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fetch failed"),
    } as ReturnType<typeof useSWR>);
    render(<SettingsPage />);
    expect(screen.getByText(/failed to load teams/i)).toBeInTheDocument();
  });
});
