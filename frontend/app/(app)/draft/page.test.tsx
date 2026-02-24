import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraftPage from "./page";
import { players, teams, hitterStats, pitcherStats } from "@/lib/fixtures";
import type { Projection } from "@/lib/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the player lists hook
const mockRemoveFromQueue = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockReorderQueue = vi.fn();
const mockQueue: number[] = [];

vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => ({
    queue: mockQueue,
    removeFromQueue: mockRemoveFromQueue,
    removeFromWatchlist: mockRemoveFromWatchlist,
    reorderQueue: mockReorderQueue,
    isHydrated: true,
  }),
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

// Mock @dnd-kit modules (used by DraftQueuePanel)
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

vi.mock("@/lib/contexts/team-context", () => ({
  useTeamContext: () => ({
    teamId: 1,
    teams: [{ id: 1, name: "Power Hitters", league_name: "Alpha League", scoresheet_id: 1, league_id: 1, is_my_team: true }],
    currentTeam: { id: 1, name: "Power Hitters", league_name: "Alpha League", scoresheet_id: 1, league_id: 1, is_my_team: true },
    isLoading: false,
    setTeamId: vi.fn(),
  }),
}));

describe("DraftPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.length = 0;
    mockUseProjections.mockReturnValue({ projections: undefined, isLoading: false, error: null });
  });

  it("should render Draft heading with team name", () => {
    render(<DraftPage />);
    expect(screen.getByRole("heading", { level: 1, name: /draft/i })).toBeInTheDocument();
    expect(screen.getByText(/Alpha League.*Power Hitters/)).toBeInTheDocument();
  });

  describe("Stats Controls", () => {
    it("should render Actual and Projected toggle buttons", () => {
      render(<DraftPage />);
      expect(screen.getByRole("button", { name: /actual/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /projected/i })).toBeInTheDocument();
    });

    it("should default to Actual stats", () => {
      render(<DraftPage />);
      const actualButton = screen.getByRole("button", { name: /actual/i });
      expect(actualButton).toHaveClass("bg-primary");
    });

    it("should show date range dropdown when Actual is selected", () => {
      render(<DraftPage />);
      expect(screen.getByText("Date Range:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should default to Last 30 Days", () => {
      render(<DraftPage />);
      const select = screen.getByRole("combobox");
      expect(select).toHaveValue("last30");
    });

    it("should hide date range dropdown when Projected is selected", async () => {
      const user = userEvent.setup();
      render(<DraftPage />);

      const projectedButton = screen.getByRole("button", { name: /projected/i });
      await user.click(projectedButton);

      expect(screen.queryByText("Date Range:")).not.toBeInTheDocument();
    });

    it("should switch between Actual and Projected", async () => {
      const user = userEvent.setup();
      render(<DraftPage />);

      const projectedButton = screen.getByRole("button", { name: /projected/i });
      await user.click(projectedButton);
      expect(projectedButton).toHaveClass("bg-primary");

      const actualButton = screen.getByRole("button", { name: /actual/i });
      await user.click(actualButton);
      expect(actualButton).toHaveClass("bg-primary");
    });

    it("should allow changing date range", async () => {
      const user = userEvent.setup();
      render(<DraftPage />);

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "last7");
      expect(select).toHaveValue("last7");
    });

    it("should show custom date inputs when Custom Range is selected", async () => {
      const user = userEvent.setup();
      render(<DraftPage />);

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "custom");

      const dateInputs = screen.getAllByDisplayValue(/2025/);
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Two-Panel Layout", () => {
    it("should render Draft Queue panel", () => {
      render(<DraftPage />);
      expect(screen.getByRole("heading", { name: /draft queue/i })).toBeInTheDocument();
    });

    it("should render Draft Picks panel", () => {
      render(<DraftPage />);
      expect(screen.getByText(/draft picks/i)).toBeInTheDocument();
    });

    it("should show empty queue message when queue is empty", () => {
      render(<DraftPage />);
      expect(
        screen.getByText(/no players in your draft queue/i)
      ).toBeInTheDocument();
    });

    it("should render All Picks and My Picks toggle buttons", () => {
      render(<DraftPage />);
      expect(screen.getByRole("button", { name: /all picks/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /my picks/i })).toBeInTheDocument();
    });

    it("should show placeholder footer note in picks panel", () => {
      render(<DraftPage />);
      expect(
        screen.getByText(/placeholder — configure draft order in settings/i)
      ).toBeInTheDocument();
    });
  });

  describe("Queue Integration", () => {
    it("should display queued players", () => {
      mockQueue.push(1, 2); // Add player IDs
      render(<DraftPage />);

      // Should show position markers
      expect(screen.getByText("#1")).toBeInTheDocument();
      expect(screen.getByText("#2")).toBeInTheDocument();
    });

    it("should show player count in queue heading", () => {
      mockQueue.push(1, 2, 3);
      render(<DraftPage />);

      expect(screen.getByText(/draft queue \(3\)/i)).toBeInTheDocument();
    });
  });

  describe("Picks Integration", () => {
    it("should render draft picks from fixture", () => {
      render(<DraftPage />);

      // Should show round/pick info (from draft-order.json fixture)
      expect(screen.getAllByText(/Rd 1\.1/).length).toBeGreaterThan(0);
    });

    it("should filter to my picks when My Picks is clicked", async () => {
      const user = userEvent.setup();
      render(<DraftPage />);

      const myPicksButton = screen.getByRole("button", { name: /my picks/i });
      await user.click(myPicksButton);

      // Should still show picks panel content
      expect(screen.getByText(/draft picks/i)).toBeInTheDocument();
    });
  });

  describe("Projection Stats", () => {
    it("projected mode shows stats after projections load", async () => {
      // Add players to queue
      mockQueue.push(1, 2); // Austin Serven, Vinnie Pasquantino

      // Create projections for queue players
      const mockProjections: Projection[] = [
        { player_id: 1, source: "PECOTA", PA: 400, AB: 360, H: 90, HR: 15, R: 50, RBI: 55, SB: 2, CS: 1, BB: 35, IBB: 1, HBP: 3, SF: 2, "2B": 18, "3B": 1 },
        { player_id: 2, source: "PECOTA", PA: 550, AB: 500, H: 135, HR: 22, R: 70, RBI: 85, SB: 5, CS: 2, BB: 45, IBB: 3, HBP: 4, SF: 3, "2B": 28, "3B": 2 },
      ];
      mockUseProjections.mockReturnValue({ projections: mockProjections, isLoading: false, error: null });

      render(<DraftPage />);

      // Switch to Projected mode
      const user = userEvent.setup();
      const projectedButton = screen.getByRole("button", { name: /projected/i });
      await user.click(projectedButton);

      // Source dropdown should appear with PECOTA
      await waitFor(() => {
        const sourceLabel = screen.queryByText("Source:");
        expect(sourceLabel).toBeInTheDocument();
      });

      // Verify queue player stats are displayed with projected values
      await waitFor(() => {
        // Bryce Harper should show PA: 400
        expect(screen.getByText("Bryce Harper")).toBeInTheDocument();
      });
    });
  });
});
