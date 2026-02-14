import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsFeed } from "./news-feed";

describe("NewsFeed", () => {
  it("should render recent news heading", () => {
    render(<NewsFeed />);
    expect(screen.getByText("Recent News")).toBeInTheDocument();
  });

  it("should render dummy news headlines", () => {
    render(<NewsFeed />);
    expect(screen.getByText(/Aaron Judge hits 2 home runs/)).toBeInTheDocument();
    expect(screen.getByText(/Shohei Ohtani expected to return/)).toBeInTheDocument();
    expect(screen.getByText(/Fernando Tatis Jr. placed on 10-day IL/)).toBeInTheDocument();
  });

  it("should render source and time for each headline", () => {
    render(<NewsFeed />);
    expect(screen.getByText(/ESPN/)).toBeInTheDocument();
    expect(screen.getByText(/MLB.com/)).toBeInTheDocument();
    expect(screen.getByText(/The Athletic/)).toBeInTheDocument();
    expect(screen.getByText(/2 hours ago/)).toBeInTheDocument();
  });

  it("should render placeholder disclaimer", () => {
    render(<NewsFeed />);
    expect(screen.getByText(/Placeholder - news integration coming soon/)).toBeInTheDocument();
  });
});
