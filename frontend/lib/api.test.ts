import { describe, it, expect } from "vitest";
import { transformPlayer, type BackendPlayer } from "./api";

function makeBackendPlayer(overrides: Partial<BackendPlayer> = {}): BackendPlayer {
  return {
    id: 1,
    first_name: "Test",
    last_name: "Player",
    name: "Test Player",
    mlb_id: 100,
    scoresheet_id: 200,
    primary_position: "2B",
    current_mlb_team: "NYY",
    current_team: "NYY",
    bats: "R",
    hand: null,
    throws: "R",
    age: 28,
    team_id: 5,
    eligible_1b: false,
    eligible_2b: true,
    eligible_3b: false,
    eligible_ss: true,
    eligible_of: false,
    osb_al: null,
    ocs_al: null,
    ba_vr: null,
    ob_vr: null,
    sl_vr: null,
    ba_vl: null,
    ob_vl: null,
    sl_vl: null,
    ...overrides,
  };
}

describe("transformPlayer", () => {
  it('maps bats "B" to hand "S" (switch hitter)', () => {
    const result = transformPlayer(makeBackendPlayer({ bats: "B", hand: null }));
    expect(result.hand).toBe("S");
  });

  it('maps bats "L" to hand "L" (left-handed)', () => {
    const result = transformPlayer(makeBackendPlayer({ bats: "L", hand: null }));
    expect(result.hand).toBe("L");
  });

  it('maps bats "R" to hand "R" (right-handed)', () => {
    const result = transformPlayer(makeBackendPlayer({ bats: "R", hand: null }));
    expect(result.hand).toBe("R");
  });

  it("prefers hand field over bats when both are present", () => {
    const result = transformPlayer(makeBackendPlayer({ bats: "B", hand: "R" }));
    expect(result.hand).toBe("R");
  });

  it("maps name correctly", () => {
    const result = transformPlayer(makeBackendPlayer({ name: "Shohei Ohtani" }));
    expect(result.name).toBe("Shohei Ohtani");
  });

  it("maps primary_position correctly", () => {
    const result = transformPlayer(makeBackendPlayer({ primary_position: "OF" }));
    expect(result.primary_position).toBe("OF");
  });

  it("maps current_team from current_team field", () => {
    const result = transformPlayer(makeBackendPlayer({ current_team: "LAD", current_mlb_team: "NYY" }));
    expect(result.current_team).toBe("LAD");
  });

  it("falls back to current_mlb_team when current_team is null", () => {
    const result = transformPlayer(makeBackendPlayer({ current_team: null, current_mlb_team: "BOS" }));
    expect(result.current_team).toBe("BOS");
  });

  it("maps eligibility fields correctly", () => {
    const result = transformPlayer(
      makeBackendPlayer({ eligible_1b: true, eligible_2b: false, eligible_3b: true, eligible_ss: false, eligible_of: true })
    );
    expect(result.eligible_1b).toBe(true);
    expect(result.eligible_2b).toBe(false);
    expect(result.eligible_3b).toBe(true);
    expect(result.eligible_ss).toBe(false);
    expect(result.eligible_of).toBe(true);
  });
});
