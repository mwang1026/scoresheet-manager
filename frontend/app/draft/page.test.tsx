import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DraftPage from "./page";

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

describe("DraftPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.length = 0;
  });

  it("should render Draft heading with team name", () => {
    render(<DraftPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/draft/i);
    expect(heading).toHaveTextContent(/power hitters/i);
  });

  it("should render description", () => {
    render(<DraftPage />);
    expect(
      screen.getByText(/prepare draft queue and track upcoming picks/i)
    ).toBeInTheDocument();
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
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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
});
