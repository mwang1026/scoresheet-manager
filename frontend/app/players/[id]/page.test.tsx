import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import PlayerDetailPage from "./page";
import { useRouter } from "next/navigation";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock player lists hook
vi.mock("@/lib/hooks/use-player-lists", () => ({
  usePlayerLists: () => ({
    isWatchlisted: () => false,
    isInQueue: () => false,
    toggleWatchlist: vi.fn(),
    toggleQueue: vi.fn(),
    isHydrated: true,
  }),
}));

describe("PlayerDetailPage", () => {
  const mockRouter = {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter as Partial<AppRouterInstance> as AppRouterInstance);
  });

  it("renders back button", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);
    const backButton = screen.getByRole("button", { name: /back to players/i });
    expect(backButton).toBeInTheDocument();
  });

  it("navigates back when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<PlayerDetailPage params={{ id: "1" }} />);

    const backButton = screen.getByRole("button", { name: /back to players/i });
    await user.click(backButton);

    expect(mockRouter.back).toHaveBeenCalledOnce();
  });

  it("renders player header for hitter", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    expect(screen.getByText("Austin Serven")).toBeInTheDocument();
    expect(screen.getByText(/Position:/)).toBeInTheDocument();
    expect(screen.getByText(/Eligible:/)).toBeInTheDocument();
    expect(screen.getByText(/MLB Team:/)).toBeInTheDocument();
    expect(screen.getByText(/Fantasy Team:/)).toBeInTheDocument();
  });

  it("renders player header for pitcher", () => {
    render(<PlayerDetailPage params={{ id: "14" }} />);

    expect(screen.getByText("Garrett Crochet")).toBeInTheDocument();
    expect(screen.getByText(/Position:/)).toBeInTheDocument();
    expect(screen.getByText(/MLB Team:/)).toBeInTheDocument();
  });

  it("renders stats table for hitter", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    // Check for hitter stat columns
    expect(screen.getByText("PA")).toBeInTheDocument();
    expect(screen.getByText("AB")).toBeInTheDocument();
    expect(screen.getByText("AVG")).toBeInTheDocument();
    expect(screen.getByText("OPS")).toBeInTheDocument();

    // Check for date range rows
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("Last 30")).toBeInTheDocument();
    expect(screen.getByText("Last 14")).toBeInTheDocument();
    expect(screen.getByText("Last 7")).toBeInTheDocument();
  });

  it("renders stats table for pitcher", () => {
    render(<PlayerDetailPage params={{ id: "14" }} />);

    // Check for pitcher stat columns
    expect(screen.getByText("IP")).toBeInTheDocument();
    expect(screen.getByText("ERA")).toBeInTheDocument();
    expect(screen.getByText("WHIP")).toBeInTheDocument();
    expect(screen.getByText("K/9")).toBeInTheDocument();

    // Check for date range rows
    expect(screen.getByText("Season")).toBeInTheDocument();
    expect(screen.getByText("Last 30")).toBeInTheDocument();
    expect(screen.getByText("Last 14")).toBeInTheDocument();
    expect(screen.getByText("Last 7")).toBeInTheDocument();
  });

  it("renders watchlist toggle button", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);
    expect(screen.getByRole("button", { name: /add to watchlist/i })).toBeInTheDocument();
  });

  it("renders queue toggle button", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);
    expect(screen.getByRole("button", { name: /add to queue/i })).toBeInTheDocument();
  });

  it("shows not found message for invalid player ID", () => {
    render(<PlayerDetailPage params={{ id: "9999" }} />);
    expect(screen.getByText("Player not found")).toBeInTheDocument();
  });
});
