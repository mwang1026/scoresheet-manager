import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamDetail } from "./team-detail";
import type { Player, Team, HitterDailyStats, PitcherDailyStats, TeamLineup } from "@/lib/types";

const teams: Team[] = [
  { id: 1, name: "My Team", scoresheet_id: 1, league_id: 1, league_name: "L", is_my_team: true },
  { id: 2, name: "Los Alamos Atoms", scoresheet_id: 2, league_id: 1, league_name: "L", is_my_team: false },
];

const base = {
  mlb_id: null, eligible_1b: null, eligible_2b: null, eligible_3b: null, eligible_ss: null, eligible_of: null,
  osb_al: null, ocs_al: null, ba_vr: 0, ob_vr: 0, sl_vr: 0, ba_vl: 0, ob_vl: 0, sl_vl: 0,
  il_type: null, il_date: null, oop_positions: [] as string[], age: 30, current_team: "X",
};
const players: Player[] = [
  { ...base, id: 10, first_name: "Lead", last_name: "Off", name: "Lead Off", scoresheet_id: 10, primary_position: "SS", hand: "R", team_id: 2 },
  { ...base, id: 11, first_name: "Two", last_name: "Hole", name: "Two Hole", scoresheet_id: 11, primary_position: "1B", hand: "L", team_id: 2 },
  { ...base, id: 12, first_name: "Bench", last_name: "Bat", name: "Bench Bat", scoresheet_id: 12, primary_position: "OF", hand: "R", team_id: 2 },
  { ...base, id: 20, first_name: "Ace", last_name: "Starter", name: "Ace Starter", scoresheet_id: 20, primary_position: "P", hand: "R", team_id: 2 },
  { ...base, id: 21, first_name: "Closer", last_name: "Guy", name: "Closer Guy", scoresheet_id: 21, primary_position: "SR", hand: "L", team_id: 2 },
  { ...base, id: 30, first_name: "Other", last_name: "Team", name: "Other Team", scoresheet_id: 30, primary_position: "C", hand: "R", team_id: 1 },
];

const hitterStats: HitterDailyStats[] = [
  { player_id: 10, date: "2026-09-05", PA: 4, AB: 4, H: 2, "1B": 2, "2B": 0, "3B": 0, HR: 0, SO: 0, GO: 1, FO: 1, GDP: 0, BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 1, RBI: 0, SF: 0, SH: 0 },
  { player_id: 11, date: "2026-06-05", PA: 4, AB: 4, H: 4, "1B": 4, "2B": 0, "3B": 0, HR: 0, SO: 0, GO: 0, FO: 0, GDP: 0, BB: 0, IBB: 0, HBP: 0, SB: 0, CS: 0, R: 1, RBI: 0, SF: 0, SH: 0 },
];
const pitcherStats: PitcherDailyStats[] = [
  { player_id: 20, date: "2026-09-05", G: 1, GS: 1, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs: 18, W: 1, L: 0, ER: 2, R: 2, BF: 24, H: 5, BB: 1, IBB: 0, HBP: 0, K: 6, HR: 0, WP: 0, BK: 0 },
];

const lineup: TeamLineup = {
  team_id: 2, games: 6, unknown_hand_games: 0,
  vs_rhp: [
    { slot: 0, position: "SS", pin: 10, player_id: 10 },
    { slot: 1, position: "1B", pin: 11, player_id: 11 },
  ],
  vs_lhp: null,
  rotation: [{ pin: 20, player_id: 20, games: 2 }],
  relievers: [{ pin: 21, player_id: 21, games: 3 }],
};

let mockLineups: Map<number, TeamLineup> = new Map([[2, lineup]]);

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/hooks/use-page-defaults", () => ({
  usePageDefaults: () => ({
    statsSource: "actual" as const,
    dateRange: { type: "season", year: 2026 },
    projectionSource: null,
    seasonYear: 2026,
    hitterSort: { column: "OPS", direction: "desc" },
    pitcherSort: { column: "ERA", direction: "asc" },
  }),
}));

