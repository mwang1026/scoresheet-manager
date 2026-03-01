import { describe, it, expect } from "vitest";
import { formatFantasyTeamAbbr, PIN_WIDTHS } from "./table-helpers";
import type { Team } from "./types";

describe("formatFantasyTeamAbbr", () => {
  it("returns 'Team ##' using scoresheet_id", () => {
    const team: Team = {
      id: 1,
      name: "Power Hitters",
      scoresheet_id: 7,
      league_id: 1,
      league_name: "Test League",
      is_my_team: false,
    };
    expect(formatFantasyTeamAbbr(team)).toBe("Team 7");
  });

  it("returns em dash for undefined team", () => {
    expect(formatFantasyTeamAbbr(undefined)).toBe("—");
  });

  it("handles scoresheet_id of 1", () => {
    const team: Team = {
      id: 5,
      name: "First Team",
      scoresheet_id: 1,
      league_id: 1,
      league_name: "Test League",
      is_my_team: true,
    };
    expect(formatFantasyTeamAbbr(team)).toBe("Team 1");
  });
});

describe("PIN_WIDTHS", () => {
  it("has expected width values", () => {
    expect(PIN_WIDTHS.star).toBe(40);
    expect(PIN_WIDTHS.queue).toBe(40);
    expect(PIN_WIDTHS.name).toBe(160);
    expect(PIN_WIDTHS.hand).toBe(48);
    expect(PIN_WIDTHS.pos).toBe(56);
  });
});
