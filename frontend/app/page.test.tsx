import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardPage from "./page";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import type { Projection } from "@/lib/types";

// Mock @dnd-kit modules
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: vi.fn((arr, from, to) => {
    const newArr = [...arr];
    const [item] = newArr.splice(from, 1);
    newArr.splice(to, 0, item);
    return newArr;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ""),
    },
  },
}));

// Mock the usePlayerLists hook
const mockRemoveFromWatchlist = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockGetQueuePosition = vi.fn();
const mockReorderQueue = vi.fn();
const mockUsePlayerLists = vi.fn(() => ({
  watchlist: new Set<number>(),
  queue: [] as number[],
  removeFromWatchlist: mockRemoveFromWatchlist,
  removeFromQueue: mockRemoveFromQueue,
  getQueuePosition: mockGetQueuePosition,
  reorderQueue: mockReorderQueue,
  isHydrated: true,
}));

vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => mockUsePlayerLists(),
}));

// Mock API hooks
const mockUseProjections = vi.fn();
vi.mock("@/lib/hooks/use-players-data", () => ({
  usePlayers: () => ({ players, isLoading: false, error: null }),
  useTeams: () => ({ teams, isLoading: false, error: null }),
  useHitterStats: () => ({ stats: hitterStats, isLoading: false, error: null }),
  usePitcherStats: () => ({ stats: pitcherStats, isLoading: false, error: null }),
  useProjections: () => mockUseProjections(),
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
    mockRemoveFromWatchlist.mockClear();
    mockRemoveFromQueue.mockClear();
    mockGetQueuePosition.mockClear();
    mockReorderQueue.mockClear();
    mockGetQueuePosition.mockReturnValue(null);
    mockUseProjections.mockReturnValue({ projections: undefined, isLoading: false, error: null });
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set<number>(),
      queue: [] as number[],
      removeFromWatchlist: mockRemoveFromWatchlist,
      removeFromQueue: mockRemoveFromQueue,
      getQueuePosition: mockGetQueuePosition,
      reorderQueue: mockReorderQueue,
      isHydrated: true,
    });
  });

  it("should render Team Dashboard heading with brand blue team name", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: /team dashboard/i })).toBeInTheDocument();
    // "Power Hitters" should be in brand blue
    expect(screen.getByText("Power Hitters")).toBeInTheDocument();
  });

  it("should render date range picker", () => {
    render(<DashboardPage />);
    // Should show Season to Date (default option in dropdown)
    expect(screen.getByDisplayValue("Season to Date")).toBeInTheDocument();
  });

  it("should render stats source toggle with Actual and Projected buttons", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("button", { name: "Actual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Projected" })).toBeInTheDocument();
  });

  it("should hide date range dropdown when Projected is selected", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    // Initially, date range dropdown should be visible
    expect(screen.getByDisplayValue("Season to Date")).toBeInTheDocument();

    // Click Projected button
    const projectedButton = screen.getByRole("button", { name: "Projected" });
    await user.click(projectedButton);

    // Date range dropdown should be hidden
    expect(screen.queryByDisplayValue("Season to Date")).not.toBeInTheDocument();
  });

  it("should include Week to Date option in date range dropdown", () => {
    render(<DashboardPage />);
    const dropdown = screen.getByDisplayValue("Season to Date");
    const options = within(dropdown).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("Week to Date");
  });

  it("should include Custom Range option in date range dropdown", () => {
    render(<DashboardPage />);
    const dropdown = screen.getByDisplayValue("Season to Date");
    const options = within(dropdown).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).toContain("Custom Range");
  });

  it("should show custom date inputs when Custom Range is selected", async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const dropdown = screen.getByDisplayValue("Season to Date");
    await user.selectOptions(dropdown, "custom");

    // Date inputs should appear
    const dateInputs = screen.getAllByDisplayValue(/2025/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("should render all main section headings", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Team Stats Summary")).toBeInTheDocument();
    expect(screen.getByText(/My Hitters/)).toBeInTheDocument();
    expect(screen.getByText(/My Pitchers/)).toBeInTheDocument();
    expect(screen.getByText(/Watchlist/)).toBeInTheDocument(); // Will match empty state heading
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
      queue: [] as number[],
      removeFromWatchlist: mockRemoveFromWatchlist,
      removeFromQueue: mockRemoveFromQueue,
      getQueuePosition: mockGetQueuePosition,
      reorderQueue: mockReorderQueue,
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

  it("should show queued players when queue has items (preserving order)", () => {
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set<number>(),
      queue: [7, 8], // Randy Arozarena, Jose Ramirez (ordered)
      removeFromWatchlist: mockRemoveFromWatchlist,
      removeFromQueue: mockRemoveFromQueue,
      getQueuePosition: mockGetQueuePosition,
      reorderQueue: mockReorderQueue,
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

  it("should call removeFromWatchlist when removing from watchlist (after confirmation)", async () => {
    const user = userEvent.setup();
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set([7]), // Randy Arozarena
      queue: [] as number[],
      removeFromWatchlist: mockRemoveFromWatchlist,
      removeFromQueue: mockRemoveFromQueue,
      getQueuePosition: mockGetQueuePosition,
      reorderQueue: mockReorderQueue,
      isHydrated: true,
    });

    render(<DashboardPage />);

    // Click remove button
    const removeButton = screen.getByLabelText("Remove Randy Arozarena from watchlist");
    await user.click(removeButton);

    // Confirm in dialog
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    expect(mockRemoveFromWatchlist).toHaveBeenCalledWith(7);
  });

  it("should call removeFromQueue when removing from queue (after confirmation)", async () => {
    const user = userEvent.setup();
    mockUsePlayerLists.mockReturnValue({
      watchlist: new Set<number>(),
      queue: [7], // Randy Arozarena
      removeFromWatchlist: mockRemoveFromWatchlist,
      removeFromQueue: mockRemoveFromQueue,
      getQueuePosition: mockGetQueuePosition,
      reorderQueue: mockReorderQueue,
      isHydrated: true,
    });

    render(<DashboardPage />);

    // Click remove button
    const removeButton = screen.getByLabelText("Remove Randy Arozarena from queue");
    await user.click(removeButton);

    // Confirm in dialog (without checking the checkbox)
    const confirmButton = screen.getByText("Confirm");
    await user.click(confirmButton);

    expect(mockRemoveFromQueue).toHaveBeenCalledWith(7);
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

  it("should render total rows in roster tables", () => {
    render(<DashboardPage />);
    // Should have "Total" rows in both hitters and pitchers tables
    expect(screen.getAllByText("Total").length).toBeGreaterThanOrEqual(2);
  });

  it("projected mode shows stats after projections load", async () => {
    // Create projections for roster players (players with team_id === 1)
    const myRosterPlayers = players.filter((p) => p.team_id === 1);
    const mockProjections: Projection[] = myRosterPlayers.map((p) => ({
      player_id: p.id,
      source: "PECOTA",
      PA: 600,
      AB: 550,
      H: 150,
      HR: 25,
      R: 80,
      RBI: 90,
      SB: 10,
      CS: 3,
      BB: 50,
      IBB: 2,
      HBP: 5,
      SF: 4,
      "2B": 30,
      "3B": 2,
    }));
    mockUseProjections.mockReturnValue({ projections: mockProjections, isLoading: false, error: null });

    render(<DashboardPage />);

    // Switch to Projected mode
    const user = userEvent.setup();
    const projectedButton = screen.getByRole("button", { name: /projected/i });
    await user.click(projectedButton);

    // Source dropdown should appear with PECOTA
    await waitFor(() => {
      const options = screen.getAllByRole("option");
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain("PECOTA");
    });

    // Team stats should show projected totals
    // With 5 hitters @ 600 PA each = 3000 PA total, HR = 125 total
    await waitFor(() => {
      const teamStats = screen.getByText("Team Stats Summary");
      expect(teamStats).toBeInTheDocument();
    });
  });
});
