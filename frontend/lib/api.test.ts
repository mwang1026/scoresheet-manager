import { describe, it, expect, vi, afterEach } from "vitest";
import {
  transformPlayer,
  type BackendPlayer,
  fetchScrapedTeams,
  fetchScrapedLeagues,
  addMyTeam,
  removeMyTeam,
  fetchMyTeams,
} from "./api";

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
    eligible_1b: null,
    eligible_2b: 4.0,
    eligible_3b: null,
    eligible_ss: 4.0,
    eligible_of: null,
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

  it("maps eligibility fields correctly (numeric ratings, null when not eligible)", () => {
    const result = transformPlayer(
      makeBackendPlayer({ eligible_1b: 5.0, eligible_2b: null, eligible_3b: 4.0, eligible_ss: null, eligible_of: 5.0 })
    );
    expect(result.eligible_1b).toBe(5.0);
    expect(result.eligible_2b).toBeNull();
    expect(result.eligible_3b).toBe(4.0);
    expect(result.eligible_ss).toBeNull();
    expect(result.eligible_of).toBe(5.0);
  });
});

// ---------------------------------------------------------------------------
// fetch wrapper URL boundary tests
// ---------------------------------------------------------------------------

function mockFetch(ok: boolean, body: unknown, statusText = "Error"): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok,
    statusText,
    json: () => Promise.resolve(body),
  });
}

describe("fetchScrapedTeams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls fetch with the raw data_path (no encodeURIComponent)", async () => {
    vi.stubGlobal("fetch", mockFetch(true, { teams: [{ scoresheet_id: 1, owner_name: "Owner" }] }));

    const result = await fetchScrapedTeams("FOR_WWW1/AL_Catfish_Hunter");

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/scoresheet/leagues/FOR_WWW1/AL_Catfish_Hunter/teams"
    );
    expect(result).toEqual([{ scoresheet_id: 1, owner_name: "Owner" }]);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(false, {}, "Not Found"));

    await expect(fetchScrapedTeams("FOR_WWW1/AL_Catfish_Hunter")).rejects.toThrow(
      "Failed to fetch teams"
    );
  });
});

describe("fetchScrapedLeagues", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls GET /api/scoresheet/leagues and returns leagues array", async () => {
    const leagues = [{ name: "AL Catfish Hunter", data_path: "FOR_WWW1/AL_Catfish_Hunter" }];
    vi.stubGlobal("fetch", mockFetch(true, { leagues }));

    const result = await fetchScrapedLeagues();

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith("/api/scoresheet/leagues");
    expect(result).toEqual(leagues);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(false, {}, "Internal Server Error"));

    await expect(fetchScrapedLeagues()).rejects.toThrow("Failed to fetch leagues");
  });
});

describe("addMyTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls POST /api/me/teams with correct JSON body", async () => {
    const myTeam = { id: 1, name: "Team 1", scoresheet_id: 2, league_id: 1, league_name: "AL", league_season: 2026, role: "owner" };
    vi.stubGlobal("fetch", mockFetch(true, myTeam));

    const result = await addMyTeam("FOR_WWW1/AL_Catfish_Hunter", 2);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/me/teams",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ data_path: "FOR_WWW1/AL_Catfish_Hunter", scoresheet_team_id: 2 }),
      })
    );
    expect(result).toEqual(myTeam);
  });

  it("throws with detail string on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(false, { detail: "User is already associated" }));

    await expect(addMyTeam("FOR_WWW1/AL_Catfish_Hunter", 2)).rejects.toThrow(
      "User is already associated"
    );
  });
});

describe("removeMyTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls DELETE /api/me/teams/{teamId}", async () => {
    vi.stubGlobal("fetch", mockFetch(true, null));

    await removeMyTeam(42);

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/me/teams/42",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws with detail string on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(false, { detail: "Cannot remove last team" }));

    await expect(removeMyTeam(42)).rejects.toThrow("Cannot remove last team");
  });
});

describe("fetchMyTeams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls GET /api/me/teams and returns teams array", async () => {
    const teams = [{ id: 1, name: "Team 1", scoresheet_id: 1, league_id: 1, league_name: "AL", league_season: 2026, role: "owner" }];
    vi.stubGlobal("fetch", mockFetch(true, { teams }));

    const result = await fetchMyTeams();

    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/me/teams",
      expect.objectContaining({})
    );
    expect(result).toEqual(teams);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(false, {}, "Unauthorized"));

    await expect(fetchMyTeams()).rejects.toThrow("Failed to fetch my teams");
  });
});
