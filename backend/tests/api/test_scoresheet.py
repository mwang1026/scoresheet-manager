"""Tests for /api/scoresheet endpoints."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.scoresheet_scraper import ScrapedLeague, ScrapedTeam

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
