import { describe, it, expect } from "vitest";
import { buildTeamDepthChart, buildAllTeamDepthCharts, computeStartingDEF } from "./lineup-optimizer";
import type { Player } from "../types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";
import type { DepthChartPosition } from "./types";
import { AVERAGE_DEF_BASELINE, CF_DEF_WEIGHT } from "./types";
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

    it("CF assignment: top 3 OPS all CF-eligible — best DEF plays CF", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 2.50 }),
        makeHitter({ id: 4, name: "D", primary_position: "OF", eligible_of: 1.80 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.880));
      hitterStats.set(3, makeHitterStats(0.860));
      hitterStats.set(4, makeHitterStats(0.700));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // B has best DEF (3.50) among top 3 CF-eligible → plays CF
      const cfStarters = result.roster["CF"].filter((p) => p.role !== "bench");
      expect(cfStarters.some((p) => p.id === 2)).toBe(true);

      // A and C play COF
      const cofStarters = result.roster["COF"].filter((p) => p.role !== "bench");
      expect(cofStarters.some((p) => p.id === 1)).toBe(true);
      expect(cofStarters.some((p) => p.id === 3)).toBe(true);
    });

    it("CF assignment: 2 of top 3 CF-eligible — better DEF plays CF", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 1.80 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.880));
      hitterStats.set(3, makeHitterStats(0.860));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // B has better DEF (3.50 vs 2.20) → plays CF
      const cfStarters = result.roster["CF"].filter((p) => p.role !== "bench");
      expect(cfStarters.some((p) => p.id === 2)).toBe(true);
    });

    it("CF assignment: 1 of top 3 CF-eligible — that one plays CF", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 2.50 }),
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 1.80 }),
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 1.90 }),
        makeHitter({ id: 4, name: "D", primary_position: "OF", eligible_of: 3.00 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.880));
      hitterStats.set(3, makeHitterStats(0.860));
      hitterStats.set(4, makeHitterStats(0.700));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // D has better DEF (3.00) than A (2.50) — optimal assignment puts D at CF
      const cfStarters = result.roster["CF"].filter((p) => p.role !== "bench");
      expect(cfStarters.some((p) => p.id === 4)).toBe(true);

      // Optimal assignment: A (2.50) over B (1.80) at COF → A and C play COF, B→DH
      const cofStarters = result.roster["COF"].filter((p) => p.role !== "bench");
      expect(cofStarters.some((p) => p.id === 1)).toBe(true);
      expect(cofStarters.some((p) => p.id === 3)).toBe(true);

      const dhStarters = result.roster["DH"].filter((p) => p.role !== "bench");
      expect(dhStarters.some((p) => p.id === 2)).toBe(true);
    });

    it("CF assignment: 0 CF-eligible in top 3 — pull in best CF-eligible by OPS", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 1.50 }),
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 1.80 }),
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 1.90 }),
        makeHitter({ id: 4, name: "D", primary_position: "OF", eligible_of: 2.50 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.880));
      hitterStats.set(3, makeHitterStats(0.860));
      hitterStats.set(4, makeHitterStats(0.700));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // D is the only CF-eligible → plays CF
      const cfStarters = result.roster["CF"].filter((p) => p.role !== "bench");
      expect(cfStarters.some((p) => p.id === 4)).toBe(true);

      // Optimal assignment: D→CF, B and C at COF (better DEF), A→DH
      const cofStarters = result.roster["COF"].filter((p) => p.role !== "bench");
      expect(cofStarters.some((p) => p.id === 2)).toBe(true);
      expect(cofStarters.some((p) => p.id === 3)).toBe(true);
    });

    it("CF assignment: no CF-eligible players — best defender among top 3 OPS plays CF", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 1.50 }),
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 1.80 }),
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 1.90 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.880));
      hitterStats.set(3, makeHitterStats(0.860));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // Player 3 has highest eligible_of (1.90) — plays CF
      const cfStarters = result.roster["CF"].filter((p) => p.role !== "bench");
      expect(cfStarters).toHaveLength(1);
      expect(cfStarters[0].id).toBe(3);

      // Players 1 and 2 play COF
      const cofStarters = result.roster["COF"].filter((p) => p.role !== "bench");
      expect(cofStarters.some((p) => p.id === 1)).toBe(true);
      expect(cofStarters.some((p) => p.id === 2)).toBe(true);
    });

    it("optimal position assignment: finds multi-step rotation", () => {
      // Scenario: 3 OF-eligible players + supporting cast
      // A: high OPS, eligible 1B + OF, mediocre 1B DEF (1.50), decent OF DEF (2.20)
      // B: medium OPS, eligible OF only, poor OF DEF (1.80)
      // C: lower OPS, eligible 1B only, great 1B DEF (3.50)
      //
      // Greedy by OPS: A→1B, B→OF, C→DH
      // Optimal: C→1B (3.50), A→OF (2.20), B→DH — backtracker finds this directly.
      const players: Player[] = [
        makeHitter({ id: 1, name: "C Guy", primary_position: "C" }),
        makeHitter({ id: 2, name: "SS Guy", primary_position: "SS", eligible_ss: 4.00 }),
        makeHitter({ id: 3, name: "2B Guy", primary_position: "2B", eligible_2b: 4.00 }),
        makeHitter({ id: 4, name: "3B Guy", primary_position: "3B", eligible_3b: 3.00 }),
        makeHitter({ id: 10, name: "A", primary_position: "1B", eligible_1b: 1.50, eligible_of: 2.20 }),
        makeHitter({ id: 11, name: "B", primary_position: "OF", eligible_of: 1.80 }),
        makeHitter({ id: 12, name: "C", primary_position: "1B", eligible_1b: 3.50 }),
        makeHitter({ id: 20, name: "OF2", primary_position: "OF", eligible_of: 2.50 }),
        makeHitter({ id: 21, name: "OF3", primary_position: "OF", eligible_of: 2.60 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.700));
      hitterStats.set(2, makeHitterStats(0.750));
      hitterStats.set(3, makeHitterStats(0.740));
      hitterStats.set(4, makeHitterStats(0.730));
      hitterStats.set(10, makeHitterStats(0.900)); // A — best OPS
      hitterStats.set(11, makeHitterStats(0.850)); // B — medium
      hitterStats.set(12, makeHitterStats(0.600)); // C — lowest among the trio
      hitterStats.set(20, makeHitterStats(0.820));
      hitterStats.set(21, makeHitterStats(0.810));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // C (id=12) should end up at 1B (best 1B DEF)
      const firstBaseStarters = result.roster["1B"].filter((p) => p.role !== "bench");
      expect(firstBaseStarters.some((p) => p.id === 12)).toBe(true);

      // B (id=11) should be DH — worst OF DEF, displaced by optimal assignment
      const dhStarters = result.roster["DH"].filter((p) => p.role !== "bench");
      expect(dhStarters.some((p) => p.id === 11)).toBe(true);

      // A (id=10) should be in the outfield (COF), not DH or 1B
      const cofStarters = result.roster["COF"].filter((p) => p.role !== "bench");
      expect(cofStarters.some((p) => p.id === 10)).toBe(true);
    });

    it("optimal position assignment: reshuffles non-DH starters for better DEF", () => {
      // A: primary SS, eligible SS (3.50) + eligible 2B (4.80) — better at 2B
      // B: primary 2B, eligible 2B (3.80) + eligible SS (4.50) — better at SS
      // DH Guy: no field eligibility (DH-only)
      // Greedy assigns A→SS, B→2B by primary position and OPS.
      // Optimal: A→2B (4.80), B→SS (4.50) — both improve.
      const players: Player[] = [
        makeHitter({ id: 1, name: "C Guy", primary_position: "C" }),
        makeHitter({ id: 2, name: "A", primary_position: "SS", eligible_ss: 3.50, eligible_2b: 4.80 }),
        makeHitter({ id: 3, name: "B", primary_position: "2B", eligible_2b: 3.80, eligible_ss: 4.50 }),
        makeHitter({ id: 4, name: "3B Guy", primary_position: "3B", eligible_3b: 3.00 }),
        makeHitter({ id: 5, name: "1B Guy", primary_position: "1B", eligible_1b: 2.00 }),
        makeHitter({ id: 6, name: "OF1", primary_position: "OF", eligible_of: 3.00 }),
        makeHitter({ id: 7, name: "OF2", primary_position: "OF", eligible_of: 2.50 }),
        makeHitter({ id: 8, name: "OF3", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 9, name: "DH Guy", primary_position: "DH" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.700));
      hitterStats.set(2, makeHitterStats(0.850)); // A
      hitterStats.set(3, makeHitterStats(0.840)); // B
      hitterStats.set(4, makeHitterStats(0.730));
      hitterStats.set(5, makeHitterStats(0.720));
      hitterStats.set(6, makeHitterStats(0.810));
      hitterStats.set(7, makeHitterStats(0.800));
      hitterStats.set(8, makeHitterStats(0.790));
      hitterStats.set(9, makeHitterStats(0.600));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // A (id=2) should be at 2B (4.80 DEF, better than his SS 3.50)
      const secondBaseStarters = result.roster["2B"].filter((p) => p.role !== "bench");
      expect(secondBaseStarters.some((p) => p.id === 2)).toBe(true);

      // B (id=3) should be at SS (4.50 DEF, better than his 2B 3.80)
      const ssStarters = result.roster["SS"].filter((p) => p.role !== "bench");
      expect(ssStarters.some((p) => p.id === 3)).toBe(true);

      // DH Guy stays at DH
      const dhStarters = result.roster["DH"].filter((p) => p.role !== "bench");
      expect(dhStarters.some((p) => p.id === 9)).toBe(true);
    });

    it("optimal position assignment: 3-way rotation", () => {
      // Real-world scenario: Soderstrom/Pasquantino/Rooker
      // Tyler (T): eligible 1B (2.50) + OF (2.80) — good OPS, good defense everywhere
      // Vinnie (V): eligible 1B (2.00) — decent OPS, mediocre 1B DEF
      // Rooker (R): eligible OF only (1.50) — good OPS, poor OF DEF
      //
      // Greedy by OPS: T→1B, R→OF, V→DH (V has worst OPS among the three)
      // Pairwise DH swap can't find improvement: V can't beat T at 1B (2.00 < 2.50)
      // Optimal 3-way: V→1B (2.00), T→OF (2.80), R→DH
      //   Net DEF gain: 1B goes 2.50→2.00 (-0.50), OF gains T (2.80) over R (1.50) (+1.30) = +0.80
      const players: Player[] = [
        makeHitter({ id: 1, name: "C Guy", primary_position: "C" }),
        makeHitter({ id: 2, name: "SS Guy", primary_position: "SS", eligible_ss: 4.00 }),
        makeHitter({ id: 3, name: "2B Guy", primary_position: "2B", eligible_2b: 4.00 }),
        makeHitter({ id: 4, name: "3B Guy", primary_position: "3B", eligible_3b: 3.00 }),
        makeHitter({ id: 10, name: "Tyler", primary_position: "1B", eligible_1b: 2.50, eligible_of: 2.80 }),
        makeHitter({ id: 11, name: "Vinnie", primary_position: "1B", eligible_1b: 2.00 }),
        makeHitter({ id: 12, name: "Rooker", primary_position: "OF", eligible_of: 1.50 }),
        makeHitter({ id: 20, name: "OF2", primary_position: "OF", eligible_of: 2.50 }),
        makeHitter({ id: 21, name: "OF3", primary_position: "OF", eligible_of: 3.00 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.700));
      hitterStats.set(2, makeHitterStats(0.750));
      hitterStats.set(3, makeHitterStats(0.740));
      hitterStats.set(4, makeHitterStats(0.730));
      hitterStats.set(10, makeHitterStats(0.880)); // Tyler — high OPS
      hitterStats.set(11, makeHitterStats(0.600)); // Vinnie — low OPS, DH candidate
      hitterStats.set(12, makeHitterStats(0.860)); // Rooker — good OPS
      hitterStats.set(20, makeHitterStats(0.820));
      hitterStats.set(21, makeHitterStats(0.810));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // Vinnie (id=11) at 1B — freed up by Tyler moving to OF
      const firstBaseStarters = result.roster["1B"].filter((p) => p.role !== "bench");
      expect(firstBaseStarters.some((p) => p.id === 11)).toBe(true);

      // Tyler (id=10) in the outfield (COF) — better OF DEF than Rooker
      const cofStarters = result.roster["COF"].filter((p) => p.role !== "bench");
      expect(cofStarters.some((p) => p.id === 10)).toBe(true);

      // Rooker (id=12) at DH — worst OF DEF among the starters
      const dhStarters = result.roster["DH"].filter((p) => p.role !== "bench");
      expect(dhStarters.some((p) => p.id === 12)).toBe(true);
    });

    it("CF/COF split: player CF in both lineups gets isPrimary=true and role=LR at CF", () => {
      // All 3 OF are CF-eligible. Same OPS splits → same top 3 in both lineups.
      // Best DEF should be CF in both, so isPrimary=true at CF with role=LR.
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 3.50 }), // best DEF
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 2.50 }),
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 2.20 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      // Same OPS for all → same lineups vsL and vsR
      hitterStats.set(1, makeHitterStats(0.800));
      hitterStats.set(2, makeHitterStats(0.790));
      hitterStats.set(3, makeHitterStats(0.780));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // A is CF in both lineups → isPrimary=true, role=LR at CF
      const cfA = result.roster["CF"].find((p) => p.id === 1);
      expect(cfA).toBeDefined();
      expect(cfA!.isPrimary).toBe(true);
      expect(cfA!.role).toBe("LR");
    });

    it("CF/COF split: different CF per lineup → only both-lineup CF gets isPrimary at CF", () => {
      // Force different CF picks in vsL vs vsR by giving players different splits.
      // Player A: great vsL OPS, bad vsR → in top 3 for vsL, not vsR
      // Player B: great vsR OPS, bad vsL → in top 3 for vsR, not vsL
      // Player C: moderate both → in top 3 for both
      // Player D: filler (non-OF)
      const players: Player[] = [
        makeHitter({
          id: 1, name: "A", primary_position: "OF", eligible_of: 3.00,
          ob_vl: 30, sl_vl: 30, ob_vr: -30, sl_vr: -30,
        }),
        makeHitter({
          id: 2, name: "B", primary_position: "OF", eligible_of: 3.20,
          ob_vl: -30, sl_vl: -30, ob_vr: 30, sl_vr: 30,
        }),
        makeHitter({
          id: 3, name: "C", primary_position: "OF", eligible_of: 2.50,
          ob_vl: 0, sl_vl: 0, ob_vr: 0, sl_vr: 0,
        }),
        makeHitter({
          id: 4, name: "D", primary_position: "OF", eligible_of: 2.20,
          ob_vl: 0, sl_vl: 0, ob_vr: 0, sl_vr: 0,
        }),
        makeHitter({ id: 5, name: "Catcher", primary_position: "C" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800));
      hitterStats.set(2, makeHitterStats(0.800));
      hitterStats.set(3, makeHitterStats(0.780));
      hitterStats.set(4, makeHitterStats(0.760));
      hitterStats.set(5, makeHitterStats(0.700));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // A player who is only CF in one lineup should NOT be isPrimary at CF
      // They should be isPrimary at COF instead
      const cfPlayers = result.roster["CF"];
      const primaryCF = cfPlayers.filter((p) => p.isPrimary && p.role === "LR");
      // At most 1 player should be bolded as primary CF starter
      expect(primaryCF.length).toBeLessThanOrEqual(1);
    });

    it("CF/COF split: position-specific roles — COF player has bench role at CF row", () => {
      // Player at COF (not CF) in both lineups should have role=bench in CF row
      const players: Player[] = [
        makeHitter({ id: 1, name: "A", primary_position: "OF", eligible_of: 3.50 }), // CF-eligible, best DEF
        makeHitter({ id: 2, name: "B", primary_position: "OF", eligible_of: 2.00 }), // COF only (below threshold)
        makeHitter({ id: 3, name: "C", primary_position: "OF", eligible_of: 2.20 }), // CF-eligible
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      hitterStats.set(1, makeHitterStats(0.800));
      hitterStats.set(2, makeHitterStats(0.850)); // B has best OPS but can't play CF
      hitterStats.set(3, makeHitterStats(0.780));

      const result = buildTeamDepthChart(
        1, "T", false, players, hitterStats, new Map(), null
      );

      // B is not CF-eligible so won't appear in CF row at all (filtered by isEligibleAtDCPosition)
      const cfB = result.roster["CF"].find((p) => p.id === 2);
      expect(cfB).toBeUndefined();

      // B should be in COF with a starter role
      const cofB = result.roster["COF"].find((p) => p.id === 2);
      expect(cofB).toBeDefined();
      expect(cofB!.role).not.toBe("bench");
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

  describe("team DEF aggregates", () => {
    /** Helper: build a full 9-player team with known defense values */
    function makeFullTeam(defOverrides: Record<string, number | null> = {}) {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: defOverrides["1B"] ?? 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: defOverrides["2B"] ?? 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: defOverrides.SS ?? 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: defOverrides["3B"] ?? 2.65 }),
        makeHitter({ id: 6, name: "Center", primary_position: "OF", eligible_of: defOverrides.CF ?? 2.15 }),
        makeHitter({ id: 7, name: "Left", primary_position: "OF", eligible_of: defOverrides.COF1 ?? 2.07 }),
        makeHitter({ id: 8, name: "Right", primary_position: "OF", eligible_of: defOverrides.COF2 ?? 2.07 }),
        makeHitter({ id: 9, name: "DH Guy", primary_position: "DH" }),
      ];
      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));
      return { players, hitterStats };
    }

    it("computes DEF values for full lineup with known defense ratings", () => {
      // All at league average except SS at 5.75 (+1.00)
      const { players, hitterStats } = makeFullTeam({ SS: 5.75 });
      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Only SS differs from baseline: +1.00
      expect(result.defVsL).toBeCloseTo(1.00, 2);
      expect(result.defVsR).toBeCloseTo(1.00, 2);
    });

    it("CF defense is weighted at 1.4x", () => {
      // CF at 3.15 instead of 2.15 (raw +1.00, weighted = +1.40)
      const { players, hitterStats } = makeFullTeam({ CF: 3.15 });
      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      expect(result.defVsL).toBeCloseTo(1.40, 2);
      expect(result.defVsR).toBeCloseTo(1.40, 2);
    });

    it("null defense at assigned position contributes 0 to relative DEF", () => {
      // 1B player with null defense (primary_position = "1B" makes them eligible)
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: null }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "Center", primary_position: "OF", eligible_of: 2.15 }),
        makeHitter({ id: 7, name: "Left", primary_position: "OF", eligible_of: 2.07 }),
        makeHitter({ id: 8, name: "Right", primary_position: "OF", eligible_of: 2.07 }),
        makeHitter({ id: 9, name: "DH Guy", primary_position: "DH" }),
      ];
      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Null 1B rating → uses position average → 0 relative contribution
      expect(result.defVsL).toBeCloseTo(0.00, 2);
    });

    it("different lineup assignments yield different DEF values via computeStartingDEF", () => {
      // Directly test computeStartingDEF with two different lineups
      const goodSS = makeHitter({ id: 1, name: "GoodDef SS", primary_position: "SS", eligible_ss: 5.50 });
      const badSS = makeHitter({ id: 2, name: "BadDef SS", primary_position: "SS", eligible_ss: 3.50 });
      const hitters = [
        { player: goodSS, ops: 0.800, opsVsL: 0.850, opsVsR: 0.750, pa: 500, hr: 20 },
        { player: badSS, ops: 0.800, opsVsL: 0.750, opsVsR: 0.850, pa: 500, hr: 20 },
      ];

      // Lineup A: goodSS at SS
      const lineupA = new Map<DepthChartPosition, Set<number>>([
        ["1B", new Set()], ["2B", new Set()], ["3B", new Set()],
        ["SS", new Set([1])], ["CF", new Set()], ["COF", new Set()], ["DH", new Set([2])],
      ]);

      // Lineup B: badSS at SS
      const lineupB = new Map<DepthChartPosition, Set<number>>([
        ["1B", new Set()], ["2B", new Set()], ["3B", new Set()],
        ["SS", new Set([2])], ["CF", new Set()], ["COF", new Set()], ["DH", new Set([1])],
      ]);

      const defA = computeStartingDEF(hitters, lineupA);
      const defB = computeStartingDEF(hitters, lineupB);

      expect(defA).not.toBeNull();
      expect(defB).not.toBeNull();
      // GoodDef SS (5.50) vs BadDef SS (3.50) → defA should be higher
      expect(defA!).toBeGreaterThan(defB!);
    });

    it("late-inning DEF picks best defenders (defLate >= max of defVsL, defVsR)", () => {
      // Player with great defense but bad OPS
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "GoodDef 1B", primary_position: "1B", eligible_1b: 3.50 }),
        makeHitter({ id: 3, name: "BadDef 1B", primary_position: "1B", eligible_1b: 0.50 }),
        makeHitter({ id: 4, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 5, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 6, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 7, name: "Center", primary_position: "OF", eligible_of: 2.15 }),
        makeHitter({ id: 8, name: "Left", primary_position: "OF", eligible_of: 2.07 }),
        makeHitter({ id: 9, name: "Right", primary_position: "OF", eligible_of: 2.07 }),
      ];
      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));
      // BadDef 1B has better OPS, so he starts in OPS lineups
      hitterStats.set(3, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.700));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // MaxDEF lineup should pick GoodDef 1B → defLate should be >= defVsL and defVsR
      expect(result.defLate).not.toBeNull();
      expect(result.defVsL).not.toBeNull();
      expect(result.defVsR).not.toBeNull();
      expect(result.defLate!).toBeGreaterThanOrEqual(Math.max(result.defVsL!, result.defVsR!));
    });

    it("all positions at league average yield DEF of 0.00", () => {
      const { players, hitterStats } = makeFullTeam();
      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      expect(result.defVsL).toBeCloseTo(0.00, 2);
      expect(result.defVsR).toBeCloseTo(0.00, 2);
    });

    it("empty team returns null for all DEF values", () => {
      const result = buildTeamDepthChart(1, "T", false, [], new Map(), new Map(), null);

      expect(result.defVsL).toBeNull();
      expect(result.defVsR).toBeNull();
      expect(result.defLate).toBeNull();
    });

    it("sets inMaxDEF flag correctly on players", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "GoodDef 1B", primary_position: "1B", eligible_1b: 3.50 }),
        makeHitter({ id: 3, name: "BadDef 1B", primary_position: "1B", eligible_1b: 0.50 }),
        makeHitter({ id: 4, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 5, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 6, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 7, name: "Center", primary_position: "OF", eligible_of: 2.15 }),
        makeHitter({ id: 8, name: "Left", primary_position: "OF", eligible_of: 2.07 }),
        makeHitter({ id: 9, name: "Right", primary_position: "OF", eligible_of: 2.07 }),
      ];
      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));
      // BadDef 1B has better OPS — starts in OPS lineups
      hitterStats.set(3, makeHitterStats(0.900));
      hitterStats.set(2, makeHitterStats(0.700));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // GoodDef 1B (id=2) should be in maxDEF
      const goodDef = result.roster["1B"].find((p) => p.id === 2);
      expect(goodDef).toBeDefined();
      expect(goodDef!.inMaxDEF).toBe(true);

      // BadDef 1B (id=3) should NOT be in maxDEF
      const badDef = result.roster["1B"].find((p) => p.id === 3);
      expect(badDef).toBeDefined();
      expect(badDef!.inMaxDEF).toBe(false);

      // Pitchers should never be in maxDEF
      const pitcher = makePitcher({ id: 10, name: "SP", hand: "R" });
      const pitcherStats = new Map<number, AggregatedPitcherStats>();
      pitcherStats.set(10, makePitcherStats(3.50));

      const result2 = buildTeamDepthChart(1, "T", false, [...players, pitcher], hitterStats, pitcherStats, null);
      const sp = result2.roster["P-R"].find((p) => p.id === 10);
      expect(sp).toBeDefined();
      expect(sp!.inMaxDEF).toBe(false);
    });

    it("platoon DH: player at field position in vsL and DH in vsR shows correct roles in both rows", () => {
      // Third (id=5): high opsVsL, low opsVsR → starts 3B in vsL, DH in vsR
      // Third Alt (id=6): low opsVsL, high opsVsR → bench in vsL, starts 3B in vsR
      // The platoon splits are via ob_vl/sl_vl and ob_vr/sl_vr (divided by 1000 and added to base OPS)
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.50,
          ob_vl: 100, sl_vl: 100, ob_vr: -100, sl_vr: -100 }), // vsL: +0.200, vsR: -0.200
        makeHitter({ id: 6, name: "Third Alt", primary_position: "3B", eligible_3b: 2.50,
          ob_vl: -100, sl_vl: -100, ob_vr: 100, sl_vr: 100 }), // vsL: -0.200, vsR: +0.200
        makeHitter({ id: 7, name: "Center", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 8, name: "Left", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 9, name: "Right", primary_position: "OF", eligible_of: 2.10 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      // Give everyone baseline stats — both 3B players at same base OPS
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.750)));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Third (id=5) at 3B should have role="L" (only in vsL lineup at 3B)
      const thirdAt3B = result.roster["3B"].find((p) => p.id === 5);
      expect(thirdAt3B).toBeDefined();
      expect(thirdAt3B!.role).toBe("L");

      // Third (id=5) should appear in DH row with role="R" (DH in vsR)
      const thirdAtDH = result.roster["DH"].find((p) => p.id === 5);
      expect(thirdAtDH).toBeDefined();
      expect(thirdAtDH!.role).toBe("R");
    });

    it("full-time DH: player at DH in both lineups gets role=LR and isPrimary", () => {
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

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      const dhGuy = result.roster["DH"].find((p) => p.id === 9);
      expect(dhGuy).toBeDefined();
      expect(dhGuy!.role).toBe("LR");
      expect(dhGuy!.isPrimary).toBe(true);
    });

    it("DH-only player appears in DH row even when on bench", () => {
      // DH-only player with low OPS — won't be assigned as DH starter
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "Center", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 7, name: "Left", primary_position: "OF", eligible_of: 2.20 }),
        makeHitter({ id: 8, name: "Right", primary_position: "OF", eligible_of: 2.10 }),
        makeHitter({ id: 9, name: "Good DH", primary_position: "DH" }),
        makeHitter({ id: 10, name: "Bench DH", primary_position: "DH" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));
      // Good DH gets the lineup spot
      hitterStats.set(9, makeHitterStats(0.850));
      // Bench DH has lower OPS
      hitterStats.set(10, makeHitterStats(0.600));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Bench DH should still appear in DH row (because primary_position === "DH")
      const benchDH = result.roster["DH"].find((p) => p.id === 10);
      expect(benchDH).toBeDefined();
      expect(benchDH!.role).toBe("bench");
    });

    it("maxDEF optimal: multi-position player assigned to highest-weighted position", () => {
      // Player A (id=2): SS+OF multi-position, eligible_ss=5.0, eligible_of=2.50
      // Player B (id=3): SS-only, eligible_ss=4.8
      // Greedy would lock A at SS (thinnest); optimal puts A at CF (2.50×1.4=3.50)
      // and B at SS (4.8), yielding higher total DEF
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "PlayerA", primary_position: "SS", eligible_ss: 5.0, eligible_of: 2.50 }),
        makeHitter({ id: 3, name: "PlayerB", primary_position: "SS", eligible_ss: 4.8 }),
        makeHitter({ id: 4, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 7, name: "OF1", primary_position: "OF", eligible_of: 2.00 }),
        makeHitter({ id: 8, name: "OF2", primary_position: "OF", eligible_of: 1.90 }),
      ];
      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Player A should be in maxDEF at CF (2.50 >= CF_ELIGIBILITY_THRESHOLD of 2.11)
      const playerAatCF = result.roster["CF"].find((p) => p.id === 2);
      expect(playerAatCF).toBeDefined();
      expect(playerAatCF!.inMaxDEF).toBe(true);

      // Player B should be in maxDEF at SS
      const playerBatSS = result.roster["SS"].find((p) => p.id === 3);
      expect(playerBatSS).toBeDefined();
      expect(playerBatSS!.inMaxDEF).toBe(true);
    });

    it("defLate >= max(defVsL, defVsR) even when no CF-eligible players exist", () => {
      // All OFs have eligible_of < CF_ELIGIBILITY_THRESHOLD (2.11)
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "OF1", primary_position: "OF", eligible_of: 2.00 }),
        makeHitter({ id: 7, name: "OF2", primary_position: "OF", eligible_of: 1.90 }),
        makeHitter({ id: 8, name: "OF3", primary_position: "OF", eligible_of: 1.80 }),
        makeHitter({ id: 9, name: "DH Guy", primary_position: "DH" }),
      ];
      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      expect(result.defLate).not.toBeNull();
      expect(result.defVsL).not.toBeNull();
      expect(result.defVsR).not.toBeNull();
      expect(result.defLate!).toBeGreaterThanOrEqual(Math.max(result.defVsL!, result.defVsR!));
    });
  });

  describe("sole CF reservation", () => {
    it("reserves sole CF-eligible player from greedy loop when also eligible at 1B", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        // Sole CF-eligible player, also eligible at 1B — should go to CF, not 1B
        makeHitter({ id: 2, name: "Soderstrom", primary_position: "1B", eligible_1b: 1.85, eligible_of: 2.50 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        makeHitter({ id: 6, name: "Left", primary_position: "OF", eligible_of: 2.00 }),
        makeHitter({ id: 7, name: "Right", primary_position: "OF", eligible_of: 2.00 }),
        makeHitter({ id: 8, name: "DH Guy", primary_position: "DH" }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));
      // Give Soderstrom high OPS so greedy loop would want him at 1B
      hitterStats.set(2, makeHitterStats(0.900));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Soderstrom should be at CF, not 1B
      const cfIds = result.roster["CF"].map((p) => p.id);
      expect(cfIds).toContain(2);

      const firstBaseStarters = result.roster["1B"].filter((p) => p.role !== "bench");
      const firstBaseStarterIds = firstBaseStarters.map((p) => p.id);
      expect(firstBaseStarterIds).not.toContain(2);
    });

    it("does not reserve when multiple CF-eligible players exist", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "Multi", primary_position: "1B", eligible_1b: 1.85, eligible_of: 2.50 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        // Two CF-eligible players — no reservation needed
        makeHitter({ id: 6, name: "Center1", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 7, name: "Center2", primary_position: "OF", eligible_of: 2.80 }),
        makeHitter({ id: 8, name: "Corner", primary_position: "OF", eligible_of: 2.00 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));
      // Give Multi highest OPS — greedy loop should take him at 1B since CF has options
      hitterStats.set(2, makeHitterStats(0.900));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      // Multi should be at 1B (greedy loop assigns him there, CF has other options)
      const firstBaseStarters = result.roster["1B"].filter((p) => p.role !== "bench");
      expect(firstBaseStarters.map((p) => p.id)).toContain(2);
    });

    it("assigns sole CF player with no other eligibility normally", () => {
      const players: Player[] = [
        makeHitter({ id: 1, name: "Catcher", primary_position: "C" }),
        makeHitter({ id: 2, name: "First", primary_position: "1B", eligible_1b: 1.85 }),
        makeHitter({ id: 3, name: "Second", primary_position: "2B", eligible_2b: 4.25 }),
        makeHitter({ id: 4, name: "Short", primary_position: "SS", eligible_ss: 4.75 }),
        makeHitter({ id: 5, name: "Third", primary_position: "3B", eligible_3b: 2.65 }),
        // Sole CF-eligible, OF-only player — should still end up at CF
        makeHitter({ id: 6, name: "Center Only", primary_position: "OF", eligible_of: 3.50 }),
        makeHitter({ id: 7, name: "Corner1", primary_position: "OF", eligible_of: 2.00 }),
        makeHitter({ id: 8, name: "Corner2", primary_position: "OF", eligible_of: 2.00 }),
      ];

      const hitterStats = new Map<number, AggregatedHitterStats>();
      players.forEach((p) => hitterStats.set(p.id, makeHitterStats(0.800)));

      const result = buildTeamDepthChart(1, "T", false, players, hitterStats, new Map(), null);

      const cfIds = result.roster["CF"].map((p) => p.id);
      expect(cfIds).toContain(6);
    });
  });
});
