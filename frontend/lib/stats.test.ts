import { describe, it, expect } from "vitest";
import {
  aggregateHitterStats,
  aggregatePitcherStats,
  aggregateHitterStatsByPlayer,
  aggregatePitcherStatsByPlayer,
  filterStatsByDateRange,
  formatIP,
  formatAvg,
  formatRate,
  isPlayerPitcher,
  isEligibleAt,
  getEligiblePositions,
  getDefenseDisplay,
} from "./stats";
import { players, hitterStats, pitcherStats } from "./fixtures";
import type { HitterDailyStats, PitcherDailyStats, Player } from "./fixtures";

describe("aggregateHitterStats", () => {
  it("aggregates stats for player 1 from fixture data", () => {
    const player1Stats = hitterStats.filter((s) => s.player_id === 1);
    const aggregated = aggregateHitterStats(player1Stats);

    // Player 1 has 5 days of stats in fixtures
    expect(player1Stats.length).toBeGreaterThan(0);

    // Verify raw sums exist
    expect(aggregated.PA).toBeGreaterThan(0);
    expect(aggregated.AB).toBeGreaterThan(0);
    expect(aggregated.H).toBeGreaterThan(0);

    // Verify calculated stats
    expect(aggregated.AVG).not.toBeNull();
    expect(aggregated.OBP).not.toBeNull();
    expect(aggregated.SLG).not.toBeNull();
    expect(aggregated.OPS).not.toBeNull();

    // AVG = H / AB
    if (aggregated.AVG !== null) {
      expect(aggregated.AVG).toBeCloseTo(aggregated.H / aggregated.AB, 5);
    }

    // OPS = OBP + SLG
    if (aggregated.OPS !== null && aggregated.OBP !== null && aggregated.SLG !== null) {
      expect(aggregated.OPS).toBeCloseTo(aggregated.OBP + aggregated.SLG, 5);
    }
  });

  it("returns zeros and nulls for empty stats array", () => {
    const aggregated = aggregateHitterStats([]);

    expect(aggregated.PA).toBe(0);
    expect(aggregated.AB).toBe(0);
    expect(aggregated.H).toBe(0);
    expect(aggregated.AVG).toBeNull();
    expect(aggregated.OBP).toBeNull();
    expect(aggregated.SLG).toBeNull();
    expect(aggregated.OPS).toBeNull();
  });

  it("calculates correct formulas", () => {
    const stats: HitterDailyStats[] = [
      {
        player_id: 999,
        date: "2025-07-01",
        PA: 5,
        AB: 4,
        H: 2,
        "1B": 1,
        "2B": 1,
        "3B": 0,
        HR: 0,
        SO: 1,
        GO: 0,
        FO: 1,
        GDP: 0,
        BB: 1,
        IBB: 0,
        HBP: 0,
        SB: 0,
        CS: 0,
        R: 1,
        RBI: 1,
        SF: 0,
        SH: 0,
      },
    ];

    const aggregated = aggregateHitterStats(stats);

    // AVG = 2/4 = 0.500
    expect(aggregated.AVG).toBe(0.5);

    // OBP = (2 + 1 + 0) / (4 + 1 + 0 + 0) = 3/5 = 0.600
    expect(aggregated.OBP).toBe(0.6);

    // SLG = (1 + 2*1 + 0 + 0) / 4 = 3/4 = 0.750
    expect(aggregated.SLG).toBe(0.75);

    // OPS = 0.600 + 0.750 = 1.350
    expect(aggregated.OPS).toBe(1.35);
  });
});

