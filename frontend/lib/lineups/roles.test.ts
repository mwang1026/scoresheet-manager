import { describe, it, expect } from "vitest";
import type { TeamLineup } from "../types";
import type { DepthChartTeam } from "../depth-charts/types";
import {
  buildInferredRoleMap,
  buildRoleMap,
  formatLineupRole,
  isPlayoffStarter,
  isStarter,
  isStartingHitter,
  lineupSortKey,
} from "./roles";

const lineup: TeamLineup = {
  team_id: 1,
  games: 6,
  unknown_hand_games: 0,
  vs_rhp: [
    { slot: 0, position: "SS", pin: 1536, player_id: 10 },
    { slot: 1, position: "RF", pin: 627, player_id: 11 },
    { slot: 2, position: "DH", pin: 4041, player_id: 12 },
    { slot: 3, position: "LF", pin: 2201, player_id: null }, // AAA fill-in
  ],
  vs_lhp: [
    { slot: 0, position: "SS", pin: 1536, player_id: 10 },
    { slot: 1, position: "1B", pin: 455, player_id: 13 },
  ],
  rotation: [
    { pin: 2, player_id: 20, games: 1 },
    { pin: 50, player_id: 21, games: 2 },
    { pin: 13, player_id: 22, games: 1 },
    { pin: 73, player_id: 23, games: 1 },
    { pin: 165, player_id: 24, games: 1 },
  ],
  relievers: [
    { pin: 56, player_id: 30, games: 3 },
    { pin: 50, player_id: 21, games: 1 }, // also a starter: stays SP
  ],
};

describe("buildRoleMap", () => {
  const roles = buildRoleMap(lineup);

  it("assigns slots and positions per hand", () => {
    expect(roles.get(10)).toEqual({
      source: "scoresheet", slotVsR: 0, slotVsL: 0, positionVsR: "SS", positionVsL: "SS",
      rotationNo: null, isReliever: false,
    });
    expect(roles.get(11)?.slotVsR).toBe(1);
    expect(roles.get(11)?.slotVsL).toBeNull();
    expect(roles.get(13)?.slotVsR).toBeNull();
    expect(roles.get(13)?.slotVsL).toBe(1);
  });

  it("skips unresolved pins", () => {
    expect([...roles.keys()]).not.toContain(null);
    expect(roles.size).toBe(10);
  });

  it("numbers the rotation in order and marks relievers", () => {
    expect(roles.get(20)?.rotationNo).toBe(1);
    expect(roles.get(24)?.rotationNo).toBe(5);
    expect(roles.get(30)).toMatchObject({ isReliever: true, rotationNo: null });
    expect(roles.get(21)).toMatchObject({ rotationNo: 2, isReliever: false });
  });

  it("returns an empty map for a missing lineup", () => {
    expect(buildRoleMap(undefined).size).toBe(0);
  });

  it("starter predicates", () => {
    expect(isStartingHitter(roles.get(10))).toBe(true);
    expect(isStartingHitter(roles.get(13))).toBe(true);
    expect(isStartingHitter(roles.get(20))).toBe(false);
    expect(isPlayoffStarter(roles.get(23))).toBe(true);
    expect(isPlayoffStarter(roles.get(24))).toBe(false); // fifth starter
    expect(isStarter(roles.get(30))).toBe(true);
    expect(isStarter(undefined)).toBe(false);
  });
});

describe("lineupSortKey / formatLineupRole", () => {
  const roles = buildRoleMap(lineup);

  it("orders vs-R slots, then vs-L-only, then rotation, relievers, bench", () => {
    const keys = [10, 11, 13, 20, 24, 30, 99].map((id) => lineupSortKey(roles.get(id)));
    expect(keys).toEqual([0, 1, 101, 201, 205, 300, 400]);
  });

  it("formats compact labels", () => {
    expect(formatLineupRole(roles.get(10))).toBe("1 / 1");
    expect(formatLineupRole(roles.get(11))).toBe("2 / –");
    expect(formatLineupRole(roles.get(13))).toBe("– / 2");
    expect(formatLineupRole(roles.get(21))).toBe("SP2");
    expect(formatLineupRole(roles.get(30))).toBe("RP");
    expect(formatLineupRole(undefined)).toBe("B");
    expect(formatLineupRole({ source: "scoresheet", slotVsR: null, slotVsL: null, positionVsR: null, positionVsL: null, rotationNo: null, isReliever: false })).toBe("B");
  });
});

describe("buildInferredRoleMap", () => {
  const player = (id: number, role: "LR" | "L" | "R" | "bench", type: "hitter" | "pitcher" = "hitter") => ({
    id, name: `P${id}`, role, isPrimary: true, stat: null, statVsL: null, statVsR: null,
    defRating: null, defDiff: null, inMaxDEF: false, maxDEFPosition: null, ilType: null, ilDate: null,
    type, hand: "R",
  });
  const team = {
    id: 1, name: "T", isMyTeam: false, vL: null, vR: null, spEra: null, defVsL: null, defVsR: null,
    defLate: null, pickPosition: null, lineupGaps: 0,
    roster: {
      C: [player(1, "LR")], "1B": [player(2, "R"), player(3, "L")], "2B": [], SS: [], "3B": [],
      CF: [], COF: [player(4, "bench")], DH: [],
      "P-L": [player(5, "LR", "pitcher")], "P-R": [player(6, "LR", "pitcher"), player(7, "bench", "pitcher")],
      "SR-L": [], "SR-R": [],
    },
  } as unknown as DepthChartTeam;

  it("marks starters by platoon role with unknown order and numbers SPs", () => {
    const roles = buildInferredRoleMap(team);
    expect(roles.get(1)).toMatchObject({ source: "inferred", slotVsR: 0, slotVsL: 0, positionVsR: "C" });
    expect(roles.get(2)).toMatchObject({ slotVsR: 0, slotVsL: null });
    expect(roles.get(3)).toMatchObject({ slotVsR: null, slotVsL: 0 });
    expect(roles.has(4)).toBe(false);
    expect(roles.get(5)?.rotationNo).toBe(1);
    expect(roles.get(6)?.rotationNo).toBe(2);
    expect(roles.has(7)).toBe(false);
    expect(formatLineupRole(roles.get(1))).toBe("S");
  });
});
