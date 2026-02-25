"""Tests for /api/scoresheet endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.models import League, Team, User, UserTeam
from app.services.scoresheet_scraper import ScrapedLeague, ScrapedTeam

# Realistic JS fixture that mirrors real Scoresheet.com output.
# Uses 'owner_names' (not 'owner') and includes other fields like 'team_names'
# to ensure the regex is selective. This fixture would have caught the original
# regex bug where the pattern matched 'owner' instead of 'owner_names'.
REALISTIC_JS_FIXTURE = """\
var leagueData = {
    team_names: ["Bleacher Bums", "Catfish Hunters", "Iron Mikes", "Bombers", "Rockets",
                 "Sluggers", "Aces", "Wildcats", "Tigers", "Eagles"],
    owner_names: ["Owner One", "Owner Two", "Owner Three", "Owner Four", "Owner Five",
                  "Owner Six", "Owner Seven", "Owner Eight", "Owner Nine", "Owner Ten"],
    rosters: [
        { pins: [1, 2, 3], traded: [] },
        { pins: [4, 5, 6], traded: [] }
    ],
    pins: [1, 2, 3, 4, 5]
};
"""

# Sample data used across tests
SAMPLE_LEAGUES = [
    ScrapedLeague(name="AL Catfish Hunter", data_path="FOR_WWW1/AL_Catfish_Hunter"),
    ScrapedLeague(name="NL Hank Aaron", data_path="FOR_WWW1/NL_Hank_Aaron"),
]

SAMPLE_TEAMS = [
    ScrapedTeam(scoresheet_id=i, owner_name=f"Owner {i}") for i in range(1, 11)
]


# ---------------------------------------------------------------------------
# GET /api/scoresheet/leagues
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_leagues_returns_cached_leagues(client):
    """GET /leagues returns the in-memory league cache."""
    with patch(
        "app.api.endpoints.scoresheet.get_cached_leagues",
        return_value=SAMPLE_LEAGUES,
    ):
        response = await client.get("/api/scoresheet/leagues")

    assert response.status_code == 200
    data = response.json()
    assert "leagues" in data
    assert len(data["leagues"]) == 2
    assert data["leagues"][0]["name"] == "AL Catfish Hunter"
    assert data["leagues"][0]["data_path"] == "FOR_WWW1/AL_Catfish_Hunter"


@pytest.mark.asyncio
async def test_list_leagues_empty_cache(client):
    """GET /leagues returns empty list when cache is empty."""
    with patch(
        "app.api.endpoints.scoresheet.get_cached_leagues",
        return_value=[],
    ):
        response = await client.get("/api/scoresheet/leagues")

    assert response.status_code == 200
    data = response.json()
    assert data["leagues"] == []


# ---------------------------------------------------------------------------
# POST /api/scoresheet/leagues/refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_leagues_returns_updated_list(client):
    """POST /leagues/refresh re-scrapes and returns the updated list."""
    with patch(
        "app.api.endpoints.scoresheet.refresh_league_cache",
        new_callable=AsyncMock,
        return_value=SAMPLE_LEAGUES,
    ):
        response = await client.post("/api/scoresheet/leagues/refresh")

    assert response.status_code == 200
    data = response.json()
    assert len(data["leagues"]) == 2


@pytest.mark.asyncio
async def test_refresh_leagues_502_on_http_error(client):
    """POST /leagues/refresh returns 502 when upstream returns an error."""
    mock_response = httpx.Response(503)
    error = httpx.HTTPStatusError("503", request=None, response=mock_response)

    with patch(
        "app.api.endpoints.scoresheet.refresh_league_cache",
        new_callable=AsyncMock,
        side_effect=error,
    ):
        response = await client.post("/api/scoresheet/leagues/refresh")

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_refresh_leagues_502_on_network_error(client):
    """POST /leagues/refresh returns 502 on network error."""
    with patch(
        "app.api.endpoints.scoresheet.refresh_league_cache",
        new_callable=AsyncMock,
        side_effect=httpx.RequestError("connection refused"),
    ):
        response = await client.post("/api/scoresheet/leagues/refresh")

    assert response.status_code == 502


# ---------------------------------------------------------------------------
# GET /api/scoresheet/leagues/{data_path}/teams
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_league_teams_returns_teams(client):
    """GET /leagues/{data_path}/teams returns scraped teams."""
    with patch(
        "app.api.endpoints.scoresheet.fetch_league_teams",
        new_callable=AsyncMock,
        return_value=SAMPLE_TEAMS,
    ):
        response = await client.get(
            "/api/scoresheet/leagues/FOR_WWW1/AL_Catfish_Hunter/teams"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["data_path"] == "FOR_WWW1/AL_Catfish_Hunter"
    assert len(data["teams"]) == 10
    assert data["teams"][0]["scoresheet_id"] == 1
    assert data["teams"][0]["owner_name"] == "Owner 1"


@pytest.mark.asyncio
async def test_list_league_teams_400_on_invalid_path(client):
    """GET /leagues/{data_path}/teams returns 400 for invalid data_path.

    Uses a path with dots (not allowed by regex) which reaches the endpoint
    handler and triggers ValueError from fetch_league_teams.
    """
    with patch(
        "app.api.endpoints.scoresheet.fetch_league_teams",
        new_callable=AsyncMock,
        side_effect=ValueError("Invalid data_path 'FOR_WWW1/league.with.dots'"),
    ):
        response = await client.get(
            "/api/scoresheet/leagues/FOR_WWW1/league.with.dots/teams"
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_league_teams_502_on_http_error(client):
    """GET /leagues/{data_path}/teams returns 502 when upstream fails."""
    mock_response = httpx.Response(404)
    error = httpx.HTTPStatusError("404", request=None, response=mock_response)

    with patch(
        "app.api.endpoints.scoresheet.fetch_league_teams",
        new_callable=AsyncMock,
        side_effect=error,
    ):
        response = await client.get(
            "/api/scoresheet/leagues/FOR_WWW1/AL_Catfish_Hunter/teams"
        )

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_list_league_teams_502_on_network_error(client):
    """GET /leagues/{data_path}/teams returns 502 on network error."""
    with patch(
        "app.api.endpoints.scoresheet.fetch_league_teams",
        new_callable=AsyncMock,
        side_effect=httpx.RequestError("timeout"),
    ):
        response = await client.get(
            "/api/scoresheet/leagues/FOR_WWW1/AL_Catfish_Hunter/teams"
        )

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_list_league_teams_response_schema(client):
    """GET /leagues/{data_path}/teams response has correct schema."""
    with patch(
        "app.api.endpoints.scoresheet.fetch_league_teams",
        new_callable=AsyncMock,
        return_value=SAMPLE_TEAMS,
    ):
        response = await client.get(
            "/api/scoresheet/leagues/FOR_WWW1/AL_Catfish_Hunter/teams"
        )

    data = response.json()
    assert "data_path" in data
    assert "teams" in data
    for team in data["teams"]:
        assert "scoresheet_id" in team
        assert "owner_name" in team


@pytest.mark.asyncio
async def test_list_league_teams_end_to_end_parsing(client):
    """GET /leagues/{data_path}/teams exercises real fetch_league_teams and parse_league_js.

    Mocks only the HTTP transport layer (httpx.AsyncClient), letting the real
    fetch_league_teams → parse_league_js pipeline execute. This test would have
    caught the original regex bug: if the regex matched 'owner' instead of
    'owner_names', parsing REALISTIC_JS_FIXTURE (which uses 'owner_names') would
    raise ValueError and the endpoint would return 400, not 200.
    """
    mock_request = httpx.Request("GET", "http://scoresheet.example.com/FOR_WWW1/AL_Test_League.js")
    mock_http_client = AsyncMock()
    mock_http_client.get.return_value = httpx.Response(200, text=REALISTIC_JS_FIXTURE, request=mock_request)

    mock_client_cm = MagicMock()
    mock_client_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_client_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("httpx.AsyncClient", return_value=mock_client_cm):
        response = await client.get(
            "/api/scoresheet/leagues/FOR_WWW1/AL_Test_League/teams"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["data_path"] == "FOR_WWW1/AL_Test_League"
    assert len(data["teams"]) == 10
    assert data["teams"][0]["owner_name"] == "Owner One"
    assert data["teams"][9]["owner_name"] == "Owner Ten"


# ---------------------------------------------------------------------------
# POST /api/scoresheet/leagues/{league_id}/rosters/refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_league_rosters_happy_path(client, db_session):
    """POST /leagues/{id}/rosters/refresh returns roster summary."""
    league = League(
        name="AL Test League",
        season=2026,
        scoresheet_data_path="FOR_WWW1/AL_Test",
        league_type="AL",
    )
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    mock_summary = {
        "teams_processed": 10,
        "players_added": 25,
        "players_removed": 0,
        "unresolved_pins": 2,
    }

    with patch(
        "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
        new_callable=AsyncMock,
        return_value=mock_summary,
    ):
        response = await client.post(
            f"/api/scoresheet/leagues/{league.id}/rosters/refresh"
        )

    assert response.status_code == 200
    data = response.json()
    assert data["league_id"] == league.id
    assert data["teams_processed"] == 10
    assert data["players_added"] == 25
    assert data["players_removed"] == 0
    assert data["unresolved_pins"] == 2


@pytest.mark.asyncio
async def test_refresh_league_rosters_404_unknown_league(client):
    """POST /leagues/9999/rosters/refresh returns 404 for unknown league."""
    response = await client.post("/api/scoresheet/leagues/9999/rosters/refresh")
    assert response.status_code == 404
    assert "9999" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_league_rosters_400_no_data_path(client, db_session):
    """POST returns 400 when league has no scoresheet_data_path."""
    league = League(name="No Path League", season=2026)
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    response = await client.post(
        f"/api/scoresheet/leagues/{league.id}/rosters/refresh"
    )
    assert response.status_code == 400
    assert "scoresheet_data_path" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_league_rosters_400_on_value_error(client, db_session):
    """POST returns 400 when scrape_and_persist_rosters raises ValueError."""
    league = League(
        name="AL Error League",
        season=2026,
        scoresheet_data_path="FOR_WWW1/AL_Test",
        league_type="AL",
    )
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    with patch(
        "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
        new_callable=AsyncMock,
        side_effect=ValueError("JS parsing failed"),
    ):
        response = await client.post(
            f"/api/scoresheet/leagues/{league.id}/rosters/refresh"
        )

    assert response.status_code == 400
    assert "JS parsing failed" in response.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_league_rosters_502_on_http_error(client, db_session):
    """POST returns 502 when upstream returns an HTTP error."""
    league = League(
        name="AL HTTP Error League",
        season=2026,
        scoresheet_data_path="FOR_WWW1/AL_Test",
        league_type="AL",
    )
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    mock_response = httpx.Response(503)
    error = httpx.HTTPStatusError("503", request=None, response=mock_response)

    with patch(
        "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
        new_callable=AsyncMock,
        side_effect=error,
    ):
        response = await client.post(
            f"/api/scoresheet/leagues/{league.id}/rosters/refresh"
        )

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_refresh_league_rosters_502_on_network_error(client, db_session):
    """POST returns 502 on network error."""
    league = League(
        name="AL Network Error League",
        season=2026,
        scoresheet_data_path="FOR_WWW1/AL_Test",
        league_type="AL",
    )
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    with patch(
        "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
        new_callable=AsyncMock,
        side_effect=httpx.RequestError("connection refused"),
    ):
        response = await client.post(
            f"/api/scoresheet/leagues/{league.id}/rosters/refresh"
        )

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_refresh_league_rosters_response_schema(client, db_session):
    """POST /leagues/{id}/rosters/refresh response has the correct schema."""
    league = League(
        name="AL Schema League",
        season=2026,
        scoresheet_data_path="FOR_WWW1/AL_Test",
        league_type="AL",
    )
    db_session.add(league)
    await db_session.commit()
    await db_session.refresh(league)

    with patch(
        "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
        new_callable=AsyncMock,
        return_value={
            "teams_processed": 5,
            "players_added": 10,
            "players_removed": 3,
            "unresolved_pins": 1,
        },
    ):
        response = await client.post(
            f"/api/scoresheet/leagues/{league.id}/rosters/refresh"
        )

    assert response.status_code == 200
    data = response.json()
    assert "league_id" in data
    assert "teams_processed" in data
    assert "players_added" in data
    assert "players_removed" in data
    assert "unresolved_pins" in data


# ---------------------------------------------------------------------------
# POST /api/scoresheet/onboard
# ---------------------------------------------------------------------------

ONBOARD_DATA_PATH = "FOR_WWW1/AL_Catfish_Hunter"
ONBOARD_LEAGUE_NAME = "AL Catfish Hunter"

MOCK_ROSTER_SUMMARY = {
    "teams_processed": 10,
    "players_added": 250,
    "players_removed": 0,
    "unresolved_pins": 5,
}


def _onboard_payload(scoresheet_team_id: int = 1, user_email: str = "user@example.com"):
    return {
        "data_path": ONBOARD_DATA_PATH,
        "scoresheet_team_id": scoresheet_team_id,
        "user_email": user_email,
    }


@pytest.mark.asyncio
async def test_onboard_happy_path(client, db_session):
    """POST /onboard creates league, teams, user, user_team, and rosters."""
    league_cache = [ScrapedLeague(name=ONBOARD_LEAGUE_NAME, data_path=ONBOARD_DATA_PATH)]

    with (
        patch(
            "app.api.endpoints.scoresheet.get_cached_leagues",
            return_value=league_cache,
        ),
        patch(
            "app.api.endpoints.scoresheet.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=SAMPLE_TEAMS,
        ),
        patch(
            "app.api.endpoints.scoresheet.persist_league_and_teams",
            new_callable=AsyncMock,
        ) as mock_persist,
        patch(
            "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            return_value=MOCK_ROSTER_SUMMARY,
        ),
    ):
        # persist_league_and_teams must return a League-like object with an id
        # We create a real league in db so the team lookup works
        league = League(
            name=ONBOARD_LEAGUE_NAME,
            season=2026,
            scoresheet_data_path=ONBOARD_DATA_PATH,
            league_type="AL",
        )
        db_session.add(league)
        await db_session.flush()

        team = Team(league_id=league.id, scoresheet_id=1, name="Team #1 (Owner 1)")
        db_session.add(team)
        await db_session.commit()
        await db_session.refresh(league)
        await db_session.refresh(team)

        mock_persist.return_value = league

        response = await client.post("/api/scoresheet/onboard", json=_onboard_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["league_id"] == league.id
    assert data["team_id"] == team.id
    assert data["team_name"] == "Team #1 (Owner 1)"
    assert data["roster"]["teams_processed"] == 10
    assert data["roster"]["players_added"] == 250
    assert data["roster"]["unresolved_pins"] == 5


@pytest.mark.asyncio
async def test_onboard_400_league_not_in_cache(client):
    """POST /onboard returns 400 when data_path is not in league cache."""
    with patch(
        "app.api.endpoints.scoresheet.get_cached_leagues",
        return_value=[],
    ):
        response = await client.post("/api/scoresheet/onboard", json=_onboard_payload())

    assert response.status_code == 400
    assert "not found in cache" in response.json()["detail"]


@pytest.mark.asyncio
async def test_onboard_502_on_fetch_teams_http_error(client):
    """POST /onboard returns 502 when fetching teams fails with HTTP error."""
    league_cache = [ScrapedLeague(name=ONBOARD_LEAGUE_NAME, data_path=ONBOARD_DATA_PATH)]
    mock_response = httpx.Response(503)
    error = httpx.HTTPStatusError("503", request=None, response=mock_response)

    with (
        patch(
            "app.api.endpoints.scoresheet.get_cached_leagues",
            return_value=league_cache,
        ),
        patch(
            "app.api.endpoints.scoresheet.fetch_league_teams",
            new_callable=AsyncMock,
            side_effect=error,
        ),
    ):
        response = await client.post("/api/scoresheet/onboard", json=_onboard_payload())

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_onboard_502_on_scrape_rosters_network_error(client, db_session):
    """POST /onboard returns 502 when roster scrape fails with network error."""
    league_cache = [ScrapedLeague(name=ONBOARD_LEAGUE_NAME, data_path=ONBOARD_DATA_PATH)]

    league = League(
        name=ONBOARD_LEAGUE_NAME,
        season=2026,
        scoresheet_data_path=ONBOARD_DATA_PATH,
        league_type="AL",
    )
    db_session.add(league)
    await db_session.flush()

    team = Team(league_id=league.id, scoresheet_id=1, name="Team #1 (Owner 1)")
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(league)

    with (
        patch(
            "app.api.endpoints.scoresheet.get_cached_leagues",
            return_value=league_cache,
        ),
        patch(
            "app.api.endpoints.scoresheet.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=SAMPLE_TEAMS,
        ),
        patch(
            "app.api.endpoints.scoresheet.persist_league_and_teams",
            new_callable=AsyncMock,
            return_value=league,
        ),
        patch(
            "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            side_effect=httpx.RequestError("connection refused"),
        ),
    ):
        response = await client.post("/api/scoresheet/onboard", json=_onboard_payload())

    assert response.status_code == 502


@pytest.mark.asyncio
async def test_onboard_idempotent(client, db_session):
    """POST /onboard is idempotent — calling twice doesn't create duplicates."""
    league_cache = [ScrapedLeague(name=ONBOARD_LEAGUE_NAME, data_path=ONBOARD_DATA_PATH)]

    league = League(
        name=ONBOARD_LEAGUE_NAME,
        season=2026,
        scoresheet_data_path=ONBOARD_DATA_PATH,
        league_type="AL",
    )
    db_session.add(league)
    await db_session.flush()

    team = Team(league_id=league.id, scoresheet_id=1, name="Team #1 (Owner 1)")
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(league)

    patches = (
        patch(
            "app.api.endpoints.scoresheet.get_cached_leagues",
            return_value=league_cache,
        ),
        patch(
            "app.api.endpoints.scoresheet.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=SAMPLE_TEAMS,
        ),
        patch(
            "app.api.endpoints.scoresheet.persist_league_and_teams",
            new_callable=AsyncMock,
            return_value=league,
        ),
        patch(
            "app.api.endpoints.scoresheet.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            return_value=MOCK_ROSTER_SUMMARY,
        ),
    )

    for p in patches:
        p.start()
    try:
        await client.post("/api/scoresheet/onboard", json=_onboard_payload())
        await client.post("/api/scoresheet/onboard", json=_onboard_payload())
    finally:
        for p in patches:
            p.stop()

    # Only one user and one user_team row should exist
    from sqlalchemy import func, select

    user_count = await db_session.scalar(
        select(func.count()).select_from(User).where(User.email == "user@example.com")
    )
    assert user_count == 1

    user_result = await db_session.execute(
        select(User).where(User.email == "user@example.com")
    )
    user = user_result.scalar_one_or_none()
    if user is not None:
        user_team_count = await db_session.scalar(
            select(func.count())
            .select_from(UserTeam)
            .where(UserTeam.user_id == user.id)
        )
        assert user_team_count == 1
