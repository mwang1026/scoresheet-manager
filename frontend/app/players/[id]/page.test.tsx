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

  it("renders custom date range pickers", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    const fromInput = screen.getByLabelText(/from:/i);
    const toInput = screen.getByLabelText(/to:/i);

    expect(fromInput).toBeInTheDocument();
    expect(toInput).toBeInTheDocument();
    expect(fromInput).toHaveValue("2025-04-01");
    expect(toInput).toHaveValue("2025-09-30");
  });

  it("renders custom date range row in stats table", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    // Custom row should show with formatted date range (flexible matching)
    expect(screen.getByText(/Custom/)).toBeInTheDocument();
  });

  it("updates custom date range when inputs change", async () => {
    const user = userEvent.setup();
    render(<PlayerDetailPage params={{ id: "1" }} />);

    const fromInput = screen.getByLabelText(/from:/i);
    const toInput = screen.getByLabelText(/to:/i);

    await user.clear(fromInput);
    await user.type(fromInput, "2025-05-01");

    await user.clear(toInput);
    await user.type(toInput, "2025-08-31");

    expect(fromInput).toHaveValue("2025-05-01");
    expect(toInput).toHaveValue("2025-08-31");
    // Check that custom text is still present (date format updated)
    expect(screen.getByText(/Custom/)).toBeInTheDocument();
  });

  it("renders projection rows for hitter with projections", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    // Player 1 has a Steamer projection
    expect(screen.getByText("Proj (Steamer)")).toBeInTheDocument();
  });

  it("renders projection rows for pitcher with projections", () => {
    render(<PlayerDetailPage params={{ id: "14" }} />);

    // Player 14 (Garrett Crochet) has a Steamer projection
    expect(screen.getByText("Proj (Steamer)")).toBeInTheDocument();
  });

  it("does not render projection rows for players without projections", () => {
    // Player 4 or another player without projections in fixtures
    render(<PlayerDetailPage params={{ id: "4" }} />);

    // Should not have any projection rows
    expect(screen.queryByText(/Proj \(/)).not.toBeInTheDocument();
  });

  it("renders historical season rows", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
  });

  it("renders stats rows in correct order", () => {
    render(<PlayerDetailPage params={{ id: "1" }} />);

    const rows = screen.getAllByRole("row");
    const rowTexts = rows.map((row) => row.textContent);

    // Find indices of key rows (skip header row at index 0)
    const customIndex = rowTexts.findIndex((text) => text?.includes("Custom"));
    const last7Index = rowTexts.findIndex((text) => text?.includes("Last 7"));
    const last14Index = rowTexts.findIndex((text) => text?.includes("Last 14"));
    const last30Index = rowTexts.findIndex((text) => text?.includes("Last 30"));
    const seasonIndex = rowTexts.findIndex((text) => text === "Season" || text?.startsWith("Season"));
    const projIndex = rowTexts.findIndex((text) => text?.includes("Proj ("));
    const y2024Index = rowTexts.findIndex((text) => text === "2024" || text?.startsWith("2024"));
    const y2023Index = rowTexts.findIndex((text) => text === "2023" || text?.startsWith("2023"));
    const y2022Index = rowTexts.findIndex((text) => text === "2022" || text?.startsWith("2022"));

    // Verify order: Custom < Last 7 < Last 14 < Last 30 < Season < Proj < 2024 < 2023 < 2022
    expect(customIndex).toBeLessThan(last7Index);
    expect(last7Index).toBeLessThan(last14Index);
    expect(last14Index).toBeLessThan(last30Index);
    expect(last30Index).toBeLessThan(seasonIndex);
    expect(seasonIndex).toBeLessThan(projIndex);
    expect(projIndex).toBeLessThan(y2024Index);
    expect(y2024Index).toBeLessThan(y2023Index);
    expect(y2023Index).toBeLessThan(y2022Index);
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
