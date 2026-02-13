import { describe, it, expect } from "vitest";
import {
  players,
  teams,
  hitterStats,
  pitcherStats,
  projections,
  type Player,
  type Team,
  type HitterDailyStats,
  type PitcherDailyStats,
  type HitterProjection,
  type PitcherProjection,
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
        expect(player).toHaveProperty("trade_bait");

        expect(typeof player.id).toBe("number");
        expect(typeof player.name).toBe("string");
        expect(typeof player.mlb_id).toBe("number");
        expect(typeof player.scoresheet_id).toBe("number");
        expect(typeof player.primary_position).toBe("string");
        expect(typeof player.hand).toBe("string");
        expect(typeof player.age).toBe("number");
        expect(typeof player.current_team).toBe("string");
        expect(typeof player.trade_bait).toBe("boolean");
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

    it("should have exactly 4 teams", () => {
      expect(teams.length).toBe(4);
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
      hitterStats.forEach((stat: Record<string, unknown>) => {
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
      pitcherStats.forEach((stat: Record<string, unknown>) => {
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
      projections.forEach((proj: Record<string, unknown>) => {
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
});
