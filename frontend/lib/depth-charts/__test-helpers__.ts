/**
 * Shared test factories for depth chart tests.
 */

import type { Player } from "../types";
import type { AggregatedHitterStats, AggregatedPitcherStats } from "../stats/types";

/** Create a hitter player with sensible defaults */
export function makeHitter(overrides: Partial<Player> & { id: number; name: string }): Player {
  const nameParts = overrides.name.split(" ");
  return {
    first_name: overrides.first_name ?? nameParts[0],
    last_name: overrides.last_name ?? (nameParts.slice(1).join(" ") || nameParts[0]),
    mlb_id: overrides.id,
    scoresheet_id: overrides.id,
    primary_position: "OF",
    hand: "R",
    age: 28,
    current_team: "NYY",
    team_id: 1,
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
    oop_positions: [],
    ...overrides,
  };
}

/** Create a pitcher player with sensible defaults */
export function makePitcher(overrides: Partial<Player> & { id: number; name: string }): Player {
  return makeHitter({
    primary_position: "P",
    hand: "R",
    ...overrides,
  });
}

/** Create aggregated hitter stats with a given OPS */
export function makeHitterStats(ops: number, pa = 500): AggregatedHitterStats {
  const ab = Math.round(pa * 0.87);
  const h = Math.round(ab * 0.260);
  const hr = Math.round(h * 0.15);
  const doubles = Math.round(h * 0.2);
  const triples = Math.round(h * 0.02);
  const singles = h - hr - doubles - triples;
  const bb = Math.round(pa * 0.08);
  const hbp = Math.round(pa * 0.01);
  const sf = 3;
  const obpDenom = ab + bb + hbp + sf;
  const OBP = obpDenom > 0 ? (h + bb + hbp) / obpDenom : null;
  const totalBases = singles + 2 * doubles + 3 * triples + 4 * hr;
  const SLG = ab > 0 ? totalBases / ab : null;
  return {
    PA: pa, AB: ab, H: h, "1B": singles, "2B": doubles, "3B": triples,
    HR: hr, SO: 100, GO: 80, FO: 60, GDP: 10, BB: bb, IBB: 3,
    HBP: hbp, SB: 5, CS: 2, R: 70, RBI: 65, SF: sf, SH: 0,
    AVG: ab > 0 ? h / ab : null,
    OBP,
    SLG,
    OPS: ops, // Override for deterministic testing
  };
}

/** Create aggregated pitcher stats with a given ERA */
export function makePitcherStats(era: number, ipOuts = 540): AggregatedPitcherStats {
  const ip = ipOuts / 3;
  return {
    G: 30, GS: 30, GF: 0, CG: 1, SHO: 0, SV: 0, HLD: 0,
    IP_outs: ipOuts, W: 12, L: 8,
    ER: Math.round((era * ip) / 9),
    R: Math.round((era * ip) / 9) + 5,
    BF: 700, H: 150, BB: 40, IBB: 2, HBP: 5,
    K: 200, HR: 20, WP: 3, BK: 0,
    ERA: era,
    WHIP: 1.10,
    K9: 10.0,
  };
}