vi.mock("@/lib/contexts/settings-context", () => ({
  useSettingsContext: () => ({ updatePageSettings: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-players-data", () => ({
  usePlayers: () => ({ players, isLoading: false, error: null }),
  useTeams: () => ({ teams, isLoading: false, error: null }),
  useProjections: () => ({ projections: [], isLoading: false, error: null }),
  useStatsForSource: () => ({ hitterStats, pitcherStats, isLoading: false, error: null, effectiveRange: { type: "season", year: 2026 } }),
}));

vi.mock("@/lib/hooks/use-lineups", () => ({
  useTeamLineups: () => ({ lineups: undefined, lineupsByTeam: mockLineups, weekEnd: "2026-09-20", isLoading: false, error: null, refresh: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-player-notes", () => ({
  usePlayerNotes: () => ({ getNote: () => "", saveNote: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-news-data", () => ({
  useNewsFlags: () => ({ newsPlayerIds: new Set<number>() }),
  usePlayerNews: () => ({ news: [], isLoading: false, error: null }),
}));

describe("TeamDetail", () => {
  beforeEach(() => {
    mockLineups = new Map([[2, lineup]]);
  });

  it("renders batting order, rotation, bullpen, starter summary, and roster tables with lineup roles", () => {
    render(<TeamDetail teamId={2} />);

    expect(screen.getByText("Batting order vs RHP")).toBeInTheDocument();
    expect(screen.getByText(/No games against this hand/)).toBeInTheDocument(); // vs LHP null
    expect(screen.getByText("Rotation")).toBeInTheDocument();
    expect(screen.getByText("Bullpen")).toBeInTheDocument();
    expect(screen.getByTestId("starter-summary")).toHaveTextContent("Lineup from Scoresheet week ending 2026-09-20");

    // Roster tables: Lineup column with slot / SP / RP / bench labels, only this team's players
    expect(screen.getAllByRole("columnheader", { name: /Lineup/ })).toHaveLength(2);
    expect(screen.getByText("1 / –")).toBeInTheDocument();
    expect(screen.getByText("SP1")).toBeInTheDocument();
    expect(screen.getByText("RP")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("Other Team")).not.toBeInTheDocument();
    // Starters totals rows in both tables
    expect(screen.getAllByText("Starters").length).toBeGreaterThanOrEqual(2);
  });

  it("playoff mode adds series caps to the panels and swaps table columns", async () => {
    const user = userEvent.setup();
    render(<TeamDetail teamId={2} />);
    await user.click(screen.getByRole("button", { name: "Playoff" }));

    expect(screen.getByTestId("playoff-mode-note")).toBeInTheDocument();
    const panels = screen.getByTestId("lineup-panels");
    expect(within(panels).getByText("Ser PA")).toBeInTheDocument();
    expect(within(panels).getByText("OUT")).toBeInTheDocument(); // Two Hole: no window PA
    expect(screen.getAllByRole("columnheader", { name: /Sep PA/ })).toHaveLength(1);
    expect(screen.queryByRole("columnheader", { name: /RBI/ })).not.toBeInTheDocument();
  });

  it("falls back to inferred roles when the team has no scraped lineup", () => {
    mockLineups = new Map();
    render(<TeamDetail teamId={2} />);
    expect(screen.getByText(/No scraped Scoresheet lineup/)).toBeInTheDocument();
    expect(screen.queryByTestId("lineup-panels")).not.toBeInTheDocument();
    expect(screen.getByTestId("starter-summary")).toHaveTextContent("inferred");
  });

  it("shows a not-found message for an unknown team", () => {
    render(<TeamDetail teamId={99} />);
    expect(screen.getByText("Team not found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Opponents" })).toHaveAttribute("href", "/opponents");
  });
});
