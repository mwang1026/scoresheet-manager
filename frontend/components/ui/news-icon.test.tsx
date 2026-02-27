import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsIcon } from "./news-icon";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the news data hook
vi.mock("@/lib/hooks/use-news-data", () => ({
  usePlayerNews: () => ({ news: [], isLoading: false, error: null }),
}));

describe("NewsIcon", () => {
  it("renders nothing when hasNews is false", () => {
    const { container } = render(<NewsIcon playerId={1} hasNews={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders newspaper icon when hasNews is true", () => {
    render(<NewsIcon playerId={1} hasNews={true} />);
    // The icon renders an SVG inside a span
    const span = document.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("cursor-pointer");
  });

  it("uses amber color for news icon", () => {
    render(<NewsIcon playerId={1} hasNews={true} />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("text-amber-500");
  });
});
