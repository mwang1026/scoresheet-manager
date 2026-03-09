import { describe, it, expect } from "vitest";
import { buildTeamDepthChart, buildAllTeamDepthCharts } from "./lineup-optimizer";
import type { Player } from "../types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import { makeHitter, makePitcher, makeHitterStats, makePitcherStats } from "./__test-helpers__";

describe("lineup-optimizer", () => {
  describe("buildTeamDepthChart", () => {
    it("assigns all hitter positions correctly", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "Center", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 7, name: "Left", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 8, name: "Right", primary_position: "OF", eligible_of: 2.10 }),
        makeHitter({ id: 9, name: "DH Guy", primary_position: "DH" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      // All 12 positions should exist in the roster
      expect(Object.keys(result.roster)).toHaveLength(12);

      // Each hitter position should have at least one player
      expect(result.roster["C"].length).toBeGreaterThanOrEqual(1);
      expect(result.roster["1B"].length).toBeGreaterThanOrEqual(1);
      expect(result.roster["2B"].length).toBeGreaterThanOrEqual(1);
      expect(result.roster["SS"].length).toBeGreaterThanOrEqual(1);
      expect(result.roster["3B"].length).toBeGreaterThanOrEqual(1);
      expect(result.roster["DH"].length).toBeGreaterThanOrEqual(1);
    });

    it("assigns CF only to outfielders above threshold", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Good CF", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 2, name: "Bad CF", primary_position: "OF", eligible_of: 2.00 }),
        makeHitter({ id: 3, name: "Borderline CF", primary_position: "OF", eligible_of: 2.11 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p, i) => hitterStats.set(p.id, makeHitterStats(0.800 + i * 0.010)));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      // Only players with eligible_of >= 2.11 should be in CF
      const cfPlayerIds = result.roster["CF"].map((p) => p.id);
      expect(cfPlayerIds).toContain(1); // 3.50 >= 2.11
      expect(cfPlayerIds).not.toContain(2); // 2.00 < 2.11
      expect(cfPlayerIds).toContain(3); // 2.11 >= 2.11
    });

    it("places multi-position player at thinnest position as primary", () => {
      // SS is often the thinnest position, so a SS/2B should be primary at SS
      const players: Player[] = [
        makeHitter({ id: 1, name: "SS/2B", primary_position: "SS", eligible_ss: 5.00, eligible_2b: 4.00 }),
        makeHitter({ id: 2, name: "Pure 2B", primary_position: "2B", eligible_2b: 4.50 }),
        makeHitter({ id: 3, name: "Catcher", primary_position: "C" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      // Player 1 should appear in both SS and 2B
      const ssPlayer1 = result.roster["SS"].find((p) => p.id === 1);
      const _2bPlayer1 = result.roster["2B"].find((p) => p.id === 1);
      expect(ssPlayer1).toBeDefined();
      expect(_2bPlayer1).toBeDefined();

      // At SS (thinner), isPrimary should be true; at 2B, isPrimary should be false
      expect(ssPlayer1!.isPrimary).toBe(true);
      expect(_2bPlayer1!.isPrimary).toBe(false);
    });

    it("derives platoon roles from lineup overlap", () => {
      const players: Player[] = [
        // Player with positive vL split → should start in both lineups (LR)
        makeHitter({
          id: 1, name: "Both Starter", primary_position: "SS", eligible_ss: 5.00,
          ob_vl: 10, sl_vl: 10, ob_vr: 10, sl_vr: 10,
        }),
        // Additional players to fill roster
        makeHitter({ id: 2, name: "Other", primary_position: "C" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.850));
      hitterStats.set(2, makeHitterStats(0.700));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      // Player 1 should have a non-bench role since they're the best at SS
      const ssPlayers = result.roster["SS"];
      const starter = ssPlayers.find((p) => p.id === 1);
      expect(starter).toBeDefined();
      expect(starter!.role).not.toBe("bench");
    });

    it("sorts pitchers by ERA in P-L and P-R columns", () => {
      const players: Player[] = [
        makePitcher({ id: 1, name: "Bad SP", hand: "R" }),
        makePitcher({ id: 2, name: "Best SP", hand: "R" }),
        makePitcher({ id: 3, name: "Mid SP", hand: "R" }),
      ];

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(1, makePitcherStats(4.50));
      pitcherStats.set(2, makePitcherStats(2.80));
      pitcherStats.set(3, makePitcherStats(3.50));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      const prPitchers = result.roster["P-R"];
      expect(prPitchers).toHaveLength(3);
      // Should be sorted by ERA ascending
      expect(prPitchers[0].name).toBe("Best SP");
      expect(prPitchers[1].name).toBe("Mid SP");
      expect(prPitchers[2].name).toBe("Bad SP");
    });

    it("shows all SP but only top 5 have starter role", () => {
      const players: Player[] = [
        // 4 LHP
        ...Array.from({ length: 4 }, (_, i) =>
          makePitcher({ id: i + 1, name: `LHP ${i + 1}`, hand: "L" })
        ),
        // 4 RHP
        ...Array.from({ length: 4 }, (_, i) =>
          makePitcher({ id: i + 5, name: `RHP ${i + 1}`, hand: "R" })
        ),
      ];

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      players.forEach((p, i) => pitcherStats.set(p.id, makePitcherStats(3.00 + i * 0.20)));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      // All 8 SP should be displayed
      const totalSP = result.roster["P-L"].length + result.roster["P-R"].length;
      expect(totalSP).toBe(8);

      // Only 5 should have starter role (LR)
      const allSP = [...result.roster["P-L"], ...result.roster["P-R"]];
      const starters = allSP.filter((p) => p.role === "LR");
      const bench = allSP.filter((p) => p.role === "bench");
      expect(starters).toHaveLength(5);
      expect(bench).toHaveLength(3);
    });

    it("selects top 5 SP by ERA across both hands", () => {
      const players: Player[] = [
        makePitcher({ id: 1, name: "LHP-2.5", hand: "L" }),
        makePitcher({ id: 2, name: "LHP-3.5", hand: "L" }),
        makePitcher({ id: 3, name: "LHP-4.5", hand: "L" }),
        makePitcher({ id: 4, name: "RHP-3.0", hand: "R" }),
        makePitcher({ id: 5, name: "RHP-3.2", hand: "R" }),
        makePitcher({ id: 6, name: "RHP-5.0", hand: "R" }),
      ];

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(1, makePitcherStats(2.50));
      pitcherStats.set(2, makePitcherStats(3.50));
      pitcherStats.set(3, makePitcherStats(4.50));
      pitcherStats.set(4, makePitcherStats(3.00));
      pitcherStats.set(5, makePitcherStats(3.20));
      pitcherStats.set(6, makePitcherStats(5.00));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      // All SP shown: 3 LHP, 3 RHP
      expect(result.roster["P-L"]).toHaveLength(3);
      expect(result.roster["P-R"]).toHaveLength(3);

      // Top 5 by ERA: 2.5(L), 3.0(R), 3.2(R), 3.5(L), 4.5(L) — RHP-5.0 is bench
      const rhp5 = result.roster["P-R"].find((p) => p.name === "RHP-5.0");
      expect(rhp5).toBeDefined();
      expect(rhp5!.role).toBe("bench");

      // The other 5 should be starters
      const allSP = [...result.roster["P-L"], ...result.roster["P-R"]];
      const starters = allSP.filter((p) => p.role === "LR");
      expect(starters).toHaveLength(5);
      expect(starters.map((p) => p.name)).not.toContain("RHP-5.0");
    });

    it("splits pitchers by hand into P-L and P-R", () => {
      const players: Player[] = [
        makePitcher({ id: 1, name: "Lefty SP", hand: "L" }),
        makePitcher({ id: 2, name: "Righty SP", hand: "R" }),
      ];

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(1, makePitcherStats(3.20));
      pitcherStats.set(2, makePitcherStats(3.50));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      expect(result.roster["P-L"].map((p) => p.name)).toContain("Lefty SP");
      expect(result.roster["P-R"].map((p) => p.name)).toContain("Righty SP");
    });

    it("puts relievers in SR-L and SR-R with bench role", () => {
      const players: Player[] = [
        makePitcher({ id: 1, name: "Lefty RP", primary_position: "SR", hand: "L" }),
        makePitcher({ id: 2, name: "Righty RP", primary_position: "SR", hand: "R" }),
      ];

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(1, makePitcherStats(2.80));
      pitcherStats.set(2, makePitcherStats(3.10));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      expect(result.roster["SR-L"]).toHaveLength(1);
      expect(result.roster["SR-R"]).toHaveLength(1);
      // SR players render uniformly with bench role (no colored borders)
      expect(result.roster["SR-L"][0].role).toBe("bench");
      expect(result.roster["SR-R"][0].role).toBe("bench");
    });

    it("handles empty team (no players)", () => {
      const result = buildTeamDepthChart(
        1, "Empty Team", false, [], new Map(), new Map(), null
      );

      expect(result.name).toBe("Empty Team");
      expect(result.vL).toBeNull();
      expect(result.vR).toBeNull();
      expect(result.spEra).toBeNull();

      // All positions should exist but be empty
      for (const pos of Object.keys(result.roster)) {
        expect(result.roster[pos as keyof typeof result.roster]).toHaveLength(0);
      }
    });

    it("computes team aggregate stats", () => {
      const players: Player[] = [
        makeHitter({
          id: 1, name: "Hitter", primary_position: "SS", eligible_ss: 5.00,
          ob_vl: 20, sl_vl: 20, ob_vr: -10, sl_vr: -10,
        }),
        makePitcher({ id: 2, name: "Pitcher", hand: "R" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800));

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(2, makePitcherStats(3.50));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, pitcherStats, null
      );

      // Should have computed aggregates
      expect(result.vL).not.toBeNull();
      expect(result.vR).not.toBeNull();
      expect(result.spEra).toBe(3.50);
    });

    it("DH excludes players who start at another position", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "Center", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 7, name: "Left", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 8, name: "Right", primary_position: "OF", eligible_of: 2.10 }),
        makeHitter({ id: 9, name: "DH Guy", primary_position: "DH" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      // Give DH Guy the best OPS so he's the DH assignment
      hitterStats.set(9, makeHitterStats(0.900));
      // Everyone else gets descending OPS
      for (let i = 1; i <= 8; i++) {
        hitterStats.set(i, makeHitterStats(0.850 - i * 0.010));
      }

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      const dhPlayers = result.roster["DH"];
      // Only the DH assignment should appear — starters at field positions should not
      expect(dhPlayers.map((p) => p.name)).toContain("DH Guy");
      // Field position starters should NOT appear in DH
      expect(dhPlayers.map((p) => p.name)).not.toContain("Catcher");
      expect(dhPlayers.map((p) => p.name)).not.toContain("First");
      expect(dhPlayers.map((p) => p.name)).not.toContain("Short");
    });

    it("DH includes DH-only eligible players", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "SS Starter", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 2, name: "DH Only", primary_position: "DH" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.850));
      hitterStats.set(2, makeHitterStats(0.750));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      const dhPlayers = result.roster["DH"];
      expect(dhPlayers.map((p) => p.name)).toContain("DH Only");
      expect(dhPlayers.map((p) => p.name)).not.toContain("SS Starter");
    });

    it("non-top-5 SP have bench role", () => {
      const players: Player[] = Array.from({ length: 7 }, (_, i) =>
        makePitcher({ id: i + 1, name: `SP-${i + 1}`, hand: i % 2 === 0 ? "R" : "L" })
      );

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      players.forEach((p, i) => pitcherStats.set(p.id, makePitcherStats(2.50 + i * 0.50)));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      // All 7 should appear
      const allSP = [...result.roster["P-L"], ...result.roster["P-R"]];
      expect(allSP).toHaveLength(7);

      // Top 5 have starter role, bottom 2 have bench
      const starters = allSP.filter((p) => p.role === "LR");
      const bench = allSP.filter((p) => p.role === "bench");
      expect(starters).toHaveLength(5);
      expect(bench).toHaveLength(2);

      // Bench players should be the two with worst ERA (SP-6: 5.00, SP-7: 5.50)
      expect(bench.map((p) => p.name).sort()).toEqual(["SP-6", "SP-7"]);
    });

    it("team SP ERA uses only top 5", () => {
      const players: Player[] = Array.from({ length: 6 }, (_, i) =>
        makePitcher({ id: i + 1, name: `SP-${i + 1}`, hand: "R" })
      );

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      // ERAs: 2.00, 3.00, 4.00, 5.00, 6.00, 10.00
      const eras = [2.00, 3.00, 4.00, 5.00, 6.00, 10.00];
      players.forEach((p, i) => pitcherStats.set(p.id, makePitcherStats(eras[i])));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null
      );

      // Top 5 ERAs: 2, 3, 4, 5, 6 → average = 4.00
      expect(result.spEra).toBeCloseTo(4.00, 2);
    });

    it("shows defense diff relative to baseline", () => {
      const players: Player[] = [
        makeHitter({
          id: 1, name: "Good Defense", primary_position: "SS",
          eligible_ss: 5.50, // baseline is 4.75, so diff = +0.75
        }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800));

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null
      );

      const ssPlayer = result.roster["SS"].find((p) => p.id === 1);
      expect(ssPlayer).toBeDefined();
      expect(ssPlayer!.defRating).toBe(5.50);
      expect(ssPlayer!.defDiff).toBeCloseTo(0.75, 2);
    });
  });

  describe("buildAllTeamDepthCharts", () => {
    it("sorts teams with my team first, then alphabetically", () => {
      const teams = [
        { id: 1, name: "Zebras", is_my_team: false },
        { id: 2, name: "Aces", is_my_team: false },
        { id: 3, name: "My Team", is_my_team: true },
      ];

      const result = buildAllTeamDepthCharts(teams, [], new Map(), new Map());

      expect(result[0].name).toBe("My Team");
      expect(result[0].isMyTeam).toBe(true);
      expect(result[1].name).toBe("Aces");
      expect(result[2].name).toBe("Zebras");
    });

    it("assigns pick positions from draft schedule", () => {
      const teams = [
        { id: 1, name: "Team A", is_my_team: true },
        { id: 2, name: "Team B", is_my_team: false },
      ];

      const draftPicks = [
        { round: 1, pick_in_round: 3, team_id: 1, team_name: "Team A", from_team_name: null, scheduled_time: "" },
        { round: 1, pick_in_round: 7, team_id: 2, team_name: "Team B", from_team_name: null, scheduled_time: "" },
        { round: 2, pick_in_round: 8, team_id: 1, team_name: "Team A", from_team_name: null, scheduled_time: "" },
      ];

      const result = buildAllTeamDepthCharts(teams, [], new Map(), new Map(), draftPicks);

      expect(result[0].pickPosition).toBe(3); // Team A, round 1
      expect(result[1].pickPosition).toBe(7); // Team B, round 1
    });

    it("groups players by team correctly", () => {
      const teams = [
        { id: 1, name: "Team A", is_my_team: true },
        { id: 2, name: "Team B", is_my_team: false },
      ];

      const players: Player[] = [
        makeHitter({ id: 1, name: "A Player", team_id: 1, primary_position: "C" }),
        makeHitter({ id: 2, name: "B Player", team_id: 2, primary_position: "C" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800));
      hitterStats.set(2, makeHitterStats(0.750));

      const result = buildAllTeamDepthCharts(teams, players, hitterStats, new Map());

      const teamA = result.find((t) => t.name === "Team A")!;
      const teamB = result.find((t) => t.name === "Team B")!;

      expect(teamA.roster["C"].some((p) => p.name === "A Player")).toBe(true);
      expect(teamB.roster["C"].some((p) => p.name === "B Player")).toBe(true);
    });
  });

  describe("volume threshold filtering", () => {
    it("hitter with 0 PA in projected mode gets bench role", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Good Hitter", primary_position: "SS", eligible_ss: 5.00 }),
        makeHitter({ id: 2, name: "Zero PA", primary_position: "2B", eligible_2b: 4.00 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800, 500));
      hitterStats.set(2, makeHitterStats(0.900, 0)); // 0 PA — higher OPS but no volume

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null, "projected"
      );

      // Zero PA player should be bench despite having higher OPS
      const player2At2B = result.roster["2B"].find((p) => p.id === 2);
      expect(player2At2B).toBeDefined();
      expect(player2At2B!.role).toBe("bench");
    });

    it("hitter with 0 PA in actual mode is still eligible for starter", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Good Hitter", primary_position: "C" }),
        makeHitter({ id: 2, name: "Low PA", primary_position: "SS", eligible_ss: 5.00 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800, 500));
      hitterStats.set(2, makeHitterStats(0.850, 0)); // 0 PA in actual mode — still eligible

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null, "actual"
      );

      // In actual mode, no volume filter — player should be starter
      const player2AtSS = result.roster["SS"].find((p) => p.id === 2);
      expect(player2AtSS).toBeDefined();
      expect(player2AtSS!.role).not.toBe("bench");
    });

    it("pitcher with 0 IP in projected mode gets bench role for SP", () => {
      const players: Player[] = [
        makePitcher({ id: 1, name: "Good SP", hand: "R" }),
        makePitcher({ id: 2, name: "Zero IP SP", hand: "R" }),
      ];

      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(1, makePitcherStats(3.50, 540));
      pitcherStats.set(2, makePitcherStats(2.00, 0)); // 0 IP — better ERA but no volume

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, new Map(), pitcherStats, null, "projected"
      );

      // Zero IP pitcher should be bench despite better ERA
      const zeroIP = result.roster["P-R"].find((p) => p.id === 2);
      expect(zeroIP).toBeDefined();
      expect(zeroIP!.role).toBe("bench");

      // Good SP should be starter
      const goodSP = result.roster["P-R"].find((p) => p.id === 1);
      expect(goodSP).toBeDefined();
      expect(goodSP!.role).toBe("LR");
    });

    it("low-volume hitter still appears in roster but as bench", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Starter", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 2, name: "Low Vol", primary_position: "1B", eligible_1b: 1.50 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.750, 400));
      hitterStats.set(2, makeHitterStats(0.900, 50)); // Below MIN_PROJECTED_PA (200)

      const result = buildTeamDepthChart(
        1, "Test Team", false, players, hitterStats, new Map(), null, "projected"
      );

      // Both should appear at 1B
      expect(result.roster["1B"]).toHaveLength(2);

      // Low volume player should be bench
      const lowVol = result.roster["1B"].find((p) => p.id === 2);
      expect(lowVol).toBeDefined();
      expect(lowVol!.role).toBe("bench");

      // Starter should not be bench
      const starter = result.roster["1B"].find((p) => p.id === 1);
      expect(starter).toBeDefined();
      expect(starter!.role).not.toBe("bench");
    });
  });
});
