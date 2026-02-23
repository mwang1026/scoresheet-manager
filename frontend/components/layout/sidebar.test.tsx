import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
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

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("should render nav element with aria-label", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    expect(nav).toBeInTheDocument();
  });

  it("should render all 5 navigation links", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /draft/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /opponents/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("should highlight active route with aria-current", () => {
    mockUsePathname.mockReturnValue("/");

    render(<Sidebar />);
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("should only mark / as active on exact match", () => {
    mockUsePathname.mockReturnValue("/players");

    render(<Sidebar />);
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).not.toHaveAttribute("aria-current");

    const playersLink = screen.getByRole("link", { name: /players/i });
    expect(playersLink).toHaveAttribute("aria-current", "page");
  });

  it("should highlight /players when on /players/123", () => {
    mockUsePathname.mockReturnValue("/players/123");

    render(<Sidebar />);
    const playersLink = screen.getByRole("link", { name: /players/i });
    expect(playersLink).toHaveAttribute("aria-current", "page");
  });

  it("should render app title", () => {
    render(<Sidebar />);
    expect(screen.getByText("Scoresheet Manager")).toBeInTheDocument();
  });

  it("should have correct href attributes", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /players/i })).toHaveAttribute("href", "/players");
    expect(screen.getByRole("link", { name: /draft/i })).toHaveAttribute("href", "/draft");
    expect(screen.getByRole("link", { name: /opponents/i })).toHaveAttribute("href", "/opponents");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
  });
});
