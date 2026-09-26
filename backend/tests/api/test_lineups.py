"""Tests for GET /api/lineups and POST /api/scoresheet/leagues/{id}/lineups/refresh."""

from datetime import date
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.models import GameLineup, League, Player, Team
from app.services.scoresheet_scraper.lineup_parser import STARTING_PITCHER_SLOT

NINE = [(6, 101), (9, 102), (5, 103), (2, 104), (1, 105), (3, 106), (4, 107), (7, 108), (8, 109)]


async def _seed(db_session):
    league = League(name="AL Lineups API", season=2026, league_type="AL",
                    scoresheet_data_path="FOR_WWW1/AL_Lineups_API")
    db_session.add(league)
    await db_session.flush()
    t1 = Team(league_id=league.id, name="Team #1", scoresheet_id=1)
    t2 = Team(league_id=league.id, name="Team #2", scoresheet_id=2)
    db_session.add_all([t1, t2])
    await db_session.flush()
    return league, t1, t2


def _team_rows(league_id, week_end, game_no, team, opp, is_home, hitters, sp_pin, sp_player_id):
    rows = []
    for slot, (pos, pin) in enumerate(hitters):
        rows.append(GameLineup(
            league_id=league_id, week_end=week_end, game_no=game_no, team_id=team.id,
            opponent_team_id=opp.id, is_home=is_home, seq=slot, slot=slot,
            position_code=pos, pin=pin, player_id=None, is_starter=True,
        ))
    rows.append(GameLineup(
        league_id=league_id, week_end=week_end, game_no=game_no, team_id=team.id,
        opponent_team_id=opp.id, is_home=is_home, seq=9, slot=STARTING_PITCHER_SLOT,
        position_code=0, pin=sp_pin, player_id=sp_player_id, is_starter=True,
    ))
    return rows


@pytest.mark.asyncio
async def test_get_lineups_empty_when_nothing_scraped(client, db_session):
    _, t1, _ = await _seed(db_session)
    await db_session.commit()
    response = await client.get("/api/lineups", headers={"X-Team-Id": str(t1.id)})
    assert response.status_code == 200
    body = response.json()
    assert body["week_end"] is None
    assert body["teams"] == []


@pytest.mark.asyncio
async def test_get_lineups_uses_latest_week_and_hands(client, db_session):
    league, t1, t2 = await _seed(db_session)
    lefty = Player(first_name="L", last_name="Pitcher", primary_position="P", bats="L", scoresheet_id=901)
    righty = Player(first_name="R", last_name="Pitcher", primary_position="P", bats="R", scoresheet_id=902)
    db_session.add_all([lefty, righty])
    await db_session.flush()

    old_week, new_week = date(2026, 9, 13), date(2026, 9, 20)
    alt = [NINE[1], NINE[0]] + NINE[2:]
    rows = []
    # Old week: should be ignored entirely.
    rows += _team_rows(league.id, old_week, 0, t1, t2, False, alt, 301, None)
    rows += _team_rows(league.id, old_week, 0, t2, t1, True, NINE, 902, righty.id)
    # New week: game 0 vs lefty (alt lineup), game 1 vs righty (NINE).
    rows += _team_rows(league.id, new_week, 0, t1, t2, False, alt, 301, None)
    rows += _team_rows(league.id, new_week, 0, t2, t1, True, NINE, 901, lefty.id)
    rows += _team_rows(league.id, new_week, 1, t1, t2, True, NINE, 302, None)
    rows += _team_rows(league.id, new_week, 1, t2, t1, False, NINE, 902, righty.id)
    db_session.add_all(rows)
    await db_session.commit()

    response = await client.get("/api/lineups", headers={"X-Team-Id": str(t1.id)})
    assert response.status_code == 200
    body = response.json()
    assert body["league_id"] == league.id
    assert body["week_end"] == "2026-09-20"
    assert [t["team_id"] for t in body["teams"]] == [t1.id, t2.id]

    team1 = body["teams"][0]
    assert team1["games"] == 2
    assert team1["unknown_hand_games"] == 0
    assert [s["pin"] for s in team1["vs_rhp"]] == [pin for _, pin in NINE]
    assert [s["pin"] for s in team1["vs_lhp"]] == [pin for _, pin in alt]
    assert team1["vs_rhp"][0] == {"slot": 0, "position": "LF", "pin": 101, "player_id": None}
    assert [(p["pin"], p["games"]) for p in team1["rotation"]] == [(301, 1), (302, 1)]
    assert team1["relievers"] == []

    # Team 2 faced pitchers with no player record -> unknown hand, bucketed as RHP.
    team2 = body["teams"][1]
    assert team2["unknown_hand_games"] == 2
    assert team2["vs_lhp"] is None


@pytest.mark.asyncio
async def test_get_lineups_without_league_context_is_401(client, db_session, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "DEFAULT_TEAM_ID", 0)
    response = await client.get("/api/lineups")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/scoresheet/leagues/{league_id}/lineups/refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_lineups_success(client, db_session):
    league, _, _ = await _seed(db_session)
    await db_session.commit()
    summary = {"week_end": "2026-09-20", "games": 30, "rows_written": 640,
               "unresolved_pins": 3, "unassigned_subs": 12}
    with patch("app.api.endpoints.scoresheet.scrape_and_persist_lineups",
               new=AsyncMock(return_value=summary)) as mock_scrape:
        response = await client.post(f"/api/scoresheet/leagues/{league.id}/lineups/refresh")
    assert response.status_code == 200
    assert response.json() == {"league_id": league.id, **summary}
    mock_scrape.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_lineups_404_unknown_league(client):
    response = await client.post("/api/scoresheet/leagues/9999/lineups/refresh")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_refresh_lineups_400_without_data_path(client, db_session):
    league = League(name="No Path", season=2026, league_type="AL")
    db_session.add(league)
    await db_session.commit()
    response = await client.post(f"/api/scoresheet/leagues/{league.id}/lineups/refresh")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_refresh_lineups_400_on_value_error(client, db_session):
    league, _, _ = await _seed(db_session)
    await db_session.commit()
    with patch("app.api.endpoints.scoresheet.scrape_and_persist_lineups",
               new=AsyncMock(side_effect=ValueError("Score-It file has no thru_date_"))):
        response = await client.post(f"/api/scoresheet/leagues/{league.id}/lineups/refresh")
    assert response.status_code == 400
    assert "thru_date_" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_lineups_502_on_upstream_error(client, db_session):
    league, _, _ = await _seed(db_session)
    await db_session.commit()
    request = httpx.Request("GET", "https://www.scoresheet.com/x")
    err = httpx.HTTPStatusError("503", request=request, response=httpx.Response(503, request=request))
    with patch("app.api.endpoints.scoresheet.scrape_and_persist_lineups", new=AsyncMock(side_effect=err)):
        response = await client.post(f"/api/scoresheet/leagues/{league.id}/lineups/refresh")
    assert response.status_code == 502

    with patch("app.api.endpoints.scoresheet.scrape_and_persist_lineups",
               new=AsyncMock(side_effect=httpx.ConnectError("boom", request=request))):
        response = await client.post(f"/api/scoresheet/leagues/{league.id}/lineups/refresh")
    assert response.status_code == 502