describe("aggregatePitcherStats", () => {
  it("aggregates stats for player 14 from fixture data", () => {
    const player14Stats = pitcherStats.filter((s) => s.player_id === 14);
    const aggregated = aggregatePitcherStats(player14Stats);

    // Player 14 should have stats
    expect(player14Stats.length).toBeGreaterThan(0);

    // Verify raw sums
    expect(aggregated.G).toBeGreaterThan(0);
    expect(aggregated.IP_outs).toBeGreaterThan(0);

    // Verify calculated stats
    expect(aggregated.ERA).not.toBeNull();
    expect(aggregated.WHIP).not.toBeNull();
    expect(aggregated.K9).not.toBeNull();
  });

  it("returns zeros and nulls for empty stats array", () => {
    const aggregated = aggregatePitcherStats([]);

    expect(aggregated.G).toBe(0);
    expect(aggregated.IP_outs).toBe(0);
    expect(aggregated.ERA).toBeNull();
    expect(aggregated.WHIP).toBeNull();
    expect(aggregated.K9).toBeNull();
  });

  it("calculates correct formulas", () => {
    const stats: PitcherDailyStats[] = [
      {
        player_id: 999,
        date: "2025-07-01",
        G: 1,
        GS: 1,
        GF: 0,
        CG: 0,
        SHO: 0,
        SV: 0,
        HLD: 0,
        IP_outs: 18, // 6.0 IP
        W: 1,
        L: 0,
        ER: 3,
        R: 3,
        BF: 24,
        H: 5,
        BB: 2,
        IBB: 0,
        HBP: 0,
        K: 6,
        HR: 1,
        WP: 0,
        BK: 0,
      },
    ];

    const aggregated = aggregatePitcherStats(stats);

    // IP = 18/3 = 6.0
    // ERA = (3 / 6.0) * 9 = 4.50
    expect(aggregated.ERA).toBeCloseTo(4.5, 2);

    // WHIP = (5 + 2) / 6.0 = 1.167
    expect(aggregated.WHIP).toBeCloseTo(1.167, 3);

    // K/9 = (6 / 6.0) * 9 = 9.00
    expect(aggregated.K9).toBeCloseTo(9.0, 2);
  });
});

describe("aggregateHitterStatsByPlayer", () => {
  it("creates a map keyed by player_id", () => {
    const aggregated = aggregateHitterStatsByPlayer(hitterStats);

    expect(aggregated.size).toBeGreaterThan(0);

    // Check player 1 exists
    const player1 = aggregated.get(1);
    expect(player1).toBeDefined();
    expect(player1?.PA).toBeGreaterThan(0);
  });
});

describe("aggregatePitcherStatsByPlayer", () => {
  it("creates a map keyed by player_id", () => {
    const aggregated = aggregatePitcherStatsByPlayer(pitcherStats);

    expect(aggregated.size).toBeGreaterThan(0);

    // Check player 14 exists
    const player14 = aggregated.get(14);
    expect(player14).toBeDefined();
    expect(player14?.G).toBeGreaterThan(0);
  });
});

describe("filterStatsByDateRange", () => {
  it("filters by season year", () => {
    const filtered = filterStatsByDateRange(hitterStats, { type: "season", year: 2025 });

    // All fixture stats are from 2025
    expect(filtered.length).toBe(hitterStats.length);

    // Filter for non-existent year
    const empty = filterStatsByDateRange(hitterStats, { type: "season", year: 2024 });
    expect(empty.length).toBe(0);
  });

  it("filters by custom date range", () => {
    const filtered = filterStatsByDateRange(hitterStats, {
      type: "custom",
      start: "2025-07-01",
      end: "2025-07-02",
    });

    // Should only include stats from July 1-2
    expect(filtered.every((s) => s.date >= "2025-07-01" && s.date <= "2025-07-02")).toBe(true);
  });

  it("handles last7/last14/last30 presets", () => {
    // These will return empty with fixture data from July 2025
    // but the filtering mechanism should work
    const last7 = filterStatsByDateRange(hitterStats, { type: "last7" });
    const last14 = filterStatsByDateRange(hitterStats, { type: "last14" });
    const last30 = filterStatsByDateRange(hitterStats, { type: "last30" });

    // Just verify they don't throw
    expect(Array.isArray(last7)).toBe(true);
    expect(Array.isArray(last14)).toBe(true);
    expect(Array.isArray(last30)).toBe(true);
  });
});

describe("formatIP", () => {
  it("formats outs as innings pitched", () => {
    expect(formatIP(0)).toBe("0.0");
    expect(formatIP(1)).toBe("0.1");
    expect(formatIP(2)).toBe("0.2");
    expect(formatIP(3)).toBe("1.0");
    expect(formatIP(16)).toBe("5.1");
    expect(formatIP(21)).toBe("7.0");
    expect(formatIP(27)).toBe("9.0");
  });
});

describe("formatAvg", () => {
  it("formats null as ---", () => {
    expect(formatAvg(null)).toBe("---");
  });

  it("formats numbers with 3 decimals", () => {
    expect(formatAvg(0.3)).toBe("0.300");
    expect(formatAvg(1.0)).toBe("1.000");
    expect(formatAvg(0.0)).toBe("0.000");
    expect(formatAvg(0.333333)).toBe("0.333");
  });
});

describe("formatRate", () => {
  it("formats null as ---", () => {
    expect(formatRate(null)).toBe("---");
  });

  it("formats numbers with 2 decimals", () => {
    expect(formatRate(2.571)).toBe("2.57");
    expect(formatRate(3.5)).toBe("3.50");
    expect(formatRate(0.0)).toBe("0.00");
  });
});

