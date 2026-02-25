import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useSession, signOut } from "next-auth/react";
import SettingsPage from "./page";
import type { MyTeam } from "@/lib/types";

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => ({
    currentTeam: { id: 1, name: "Power Hitters", scoresheet_id: 1, league_id: 1, league_name: "AL Catfish Hunter", is_my_team: true },
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

  it("renders header with league name and team name as separate text nodes", () => {
    render(<SettingsPage />);
    expect(screen.getAllByText("AL Catfish Hunter").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Power Hitters").length).toBeGreaterThanOrEqual(1);
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
    // "AL Catfish Hunter" appears in both header and table cell
    expect(screen.getAllByText("AL Catfish Hunter").length).toBeGreaterThanOrEqual(1);
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

  it("shows email from session and enabled Log Out button", () => {
    // Global mock returns test@example.com
    render(<SettingsPage />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    const logoutBtn = screen.getByRole("button", { name: /log out/i });
    expect(logoutBtn).toBeInTheDocument();
    expect(logoutBtn).not.toBeDisabled();
  });

  it("calls signOut when Log Out is clicked", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("shows empty email when not authenticated", () => {
    vi.mocked(useSession).mockReturnValueOnce({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });
    render(<SettingsPage />);
    // Email span should be empty
    const emailSpan = screen.getAllByRole("generic").find(
      (el) => el.tagName === "SPAN" && el.textContent === ""
    );
    expect(emailSpan).toBeDefined();
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

  it("renders sort dropdowns for Dashboard, Players, and Opponents sections", () => {
    render(<SettingsPage />);
    // Dashboard has Roster Hitters Sort, Roster Pitchers Sort, Watchlist Hitters Sort, Watchlist Pitchers Sort
    expect(screen.getByText("Roster Hitters Sort")).toBeInTheDocument();
    expect(screen.getByText("Roster Pitchers Sort")).toBeInTheDocument();
    expect(screen.getByText("Watchlist Hitters Sort")).toBeInTheDocument();
    expect(screen.getByText("Watchlist Pitchers Sort")).toBeInTheDocument();
    // Players and Opponents both have "Hitters Sort" and "Pitchers Sort"
    const hittersSortLabels = screen.getAllByText("Hitters Sort");
    expect(hittersSortLabels.length).toBe(2); // Players + Opponents
    const pitchersSortLabels = screen.getAllByText("Pitchers Sort");
    expect(pitchersSortLabels.length).toBe(2); // Players + Opponents
  });

  it("dashboard sort dropdowns do not include Players-only columns (PA, AB, H, CS)", () => {
    render(<SettingsPage />);
    // Find the Roster Hitters Sort select by its label
    const label = screen.getByText("Roster Hitters Sort");
    // The select is the next sibling element (inside the flex container)
    const container = label.parentElement!;
    const selects = container.querySelectorAll("select");
    // First select is the column select
    const columnSelect = selects[0];
    const optionValues = Array.from(columnSelect.options).map((o) => o.value);
    // Dashboard/compact tables do NOT have PA, AB, H, CS
    expect(optionValues).not.toContain("PA");
    expect(optionValues).not.toContain("AB");
    expect(optionValues).not.toContain("H");
    expect(optionValues).not.toContain("CS");
    // But do have OPS, HR, R, etc.
    expect(optionValues).toContain("OPS");
    expect(optionValues).toContain("HR");
  });

  it("players sort dropdown includes extended columns (PA, AB, H, CS)", () => {
    render(<SettingsPage />);
    // Find "Hitters Sort" labels — there are two (Players + Opponents)
    const hittersSortLabels = screen.getAllByText("Hitters Sort");
    // The Players section comes before Opponents in the DOM
    const playersLabel = hittersSortLabels[0];
    const container = playersLabel.parentElement!;
    const selects = container.querySelectorAll("select");
    const columnSelect = selects[0];
    const optionValues = Array.from(columnSelect.options).map((o) => o.value);
    // Players page includes PA, AB, H, CS
    expect(optionValues).toContain("PA");
    expect(optionValues).toContain("AB");
    expect(optionValues).toContain("H");
    expect(optionValues).toContain("CS");
  });
});
