import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "./page";

// Mock the usePlayerLists hook
const mockToggleWatchlist = vi.fn();
const mockToggleQueue = vi.fn();
const mockUsePlayerLists = vi.fn(() => ({
  watchlist: new Set<number>(),
  queue: new Set<number>(),
  toggleWatchlist: mockToggleWatchlist,
  toggleQueue: mockToggleQueue,
  isHydrated: true,
}));

vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => mockUsePlayerLists(),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    mockToggleWatchlist.mockClear();
    mockToggleQueue.mockClear();
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set<number>(),
      queue: new Set<number>(),
      toggleWatchlist: mockToggleWatchlist,
      toggleQueue: mockToggleQueue,
      isHydrated: true,
    });
  });

  it("should render Team Dashboard heading", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: /team dashboard/i })).toBeInTheDocument();
  });

  it("should render team name in subtitle", () => {
    render(<DashboardPage />);
    // "Power Hitters" is the team with is_my_team: true in fixtures
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
  });

  it("should render all main section headings", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Team Stats Summary")).toBeInTheDocument();
    expect(screen.getByText(/My Roster/)).toBeInTheDocument();
    expect(screen.getByText(/Watchlist/)).toBeInTheDocument();
    expect(screen.getByText(/Draft Queue/)).toBeInTheDocument();
    expect(screen.getByText("Draft Timeline")).toBeInTheDocument();
    expect(screen.getByText("Recent News")).toBeInTheDocument();
  });

  it("should render roster players from my team", () => {
    render(<DashboardPage />);
    // Based on fixtures, team_id: 1 (Power Hitters) has these players
    expect(screen.getByText("Austin Serven")).toBeInTheDocument();
    expect(screen.getByText("Vinnie Pasquantino")).toBeInTheDocument();
    expect(screen.getByText("Jose Altuve")).toBeInTheDocument();
    expect(screen.getByText("Bobby Witt Jr.")).toBeInTheDocument();
    expect(screen.getByText("Randy Arozarena")).toBeInTheDocument();
    expect(screen.getByText("Garrett Crochet")).toBeInTheDocument();
  });

  it("should show empty watchlist message when no players watchlisted", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/No players on your watchlist yet/)
    ).toBeInTheDocument();
  });

  it("should show watchlist players when watchlist has items", () => {
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set([7]), // Randy Arozarena
      queue: new Set<number>(),
      toggleWatchlist: mockToggleWatchlist,
      toggleQueue: mockToggleQueue,
      isHydrated: true,
    });

    render(<DashboardPage />);
    // Randy Arozarena should appear in watchlist (appears twice: roster + watchlist)
    expect(screen.getAllByText("Randy Arozarena").length).toBeGreaterThan(0);
    // Should not show empty message
    expect(
      screen.queryByText(/No players on your watchlist yet/)
    ).not.toBeInTheDocument();
  });

  it("should show empty queue message when queue is empty", () => {
    render(<DashboardPage />);
    expect(screen.getByText("No players in your draft queue.")).toBeInTheDocument();
  });

  it("should show queued players when queue has items", () => {
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set<number>(),
      queue: new Set([7, 8]), // Randy Arozarena, Jose Ramirez
      toggleWatchlist: mockToggleWatchlist,
      toggleQueue: mockToggleQueue,
      isHydrated: true,
    });

    render(<DashboardPage />);
    // Randy Arozarena should appear (twice: roster + queue)
    expect(screen.getAllByText("Randy Arozarena").length).toBeGreaterThan(0);
    // Jose Ramirez should appear in queue
    expect(screen.getByText("Jose Ramirez")).toBeInTheDocument();
  });

  it("should link player names to detail pages", () => {
    render(<DashboardPage />);
    // Check roster player link
    const link = screen.getAllByRole("link", { name: "Austin Serven" })[0];
    expect(link).toHaveAttribute("href", "/players/1");
  });

  it("should call toggleWatchlist when removing from watchlist", async () => {
    const user = userEvent.setup();
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set([7]), // Randy Arozarena
      queue: new Set<number>(),
      toggleWatchlist: mockToggleWatchlist,
      toggleQueue: mockToggleQueue,
      isHydrated: true,
    });

    render(<DashboardPage />);
    const removeButton = screen.getByLabelText("Remove Randy Arozarena from watchlist");
    await user.click(removeButton);
    expect(mockToggleWatchlist).toHaveBeenCalledWith(7);
  });

  it("should call toggleQueue when removing from queue", async () => {
    const user = userEvent.setup();
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set<number>(),
      queue: new Set([7]), // Randy Arozarena
      toggleWatchlist: mockToggleWatchlist,
      toggleQueue: mockToggleQueue,
      isHydrated: true,
    });

    render(<DashboardPage />);
    const removeButton = screen.getByLabelText("Remove Randy Arozarena from queue");
    await user.click(removeButton);
    expect(mockToggleQueue).toHaveBeenCalledWith(7);
  });

  it("should render team stats with hitting and pitching", () => {
    render(<DashboardPage />);
    // Check for some key stat labels
    expect(screen.getByText("Hitting")).toBeInTheDocument();
    expect(screen.getByText("Pitching")).toBeInTheDocument();
  });

  it("should render placeholder sections for draft timeline and news", () => {
    render(<DashboardPage />);
    expect(
      screen.getByText(/Placeholder - connect draft schedule in Settings/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Placeholder - news integration coming soon/)
    ).toBeInTheDocument();
  });
});