describe("isPlayerPitcher", () => {
  it("returns true for P and SR", () => {
    const pitcher: Player = players.find((p) => p.primary_position === "P")!;
    const swingman: Player = players.find((p) => p.primary_position === "SR") ?? {
      ...players[0],
      primary_position: "SR",
    };

    expect(isPlayerPitcher(pitcher)).toBe(true);
    expect(isPlayerPitcher(swingman)).toBe(true);
  });

  it("returns false for position players", () => {
    const catcher = players.find((p) => p.primary_position === "C")!;
    const outfielder = players.find((p) => p.primary_position === "OF")!;
    const dh = players.find((p) => p.primary_position === "DH") ?? {
      ...players[0],
      primary_position: "DH",
    };

    expect(isPlayerPitcher(catcher)).toBe(false);
    expect(isPlayerPitcher(outfielder)).toBe(false);
    expect(isPlayerPitcher(dh)).toBe(false);
  });
});

describe("isEligibleAt", () => {
  it("returns true for primary position", () => {
    const player = players.find((p) => p.primary_position === "1B")!;
    expect(isEligibleAt(player, "1B")).toBe(true);
  });

  it("returns true for secondary eligible positions", () => {
    // Vladimir Guerrero Jr. is 1B primary, 3B eligible
    const vlad = players.find((p) => p.id === 3)!;
    expect(isEligibleAt(vlad, "1B")).toBe(true);
    expect(isEligibleAt(vlad, "3B")).toBe(true);
  });

  it("returns false for non-eligible positions", () => {
    // Vladimir Guerrero Jr. is not eligible at SS
    const vlad = players.find((p) => p.id === 3)!;
    expect(isEligibleAt(vlad, "SS")).toBe(false);
    expect(isEligibleAt(vlad, "OF")).toBe(false);
  });

  it("returns false for positions without secondary eligibility fields", () => {
    const catcher = players.find((p) => p.primary_position === "C")!;
    // C, DH, P, SR have no secondary eligibility
    expect(isEligibleAt(catcher, "1B")).toBe(false);
  });
});

describe("getEligiblePositions", () => {
  it("includes primary position", () => {
    const player = players[0];
    const positions = getEligiblePositions(player);

    expect(positions).toContain(player.primary_position);
  });

  it("includes secondary positions with defense ratings formatted to 2 decimals", () => {
    // Vladimir Guerrero Jr. is 1B primary, 3B(2) eligible
    const vlad = players.find((p) => p.id === 3)!;
    const positions = getEligiblePositions(vlad);

    expect(positions).toContain("1B(1.00)");
    expect(positions).toContain("3B(2.00)");
  });

  it("formats defense ratings to 2 decimal places", () => {
    const multiPos = players.find(
      (p) => p.eligible_ss !== null || p.eligible_2b !== null
    );

    if (multiPos) {
      const positions = getEligiblePositions(multiPos);

      // All secondary positions should have (X.XX) format
      positions.slice(1).forEach((pos) => {
        if (pos !== multiPos.primary_position) {
          expect(pos).toMatch(/\(\d+\.\d{2}\)$/);
        }
      });
    }
  });
});

describe("getDefenseDisplay", () => {
  it("shows SB/CS for catchers in format C (0.XX-0.XX)", () => {
    // Austin Serven is a catcher with osb_al: 75, ocs_al: 25
    const catcher = players.find((p) => p.id === 1)!;
    const display = getDefenseDisplay(catcher);

    expect(display).toBe("C (0.75-0.25)");
  });

  it("shows just C for catchers without SB/CS data", () => {
    const catcherNoData: Player = {
      ...players[0],
      primary_position: "C",
      osb_al: null,
      ocs_al: null,
    };
    const display = getDefenseDisplay(catcherNoData);

    expect(display).toBe("C");
  });

  it("shows all eligible positions for field players", () => {
    // Vladimir Guerrero Jr.: 1B primary, 3B(2) eligible
    const vlad = players.find((p) => p.id === 3)!;
    const display = getDefenseDisplay(vlad);

    expect(display).toBe("1B(1.00), 3B(2.00)");
  });

  it("shows just primary position for single-position players", () => {
    // Vinnie Pasquantino: 1B only
    const vinnie = players.find((p) => p.id === 2)!;
    const display = getDefenseDisplay(vinnie);

    expect(display).toBe("1B(1.00)");
  });
});
