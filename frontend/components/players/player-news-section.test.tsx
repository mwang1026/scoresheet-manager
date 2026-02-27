import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerNewsSection } from "./player-news-section";

vi.mock("@/lib/hooks/use-news-data", () => ({
  usePlayerNews: (playerId: number | null) => {
    if (playerId === 1) {
      return {
        news: [
          {
            id: 1,
            player_id: 1,
            source: "RotoWire",
            headline: "Player hits a homer",
            url: "https://example.com/1",
            published_at: "2026-02-25T18:00:00Z",
            body: "Great game today",
            raw_player_name: "Test Player",
            match_method: "exact_name_team",
          },
          {
            id: 2,
            player_id: 1,
            source: "RotoWire",
            headline: "Player steals two bases",
            url: "https://example.com/2",
            published_at: "2026-02-24T18:00:00Z",
            body: "Speed display",
            raw_player_name: "Test Player",
            match_method: "exact_name_team",
          },
        ],
        isLoading: false,
        error: null,
      };
    }
    return { news: [], isLoading: false, error: null };
  },
}));

describe("PlayerNewsSection", () => {
  it("renders news heading", () => {
    render(<PlayerNewsSection playerId={1} />);
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("renders news items", () => {
    render(<PlayerNewsSection playerId={1} />);
    expect(screen.getByText("Player hits a homer")).toBeInTheDocument();
    expect(screen.getByText("Player steals two bases")).toBeInTheDocument();
  });

  it("shows body text", () => {
    render(<PlayerNewsSection playerId={1} />);
    expect(screen.getByText("Great game today")).toBeInTheDocument();
  });

  it("shows empty state for player with no news", () => {
    render(<PlayerNewsSection playerId={999} />);
    expect(screen.getByText("No news for this player")).toBeInTheDocument();
  });
});
