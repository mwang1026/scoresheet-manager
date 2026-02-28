import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamCard } from "./team-card";
import type { OpponentTeamData } from "./team-card";
import type { Player, Team } from "@/lib/types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "@/lib/stats";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const emptyHitterTotals: AggregatedHitterStats = {
  PA: 0, AB: 0, H: 0, "1B": 0, "2B": 0, "3B": 0, HR: 0,
  SO: 0, GO: 0, FO: 0, GDP: 0, BB: 0, IBB: 0, HBP: 0,
  SB: 0, CS: 0, R: 0, RBI: 0, SF: 0, SH: 0,
  AVG: null, OBP: null, SLG: null, OPS: null,
};

const emptyPitcherTotals: AggregatedPitcherStats = {
  G: 0, GS: 0, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0,
  IP_outs: 0, W: 0, L: 0, ER: 0, R: 0, BF: 0, H: 0,
  BB: 0, IBB: 0, HBP: 0, K: 0, HR: 0, WP: 0, BK: 0,
  ERA: null, WHIP: null, K9: null,
};

describe("TeamCard", () => {
  const mockTeam: Team = {
    id: 2,
    name: "Andrew McGeorge",
    scoresheet_id: 2,
    league_id: 1,
    league_name: "Test League",
    is_my_team: false,
  };

  const mockHitter: Player = {
    id: 10,
    name: "Test Hitter",
    mlb_id: 10001,
    scoresheet_id: 10001,
    primary_position: "OF",
    hand: "R",
    age: 28,
    current_team: "NYY",
    team_id: 2,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: 1.85,
    osb_al: null,
    ocs_al: null,
    ba_vr: 0,
    ob_vr: 0,
    sl_vr: 0,
    ba_vl: 0,
    ob_vl: 0,
    sl_vl: 0,
    il_type: null,
    il_date: null,
  };

  const mockHitter2: Player = { ...mockHitter, id: 11, name: "Test Hitter 2", scoresheet_id: 10002, mlb_id: 10002 };

  const mockPitcher: Player = {
    id: 20,
    name: "Test Pitcher",
    mlb_id: 20001,
    scoresheet_id: 20001,
    primary_position: "P",
    hand: "L",
    age: 27,
    current_team: "NYY",
    team_id: 2,
    eligible_1b: null,
    eligible_2b: null,
    eligible_3b: null,
    eligible_ss: null,
    eligible_of: null,
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
  };

  const mockPitcher2: Player = { ...mockPitcher, id: 21, name: "Test Pitcher 2", scoresheet_id: 20002, mlb_id: 20002 };

  const buildData = (hitters: Player[], pitchers: Player[]): OpponentTeamData => ({
    team: mockTeam,
    hitters,
    pitchers,
    hitterStatsMap: new Map(),
    pitcherStatsMap: new Map(),
    teamHitterTotals: emptyHitterTotals,
    teamPitcherTotals: emptyPitcherTotals,
    getNote: vi.fn(() => ""),
    saveNote: vi.fn(),
  });

  it("renders the team name as header", () => {
    render(<TeamCard data={buildData([mockHitter], [mockPitcher])} />);
    expect(screen.getByText("Andrew McGeorge")).toBeInTheDocument();
  });

  it("renders hitters section header with correct count", () => {
    render(<TeamCard data={buildData([mockHitter, mockHitter2], [mockPitcher])} />);
    expect(screen.getByText("Hitters (2)")).toBeInTheDocument();
  });

  it("renders pitchers section header with correct count", () => {
    render(<TeamCard data={buildData([mockHitter], [mockPitcher, mockPitcher2])} />);
    expect(screen.getByText("Pitchers (2)")).toBeInTheDocument();
  });

  it("renders hitter table with player name", () => {
    render(<TeamCard data={buildData([mockHitter], [mockPitcher])} />);
    expect(screen.getByText("Test Hitter")).toBeInTheDocument();
  });

  it("renders pitcher table with player name", () => {
    render(<TeamCard data={buildData([mockHitter], [mockPitcher])} />);
    expect(screen.getByText("Test Pitcher")).toBeInTheDocument();
  });

  it("handles empty roster gracefully", () => {
    render(<TeamCard data={buildData([], [])} />);
    expect(screen.getByText("Andrew McGeorge")).toBeInTheDocument();
    expect(screen.getByText("Hitters (0)")).toBeInTheDocument();
    expect(screen.getByText("Pitchers (0)")).toBeInTheDocument();
  });
});
