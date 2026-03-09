import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RosterNewsWidget } from "./roster-news-widget";
import type { Player } from "@/lib/types";
import type { DashboardNewsItem } from "@/lib/types";

const mockNews: DashboardNewsItem[] = [
  {
    id: 1,
    player_id: 1,
    headline: "Judge hits homer",
    body: null,
    url: "https://example.com/1",
    published_at: new Date().toISOString(),
    raw_player_name: "Aaron Judge",
    source: "RotoWire",
  },
  {
    id: 2,
    player_id: 99,
    headline: "Unrostered player news",
    body: null,
    url: "https://example.com/2",
    published_at: new Date().toISOString(),
    raw_player_name: "Other Player",
    source: "RotoWire",
  },
];

vi.mock("@/lib/hooks/use-news-data", () => ({
  useLatestNews: () => ({ news: mockNews, isLoading: false, error: null }),
}));

const mockPlayer: Player = {
  id: 1,
  name: "Aaron Judge",
  first_name: "Aaron",
  last_name: "Judge",
  mlb_id: 592450,
  scoresheet_id: 100,
  primary_position: "OF",
  hand: "R",
  age: 33,
  current_team: "NYY",
  team_id: 1,
  eligible_1b: null,
  eligible_2b: null,
  eligible_3b: null,
  eligible_ss: null,
  eligible_of: 5,
  osb_al: null,
  ocs_al: null,
  ba_vr: null,
  ob_vr: null,
  sl_vr: null,
  ba_vl: null,
  ob_vl: null,
  sl_vl: null,
  il_type: null,
  il_date: null,
  oop_positions: [],
};

describe("RosterNewsWidget", () => {
  const rosteredIds = new Set([1]);
  const playerMap = new Map<number, Player>([[1, mockPlayer]]);

  it("renders heading", () => {
    render(
      <RosterNewsWidget rosteredPlayerIds={rosteredIds} playerMap={playerMap} />
    );
    expect(screen.getByText("Roster News")).toBeInTheDocument();
  });

  it("shows only rostered player news", () => {
    render(
      <RosterNewsWidget rosteredPlayerIds={rosteredIds} playerMap={playerMap} />
    );
    expect(screen.getByText("Judge hits homer")).toBeInTheDocument();
    expect(screen.queryByText("Unrostered player news")).not.toBeInTheDocument();
  });

  it("shows empty state when no rostered news", () => {
    render(
      <RosterNewsWidget
        rosteredPlayerIds={new Set()}
        playerMap={playerMap}
      />
    );
    expect(screen.getByText("No recent news for your roster")).toBeInTheDocument();
  });

  it("links to view all news", () => {
    render(
      <RosterNewsWidget rosteredPlayerIds={rosteredIds} playerMap={playerMap} />
    );
    const viewAll = screen.getByText("View All");
    expect(viewAll.closest("a")).toHaveAttribute("href", "/news?scope=my_players");
  });
});
