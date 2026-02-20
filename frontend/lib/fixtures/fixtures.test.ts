import { describe, it, expect } from "vitest";
import {
  players,
  teams,
  hitterStats,
  pitcherStats,
  projections,
  draftOrder,
  type Player,
  type Team,
  type HitterDailyStats,
  type PitcherDailyStats,
  type HitterProjection,
  type PitcherProjection,
  type DraftPick,
} from "./types";

describe("Fixture Data Validation", () => {
  describe("players.json", () => {
    it("should parse without errors", () => {
      expect(players).toBeDefined();
      expect(Array.isArray(players)).toBe(true);
    });

    it("should have all required fields", () => {
      players.forEach((player: Player) => {
        expect(player).toHaveProperty("id");
        expect(player).toHaveProperty("name");
        expect(player).toHaveProperty("mlb_id");
        expect(player).toHaveProperty("scoresheet_id");
        expect(player).toHaveProperty("primary_position");
        expect(player).toHaveProperty("hand");
        expect(player).toHaveProperty("age");
        expect(player).toHaveProperty("current_team");
        expect(player).toHaveProperty("team_id");

        expect(typeof player.id).toBe("number");
        expect(typeof player.name).toBe("string");
        expect(typeof player.mlb_id).toBe("number");
        expect(typeof player.scoresheet_id).toBe("number");
        expect(typeof player.primary_position).toBe("string");
        expect(typeof player.hand).toBe("string");
        expect(typeof player.age).toBe("number");
        expect(typeof player.current_team).toBe("string");
        // team_id should be number or null
        if (player.team_id !== null) {
          expect(typeof player.team_id).toBe("number");
        }
      });
    });

    it("should have valid primary_position values", () => {
      const validPositions = ["P", "SR", "C", "1B", "2B", "3B", "SS", "OF", "DH"];
      players.forEach((player: Player) => {
        expect(validPositions).toContain(player.primary_position);
      });
    });

    it("should have valid hand values", () => {
      const validHands = ["L", "R", "S"];
      players.forEach((player: Player) => {
        expect(validHands).toContain(player.hand);
      });
    });

    it("should have position eligibility fields", () => {
      players.forEach((player: Player) => {
        expect(player).toHaveProperty("eligible_1b");
        expect(player).toHaveProperty("eligible_2b");
        expect(player).toHaveProperty("eligible_3b");
        expect(player).toHaveProperty("eligible_ss");
        expect(player).toHaveProperty("eligible_of");

        // Should be number or null
        if (player.eligible_1b !== null) {
          expect(typeof player.eligible_1b).toBe("number");
        }
        if (player.eligible_2b !== null) {
          expect(typeof player.eligible_2b).toBe("number");
        }
        if (player.eligible_3b !== null) {
          expect(typeof player.eligible_3b).toBe("number");
        }
        if (player.eligible_ss !== null) {
          expect(typeof player.eligible_ss).toBe("number");
        }
        if (player.eligible_of !== null) {
          expect(typeof player.eligible_of).toBe("number");
        }
      });
    });

    it("should have catcher-specific stats for catchers only", () => {
      players.forEach((player: Player) => {
        expect(player).toHaveProperty("osb_al");
        expect(player).toHaveProperty("ocs_al");

        if (player.primary_position === "C") {
          // Catchers should have numeric values
          expect(typeof player.osb_al).toBe("number");
          expect(typeof player.ocs_al).toBe("number");
        } else {
          // Non-catchers should have null
          expect(player.osb_al).toBeNull();
          expect(player.ocs_al).toBeNull();
        }
      });
    });

    it("should have platoon splits for hitters only", () => {
      const pitcherPositions = ["P", "SR"];
      players.forEach((player: Player) => {
        expect(player).toHaveProperty("ba_vr");
        expect(player).toHaveProperty("ob_vr");
        expect(player).toHaveProperty("sl_vr");
        expect(player).toHaveProperty("ba_vl");
        expect(player).toHaveProperty("ob_vl");
        expect(player).toHaveProperty("sl_vl");

        if (pitcherPositions.includes(player.primary_position)) {
          // Pitchers should have null platoon splits
          expect(player.ba_vr).toBeNull();
          expect(player.ob_vr).toBeNull();
          expect(player.sl_vr).toBeNull();
          expect(player.ba_vl).toBeNull();
          expect(player.ob_vl).toBeNull();
          expect(player.sl_vl).toBeNull();
        } else {
          // Hitters should have numeric platoon splits
          expect(typeof player.ba_vr).toBe("number");
          expect(typeof player.ob_vr).toBe("number");
          expect(typeof player.sl_vr).toBe("number");
          expect(typeof player.ba_vl).toBe("number");
          expect(typeof player.ob_vl).toBe("number");
          expect(typeof player.sl_vl).toBe("number");
        }
      });
    });

    it("should have at least 15 players", () => {
      expect(players.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("teams.json", () => {
    it("should parse without errors", () => {
      expect(teams).toBeDefined();
      expect(Array.isArray(teams)).toBe(true);
    });

    it("should have all required fields", () => {
      teams.forEach((team: Team) => {
        expect(team).toHaveProperty("id");
        expect(team).toHaveProperty("name");
        expect(team).toHaveProperty("scoresheet_team_id");
        expect(team).toHaveProperty("is_my_team");

        expect(typeof team.id).toBe("number");
        expect(typeof team.name).toBe("string");
        expect(typeof team.scoresheet_team_id).toBe("string");
        expect(typeof team.is_my_team).toBe("boolean");
      });
    });

    it("should have at least one team marked as is_my_team", () => {
      const myTeams = teams.filter((team) => team.is_my_team);
      expect(myTeams.length).toBeGreaterThanOrEqual(1);
    });

    it("should have exactly 10 teams", () => {
      expect(teams.length).toBe(10);
    });
  });

  describe("hitter-stats.json", () => {
    it("should parse without errors", () => {
      expect(hitterStats).toBeDefined();
      expect(Array.isArray(hitterStats)).toBe(true);
    });

    it("should have all required fields with correct types", () => {
      hitterStats.forEach((stat: HitterDailyStats) => {
        // Required fields
        expect(stat).toHaveProperty("player_id");
        expect(stat).toHaveProperty("date");
        expect(stat).toHaveProperty("PA");
        expect(stat).toHaveProperty("AB");
        expect(stat).toHaveProperty("H");
        expect(stat).toHaveProperty("1B");
        expect(stat).toHaveProperty("2B");
        expect(stat).toHaveProperty("3B");
        expect(stat).toHaveProperty("HR");
        expect(stat).toHaveProperty("BB");
        expect(stat).toHaveProperty("SO");
        expect(stat).toHaveProperty("R");
        expect(stat).toHaveProperty("RBI");

        // Type checking
        expect(typeof stat.player_id).toBe("number");
        expect(typeof stat.date).toBe("string");
        expect(typeof stat.PA).toBe("number");
        expect(typeof stat.AB).toBe("number");
        expect(typeof stat.H).toBe("number");
      });
    });

    it("should NOT contain calculated stats (AVG, OBP, SLG, OPS)", () => {
      hitterStats.forEach((stat) => {
        expect(stat).not.toHaveProperty("AVG");
        expect(stat).not.toHaveProperty("OBP");
        expect(stat).not.toHaveProperty("SLG");
        expect(stat).not.toHaveProperty("OPS");
      });
    });

    it("should reference valid player IDs", () => {
      const playerIds = new Set(players.map((p) => p.id));
      hitterStats.forEach((stat) => {
        expect(playerIds.has(stat.player_id)).toBe(true);
      });
    });

    it("should have dates in correct format (YYYY-MM-DD)", () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      hitterStats.forEach((stat) => {
        expect(stat.date).toMatch(dateRegex);
      });
    });

    it("should have internally consistent stats", () => {
      hitterStats.forEach((stat) => {
        // H should equal 1B + 2B + 3B + HR
        expect(stat.H).toBe(stat["1B"] + stat["2B"] + stat["3B"] + stat.HR);
      });
    });
  });

  describe("pitcher-stats.json", () => {
    it("should parse without errors", () => {
      expect(pitcherStats).toBeDefined();
      expect(Array.isArray(pitcherStats)).toBe(true);
    });

    it("should have all required fields with correct types", () => {
      pitcherStats.forEach((stat: PitcherDailyStats) => {
        // Required fields
        expect(stat).toHaveProperty("player_id");
        expect(stat).toHaveProperty("date");
        expect(stat).toHaveProperty("G");
        expect(stat).toHaveProperty("GS");
        expect(stat).toHaveProperty("IP_outs");
        expect(stat).toHaveProperty("W");
        expect(stat).toHaveProperty("L");
        expect(stat).toHaveProperty("ER");
        expect(stat).toHaveProperty("K");

        // Type checking
        expect(typeof stat.player_id).toBe("number");
        expect(typeof stat.date).toBe("string");
        expect(typeof stat.G).toBe("number");
        expect(typeof stat.IP_outs).toBe("number");
      });
    });

    it("should have IP_outs as integer (not decimal)", () => {
      pitcherStats.forEach((stat) => {
        expect(Number.isInteger(stat.IP_outs)).toBe(true);
      });
    });

    it("should NOT contain calculated stats (ERA, WHIP, K/9)", () => {
      pitcherStats.forEach((stat) => {
        expect(stat).not.toHaveProperty("ERA");
        expect(stat).not.toHaveProperty("WHIP");
        expect(stat).not.toHaveProperty("K/9");
        expect(stat).not.toHaveProperty("K9");
        expect(stat).not.toHaveProperty("IP"); // Should use IP_outs instead
      });
    });

    it("should reference valid player IDs", () => {
      const playerIds = new Set(players.map((p) => p.id));
      pitcherStats.forEach((stat) => {
        expect(playerIds.has(stat.player_id)).toBe(true);
      });
    });

    it("should have dates in correct format (YYYY-MM-DD)", () => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      pitcherStats.forEach((stat) => {
        expect(stat.date).toMatch(dateRegex);
      });
    });
  });

  describe("projections.json", () => {
    it("should parse without errors", () => {
      expect(projections).toBeDefined();
      expect(Array.isArray(projections)).toBe(true);
    });

    it("should have all required fields", () => {
      projections.forEach((proj) => {
        expect(proj).toHaveProperty("player_id");
        expect(proj).toHaveProperty("source");
        expect(proj).toHaveProperty("player_type");

        expect(typeof proj.player_id).toBe("number");
        expect(typeof proj.source).toBe("string");
        expect(["hitter", "pitcher"]).toContain(proj.player_type);
      });
    });

    it("should have hitter projections with required fields", () => {
      const hitterProjs = projections.filter(
        (p): p is HitterProjection => p.player_type === "hitter"
      );

      hitterProjs.forEach((proj) => {
        expect(proj).toHaveProperty("PA");
        expect(proj).toHaveProperty("AB");
        expect(proj).toHaveProperty("H");
        expect(proj).toHaveProperty("HR");
        expect(proj).toHaveProperty("R");
        expect(proj).toHaveProperty("RBI");
        expect(proj).toHaveProperty("SB");
      });
    });

    it("should have pitcher projections with required fields", () => {
      const pitcherProjs = projections.filter(
        (p): p is PitcherProjection => p.player_type === "pitcher"
      );

      pitcherProjs.forEach((proj) => {
        expect(proj).toHaveProperty("G");
        expect(proj).toHaveProperty("GS");
        expect(proj).toHaveProperty("IP_outs");
        expect(proj).toHaveProperty("W");
        expect(proj).toHaveProperty("L");
        expect(proj).toHaveProperty("K");
        expect(proj).toHaveProperty("ER");
      });
    });

    it("should NOT contain calculated stats in projections", () => {
      projections.forEach((proj) => {
        expect(proj).not.toHaveProperty("AVG");
        expect(proj).not.toHaveProperty("OPS");
        expect(proj).not.toHaveProperty("ERA");
        expect(proj).not.toHaveProperty("WHIP");
      });
    });

    it("should reference valid player IDs", () => {
      const playerIds = new Set(players.map((p) => p.id));
      projections.forEach((proj) => {
        expect(playerIds.has(proj.player_id)).toBe(true);
      });
    });

    it("should have pitcher projections with IP_outs as integer", () => {
      const pitcherProjs = projections.filter(
        (p): p is PitcherProjection => p.player_type === "pitcher"
      );

      pitcherProjs.forEach((proj) => {
        expect(Number.isInteger(proj.IP_outs)).toBe(true);
      });
    });
  });

  describe("draft-order.json", () => {
    it("should parse without errors", () => {
      expect(draftOrder).toBeDefined();
      expect(Array.isArray(draftOrder)).toBe(true);
    });

    it("should have exactly 40 picks (4 rounds × 10 teams)", () => {
      expect(draftOrder.length).toBe(40);
    });

    it("should have all required fields with correct types", () => {
      draftOrder.forEach((pick: DraftPick) => {
        expect(pick).toHaveProperty("pick_number");
        expect(pick).toHaveProperty("round");
        expect(pick).toHaveProperty("pick_in_round");
        expect(pick).toHaveProperty("team_id");
        expect(pick).toHaveProperty("player_id");
        expect(pick).toHaveProperty("scheduled_time");

        expect(typeof pick.pick_number).toBe("number");
        expect(typeof pick.round).toBe("number");
        expect(typeof pick.pick_in_round).toBe("number");
        expect(typeof pick.team_id).toBe("number");
        expect(typeof pick.scheduled_time).toBe("string");
        // player_id should be number or null
        if (pick.player_id !== null) {
          expect(typeof pick.player_id).toBe("number");
        }
      });
    });

    it("should have picks numbered sequentially from 1 to 40", () => {
      draftOrder.forEach((pick, index) => {
        expect(pick.pick_number).toBe(index + 1);
      });
    });

    it("should have valid round numbers (1-4)", () => {
      draftOrder.forEach((pick) => {
        expect(pick.round).toBeGreaterThanOrEqual(1);
        expect(pick.round).toBeLessThanOrEqual(4);
      });
    });

    it("should have valid pick_in_round (1-10)", () => {
      draftOrder.forEach((pick) => {
        expect(pick.pick_in_round).toBeGreaterThanOrEqual(1);
        expect(pick.pick_in_round).toBeLessThanOrEqual(10);
      });
    });

    it("should reference valid team IDs", () => {
      const teamIds = new Set(teams.map((t) => t.id));
      draftOrder.forEach((pick) => {
        expect(teamIds.has(pick.team_id)).toBe(true);
      });
    });

    it("should have scheduled times in ISO 8601 format with timezone", () => {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
      draftOrder.forEach((pick) => {
        expect(pick.scheduled_time).toMatch(isoRegex);
      });
    });

    it("should implement snake draft order", () => {
      // Round 1 (picks 1-10): teams 2,3,1,4,5,6,7,8,9,10
      // Round 2 (picks 11-20): reversed order
      // Round 3 (picks 21-30): same as round 1
      // Round 4 (picks 31-40): reversed order
      const round1Teams = draftOrder.slice(0, 10).map((p) => p.team_id);
      const round2Teams = draftOrder.slice(10, 20).map((p) => p.team_id);
      const round3Teams = draftOrder.slice(20, 30).map((p) => p.team_id);
      const round4Teams = draftOrder.slice(30, 40).map((p) => p.team_id);

      // Round 2 should be reverse of round 1
      expect(round2Teams).toEqual([...round1Teams].reverse());
      // Round 3 should match round 1
      expect(round3Teams).toEqual(round1Teams);
      // Round 4 should match round 2
      expect(round4Teams).toEqual(round2Teams);
    });

    it("should have Power Hitters (team 1) at picks 3, 18, 23, 38", () => {
      // Team 1 picks 3rd in odd rounds, 8th in even rounds
      const team1Picks = draftOrder.filter((p) => p.team_id === 1);
      expect(team1Picks.length).toBe(4);
      expect(team1Picks[0].pick_number).toBe(3);
      expect(team1Picks[1].pick_number).toBe(18);
      expect(team1Picks[2].pick_number).toBe(23);
      expect(team1Picks[3].pick_number).toBe(38);
    });
  });
});
