import { describe, it, expect } from "vitest";
import { players } from "@/lib/fixtures";
import type { TeamLineup } from "../types";
import { buildTeamRoles, describeLineupSource, hasScrapedLineup } from "./team-roles";
import { aggregateHitterStats, aggregatePitcherStats } from "../stats/aggregation";

const team = { id: 1, name: "Team 1", is_my_team: true };
const roster = players.slice(0, 20).map((p) => ({ ...p, team_id: 1 }));
const hitters = roster.filter((p) => p.primary_position !== "P");
const pitchers = roster.filter((p) => p.primary_position === "P");

const hitterStatsMap = new Map(
  hitters.map((p, i) => [p.id, aggregateHitterStats([{
    player_id: p.id, date: "2026-06-01",
    PA: 300, AB: 270, H: 60 + i * 3, "1B": 40, "2B": 10 + i, "3B": 1, HR: 9, SO: 60, GO: 60, FO: 60, GDP: 5,
    BB: 25, IBB: 0, HBP: 3, SB: 2, CS: 1, R: 30, RBI: 30, SF: 2, SH: 0,
  }])])
);
const pitcherStatsMap = new Map(
  pitchers.map((p, i) => [p.id, aggregatePitcherStats([{
    player_id: p.id, date: "2026-06-01",
    G: 15, GS: 15, GF: 0, CG: 0, SHO: 0, SV: 0, HLD: 0, IP_outs: 270, W: 5, L: 5, ER: 30 + i, R: 32,
    BF: 360, H: 80, BB: 25, IBB: 0, HBP: 3, K: 90, HR: 10, WP: 2, BK: 0,
  }])])
);

describe("buildTeamRoles", () => {
  it("prefers the scraped lineup", () => {
    const lineup: TeamLineup = {
      team_id: 1, games: 6, unknown_hand_games: 0,
      vs_rhp: [{ slot: 0, position: "C", pin: 1, player_id: hitters[0].id }],
      vs_lhp: null,
      rotation: [{ pin: 2, player_id: pitchers[0].id, games: 2 }],
      relievers: [],
    };
    const result = buildTeamRoles({ team, lineup, players: roster, hitterStatsMap, pitcherStatsMap, statsSource: "actual" });
    expect(result.source).toBe("scoresheet");
    expect(result.roles.get(hitters[0].id)?.slotVsR).toBe(0);
    expect(result.roles.get(pitchers[0].id)?.rotationNo).toBe(1);
  });

  it("falls back to depth chart inference without a lineup", () => {
    const result = buildTeamRoles({ team, lineup: undefined, players: roster, hitterStatsMap, pitcherStatsMap, statsSource: "actual" });
    expect(result.source).toBe("inferred");
    const starters = [...result.roles.values()].filter((r) => r.slotVsR !== null || r.slotVsL !== null);
    expect(starters.length).toBeGreaterThan(0);
    expect(starters.every((r) => r.source === "inferred")).toBe(true);
  });

  it("treats a lineup with no games vs either hand as absent", () => {
    const empty: TeamLineup = { team_id: 1, games: 0, unknown_hand_games: 0, vs_rhp: null, vs_lhp: null, rotation: [], relievers: [] };
    expect(hasScrapedLineup(empty)).toBe(false);
    expect(hasScrapedLineup(undefined)).toBe(false);
    const result = buildTeamRoles({ team, lineup: empty, players: roster, hitterStatsMap, pitcherStatsMap, statsSource: "playoff" });
    expect(result.source).toBe("inferred");
  });

  it("returns no source for an empty roster", () => {
    const result = buildTeamRoles({ team, lineup: undefined, players: [], hitterStatsMap, pitcherStatsMap, statsSource: "actual" });
    expect(result).toEqual({ roles: new Map(), source: null });
  });
});

describe("describeLineupSource", () => {
  it("captions each source", () => {
    expect(describeLineupSource("scoresheet", "2026-09-20")).toBe("Lineup from Scoresheet week ending 2026-09-20");
    expect(describeLineupSource("scoresheet", null)).toBe("Lineup from Scoresheet");
    expect(describeLineupSource("inferred", "2026-09-20")).toContain("inferred");
    expect(describeLineupSource(null, null)).toBeUndefined();
  });
});
