import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayersPage from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/players",
}));

describe("PlayersPage", () => {
  it("should render Players heading", () => {
    render(<PlayersPage />);
    expect(screen.getByRole("heading", { name: /players/i })).toBeInTheDocument();
  });

  it("should render PlayersTable", () => {
    render(<PlayersPage />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
  });

  it("should render hitter columns including HR, R, RBI, SB, CS", () => {
    render(<PlayersPage />);
    // Default tab is hitters
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.getByText("RBI")).toBeInTheDocument();
    expect(screen.getByText("SB")).toBeInTheDocument();
    expect(screen.getByText("CS")).toBeInTheDocument();
    // R appears in both hitter and pitcher tables, just check it exists
    expect(screen.getByText("R")).toBeInTheDocument();
  });
});
