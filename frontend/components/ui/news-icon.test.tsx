import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NewsIcon } from "./news-icon";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock the news data hook with controllable return value
const mockUsePlayerNews = vi.fn();
vi.mock("@/lib/hooks/use-news-data", () => ({
  usePlayerNews: (...args: unknown[]) => mockUsePlayerNews(...args),
}));

const sampleNews = [
  {
    id: 1,
    headline: "Player traded to new team",
    body: "Details about the trade",
    source: "RotoWire",
    published_at: new Date().toISOString(),
  },
];

describe("NewsIcon", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUsePlayerNews.mockReturnValue({ news: [], isLoading: false, error: null });
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when hasNews is false", () => {
    const { container } = render(<NewsIcon playerId={1} hasNews={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders newspaper icon when hasNews is true", () => {
    render(<NewsIcon playerId={1} hasNews={true} />);
    const span = document.querySelector("span");
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("cursor-pointer");
  });

  it("uses amber color for news icon", () => {
    render(<NewsIcon playerId={1} hasNews={true} />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("text-amber-500");
  });

  it("does not show tooltip while data is loading", () => {
    mockUsePlayerNews.mockReturnValue({ news: [], isLoading: true, error: null });
    render(<NewsIcon playerId={1} hasNews={true} />);

    const span = document.querySelector("span")!;
    fireEvent.mouseEnter(span);
    act(() => { vi.advanceTimersByTime(200); });

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByText("No recent news")).not.toBeInTheDocument();
  });

  it("shows tooltip when hovering and data is ready", () => {
    mockUsePlayerNews.mockReturnValue({ news: sampleNews, isLoading: false, error: null });
    render(<NewsIcon playerId={1} hasNews={true} />);

    const span = document.querySelector("span")!;
    fireEvent.mouseEnter(span);
    act(() => { vi.advanceTimersByTime(200); });

    expect(screen.getByText("Player traded to new team")).toBeInTheDocument();
  });

  it("hides tooltip on mouseLeave", () => {
    mockUsePlayerNews.mockReturnValue({ news: sampleNews, isLoading: false, error: null });
    render(<NewsIcon playerId={1} hasNews={true} />);

    const span = document.querySelector("span")!;
    fireEvent.mouseEnter(span);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("Player traded to new team")).toBeInTheDocument();

    fireEvent.mouseLeave(span);
    expect(screen.queryByText("Player traded to new team")).not.toBeInTheDocument();
  });

  it("cancels tooltip when mouseLeave occurs before delay", () => {
    mockUsePlayerNews.mockReturnValue({ news: sampleNews, isLoading: false, error: null });
    render(<NewsIcon playerId={1} hasNews={true} />);

    const span = document.querySelector("span")!;
    fireEvent.mouseEnter(span);
    act(() => { vi.advanceTimersByTime(100); }); // Only 100ms, not 200
    fireEvent.mouseLeave(span);
    act(() => { vi.advanceTimersByTime(200); });

    expect(screen.queryByText("Player traded to new team")).not.toBeInTheDocument();
  });
});
