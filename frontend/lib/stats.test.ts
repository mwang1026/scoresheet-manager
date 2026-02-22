import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  getAvailableProjectionSources,
  getProjectionStatsMaps,
} from "./stats";
import { players, hitterStats, pitcherStats, projections } from "./fixtures";
import type { HitterDailyStats, PitcherDailyStats, Player, Projection } from "./fixtures";

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

  describe("wtd (week-to-date) filtering", () => {
    beforeEach(() => {
      // Set a fixed "today" for predictable testing
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.skip("filters from most recent Monday to today (Wednesday)", () => {
      // Set today to Wednesday, July 9, 2025
      vi.setSystemTime(new Date("2025-07-09"));

      const testStats: HitterDailyStats[] = [
        { ...hitterStats[0], date: "2025-07-06" }, // Sunday (before Monday)
        { ...hitterStats[0], date: "2025-07-07" }, // Monday (start of week) ✓
        { ...hitterStats[0], date: "2025-07-08" }, // Tuesday ✓
        { ...hitterStats[0], date: "2025-07-09" }, // Wednesday (today) ✓
        { ...hitterStats[0], date: "2025-07-10" }, // Thursday (future)
      ];

      const filtered = filterStatsByDateRange(testStats, { type: "wtd" });

      expect(filtered.length).toBe(3);
      expect(filtered.map((s) => s.date)).toEqual([
        "2025-07-07",
        "2025-07-08",
        "2025-07-09",
      ]);
    });

    it.skip("filters from most recent Monday to today (Sunday)", () => {
      // Set today to Sunday, July 13, 2025 (end of week)
      vi.setSystemTime(new Date("2025-07-13"));

      const testStats: HitterDailyStats[] = [
        { ...hitterStats[0], date: "2025-07-06" }, // Previous Sunday
        { ...hitterStats[0], date: "2025-07-07" }, // Monday (start of week) ✓
        { ...hitterStats[0], date: "2025-07-12" }, // Saturday ✓
        { ...hitterStats[0], date: "2025-07-13" }, // Sunday (today) ✓
        { ...hitterStats[0], date: "2025-07-14" }, // Monday (future)
      ];

      const filtered = filterStatsByDateRange(testStats, { type: "wtd" });

      expect(filtered.length).toBe(3);
      expect(filtered.map((s) => s.date)).toEqual([
        "2025-07-07",
        "2025-07-12",
        "2025-07-13",
      ]);
    });

    it.skip("filters from most recent Monday to today (Monday)", () => {
      // Set today to Monday, July 7, 2025 (first day of week)
      vi.setSystemTime(new Date("2025-07-07"));

      const testStats: HitterDailyStats[] = [
        { ...hitterStats[0], date: "2025-07-06" }, // Sunday (before)
        { ...hitterStats[0], date: "2025-07-07" }, // Monday (today) ✓
        { ...hitterStats[0], date: "2025-07-08" }, // Tuesday (future)
      ];

      const filtered = filterStatsByDateRange(testStats, { type: "wtd" });

      expect(filtered.length).toBe(1);
      expect(filtered[0].date).toBe("2025-07-07");
    });
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
    // Jazz Chisholm is 2B primary, 3B eligible
    const jazz = players.find((p) => p.id === 3)!;
    expect(isEligibleAt(jazz, "2B")).toBe(true);
    expect(isEligibleAt(jazz, "3B")).toBe(true);
  });

  it("returns false for non-eligible positions", () => {
    // Jazz Chisholm is not eligible at 1B, SS, or OF
    const jazz = players.find((p) => p.id === 3)!;
    expect(isEligibleAt(jazz, "1B")).toBe(false);
    expect(isEligibleAt(jazz, "SS")).toBe(false);
    expect(isEligibleAt(jazz, "OF")).toBe(false);
  });

  it("returns false for positions without secondary eligibility fields", () => {
    const catcher = players.find((p) => p.primary_position === "C")!;
    // C, DH, P, SR have no secondary eligibility
    expect(isEligibleAt(catcher, "1B")).toBe(false);
  });
});

describe("getEligiblePositions", () => {
  it("includes primary position", () => {
    // Bryce Harper is 1B with rating 1.85
    const player = players[0];
    const positions = getEligiblePositions(player);

    expect(positions[0]).toBe("1B(1.85)");
  });

  it("includes secondary positions with defense ratings formatted to 2 decimals", () => {
    // Jazz Chisholm is 2B primary, 3B eligible
    const jazz = players.find((p) => p.id === 3)!;
    const positions = getEligiblePositions(jazz);

    expect(positions).toContain("2B(4.32)");
    expect(positions).toContain("3B(2.67)");
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
    // Alejandro Kirk is a catcher with osb_al: 0.68, ocs_al: 0.24
    const catcher = players.find((p) => p.id === 11)!;
    const display = getDefenseDisplay(catcher);

    expect(display).toBe("C (0.68-0.24)");
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
    // Jazz Chisholm: 2B primary, 3B eligible
    const jazz = players.find((p) => p.id === 3)!;
    const display = getDefenseDisplay(jazz);

    expect(display).toBe("2B(4.32), 3B(2.67)");
  });

  it("shows just primary position for single-position players", () => {
    // Jake Burger: 1B only with rating 1.85
    const jake = players.find((p) => p.id === 2)!;
    const display = getDefenseDisplay(jake);

    expect(display).toBe("1B(1.85)");
  });
});

