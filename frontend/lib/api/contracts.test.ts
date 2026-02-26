/**
 * Contract tests: verify frontend field maps match contracts/api-schemas.json.
 *
 * If these tests fail, it means the backend schema has changed and the
 * frontend Backend* interface + field map need updating.
 */

import { describe, it, expect } from "vitest";
import contracts from "../../../contracts/api-schemas.json";
import {
  BACKEND_PLAYER_FIELDS,
  BACKEND_TEAM_FIELDS,
  BACKEND_HITTER_STATS_FIELDS,
  BACKEND_PITCHER_STATS_FIELDS,
  BACKEND_HITTER_PROJECTION_FIELDS,
  BACKEND_PITCHER_PROJECTION_FIELDS,
  BACKEND_HITTER_PROJECTION_ADVANCED_FIELDS,
  BACKEND_PITCHER_PROJECTION_ADVANCED_FIELDS,
} from "./contract-fields";

/**
 * Helper: assert a frontend field map exactly matches a contract schema entry.
 */
function assertFieldMapMatchesContract(
  label: string,
  contractFields: Record<string, string>,
  frontendFields: Record<string, string>,
) {
  const contractKeys = Object.keys(contractFields);
  const frontendKeys = Object.keys(frontendFields);

  const missingInFrontend = contractKeys.filter((k) => !(k in frontendFields));
  const extraInFrontend = frontendKeys.filter((k) => !(k in contractFields));

  expect(missingInFrontend, `${label}: backend fields missing in frontend`).toEqual([]);
  expect(extraInFrontend, `${label}: extra frontend fields not in backend`).toEqual([]);

  // Type string matching
  for (const key of contractKeys) {
    if (key in frontendFields) {
      expect(frontendFields[key], `${label}.${key} type mismatch`).toBe(contractFields[key]);
    }
  }
}

describe("Contract tests: frontend field maps ↔ api-schemas.json", () => {
  it("BackendPlayer matches PlayerListItem contract", () => {
    assertFieldMapMatchesContract(
      "PlayerListItem",
      contracts.PlayerListItem,
      BACKEND_PLAYER_FIELDS,
    );
  });

  it("BackendTeam matches TeamListItem contract", () => {
    assertFieldMapMatchesContract(
      "TeamListItem",
      contracts.TeamListItem,
      BACKEND_TEAM_FIELDS,
    );
  });

  it("BackendHitterStats matches HitterDailyStatsItem contract", () => {
    assertFieldMapMatchesContract(
      "HitterDailyStatsItem",
      contracts.HitterDailyStatsItem,
      BACKEND_HITTER_STATS_FIELDS,
    );
  });

  it("BackendPitcherStats matches PitcherDailyStatsItem contract", () => {
    assertFieldMapMatchesContract(
      "PitcherDailyStatsItem",
      contracts.PitcherDailyStatsItem,
      BACKEND_PITCHER_STATS_FIELDS,
    );
  });

  it("BackendHitterProjection matches HitterProjectionItem contract", () => {
    assertFieldMapMatchesContract(
      "HitterProjectionItem",
      contracts.HitterProjectionItem,
      BACKEND_HITTER_PROJECTION_FIELDS,
    );
  });

  it("BackendPitcherProjection matches PitcherProjectionItem contract", () => {
    assertFieldMapMatchesContract(
      "PitcherProjectionItem",
      contracts.PitcherProjectionItem,
      BACKEND_PITCHER_PROJECTION_FIELDS,
    );
  });

  it("HitterProjectionAdvanced matches contract", () => {
    assertFieldMapMatchesContract(
      "HitterProjectionAdvanced",
      contracts.HitterProjectionAdvanced,
      BACKEND_HITTER_PROJECTION_ADVANCED_FIELDS,
    );
  });

  it("PitcherProjectionAdvanced matches contract", () => {
    assertFieldMapMatchesContract(
      "PitcherProjectionAdvanced",
      contracts.PitcherProjectionAdvanced,
      BACKEND_PITCHER_PROJECTION_ADVANCED_FIELDS,
    );
  });
});