describe("getAvailableProjectionSources", () => {
  it("returns empty array for empty input", () => {
    const sources = getAvailableProjectionSources([]);
    expect(sources).toEqual([]);
  });

  it("returns single source", () => {
    const testProjections: Projection[] = [
      { player_id: 1, source: "PECOTA-50", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
    ];
    const sources = getAvailableProjectionSources(testProjections);
    expect(sources).toEqual(["PECOTA-50"]);
  });

  it("returns multiple sources sorted", () => {
    const testProjections: Projection[] = [
      { player_id: 1, source: "ZiPS", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
      { player_id: 2, source: "PECOTA-50", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
      { player_id: 3, source: "Steamer", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
    ];
    const sources = getAvailableProjectionSources(testProjections);
    expect(sources).toEqual(["PECOTA-50", "Steamer", "ZiPS"]);
  });

  it("deduplicates sources", () => {
    const testProjections: Projection[] = [
      { player_id: 1, source: "PECOTA-50", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
      { player_id: 2, source: "PECOTA-50", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
      { player_id: 3, source: "PECOTA-50", player_type: "pitcher", G: 30, GS: 30, GF: 0, CG: 1, SHO: 0, SV: 0, HLD: 0, IP_outs: 540, W: 12, L: 8, ER: 60, R: 65, BF: 700, H: 150, BB: 40, IBB: 2, HBP: 5, K: 200, HR: 20, WP: 3, BK: 0 },
    ];
    const sources = getAvailableProjectionSources(testProjections);
    expect(sources).toEqual(["PECOTA-50"]);
  });

  it("works with fixture data", () => {
    const sources = getAvailableProjectionSources(projections);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources).toContain("PECOTA-50");
  });
});

describe("getProjectionStatsMaps", () => {
  it("filters by source correctly", () => {
    const testProjections: Projection[] = [
      { player_id: 1, source: "PECOTA-50", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
      { player_id: 2, source: "Steamer", player_type: "hitter", PA: 650, AB: 560, H: 160, "1B": 85, "2B": 32, "3B": 3, HR: 40, BB: 80, IBB: 6, HBP: 6, SO: 130, SB: 12, CS: 4, R: 100, RBI: 105, SF: 4, SH: 0, GO: 145, FO: 85, GDP: 11 },
      { player_id: 14, source: "PECOTA-50", player_type: "pitcher", G: 30, GS: 30, GF: 0, CG: 1, SHO: 0, SV: 0, HLD: 0, IP_outs: 540, W: 12, L: 8, ER: 60, R: 65, BF: 700, H: 150, BB: 40, IBB: 2, HBP: 5, K: 200, HR: 20, WP: 3, BK: 0 },
      { player_id: 15, source: "Steamer", player_type: "pitcher", G: 32, GS: 32, GF: 0, CG: 2, SHO: 1, SV: 0, HLD: 0, IP_outs: 570, W: 14, L: 9, ER: 65, R: 70, BF: 730, H: 155, BB: 42, IBB: 3, HBP: 6, K: 215, HR: 22, WP: 4, BK: 0 },
    ];

    const { hitterStatsMap, pitcherStatsMap } = getProjectionStatsMaps(testProjections, "PECOTA-50");

    // Should only have PECOTA-50 projections
    expect(hitterStatsMap.size).toBe(1);
    expect(hitterStatsMap.has(1)).toBe(true);
    expect(hitterStatsMap.has(2)).toBe(false);

    expect(pitcherStatsMap.size).toBe(1);
    expect(pitcherStatsMap.has(14)).toBe(true);
    expect(pitcherStatsMap.has(15)).toBe(false);

    // Verify stats are aggregated correctly
    const hitter1Stats = hitterStatsMap.get(1)!;
    expect(hitter1Stats.PA).toBe(600);
    expect(hitter1Stats.H).toBe(150);
    expect(hitter1Stats.AVG).toBeCloseTo(150 / 520, 5);

    const pitcher14Stats = pitcherStatsMap.get(14)!;
    expect(pitcher14Stats.G).toBe(30);
    expect(pitcher14Stats.IP_outs).toBe(540);
  });

  it("returns empty maps for unknown source", () => {
    const testProjections: Projection[] = [
      { player_id: 1, source: "PECOTA-50", player_type: "hitter", PA: 600, AB: 520, H: 150, "1B": 80, "2B": 30, "3B": 2, HR: 38, BB: 70, IBB: 5, HBP: 5, SO: 120, SB: 10, CS: 3, R: 95, RBI: 100, SF: 3, SH: 0, GO: 140, FO: 80, GDP: 10 },
    ];

    const { hitterStatsMap, pitcherStatsMap } = getProjectionStatsMaps(testProjections, "NonExistent");

    expect(hitterStatsMap.size).toBe(0);
    expect(pitcherStatsMap.size).toBe(0);
  });

  it("works with fixture data", () => {
    const sources = getAvailableProjectionSources(projections);
    const firstSource = sources[0];

    const { hitterStatsMap, pitcherStatsMap } = getProjectionStatsMaps(projections, firstSource);

    expect(hitterStatsMap.size).toBeGreaterThan(0);
    expect(pitcherStatsMap.size).toBeGreaterThan(0);

    // Verify stats have been aggregated (calculated fields exist)
    const firstHitterId = Array.from(hitterStatsMap.keys())[0];
    const hitterStats = hitterStatsMap.get(firstHitterId)!;
    expect(hitterStats.AVG).toBeDefined();
    expect(hitterStats.OPS).toBeDefined();

    const firstPitcherId = Array.from(pitcherStatsMap.keys())[0];
    const pitcherStats = pitcherStatsMap.get(firstPitcherId)!;
    expect(pitcherStats.ERA).toBeDefined();
    expect(pitcherStats.WHIP).toBeDefined();
  });
});
