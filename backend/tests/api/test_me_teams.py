"""Tests for POST /api/me/teams and DELETE /api/me/teams/{team_id}."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.models import League, Team, User, UserTeam
from app.services.scoresheet_scraper import ScrapedLeague, ScrapedTeam

# ---------------------------------------------------------------------------
# Shared fixtures / constants
# ---------------------------------------------------------------------------

DATA_PATH = "FOR_WWW1/AL_Catfish_Hunter"
LEAGUE_NAME = "AL Catfish Hunter"

SAMPLE_SCRAPED_TEAMS = [
    ScrapedTeam(scoresheet_id=i, owner_name=f"Owner {i}") for i in range(1, 11)
]

MOCK_ROSTER_SUMMARY = {
    "teams_processed": 10,
    "players_added": 0,
    "players_removed": 0,
    "unresolved_pins": 0,
}


def _post_payload(data_path: str = DATA_PATH, scoresheet_team_id: int = 2) -> dict:
    return {"data_path": data_path, "scoresheet_team_id": scoresheet_team_id}


# ---------------------------------------------------------------------------
# POST /api/me/teams
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_team_fast_path(client, db_session, setup_team_context):
    """Fast path: league + team already in DB → creates UserTeam, triggers roster scrape → 201."""
    league = setup_team_context["league"]

    # Set scoresheet_data_path on the existing league (required for fast path lookup)
    league.scoresheet_data_path = DATA_PATH
    league.league_type = "AL"
    await db_session.commit()
    await db_session.refresh(league)

    # Add a second team in the same league (team1 is already in setup_team_context)
    team2 = Team(league_id=league.id, scoresheet_id=2, name="Team #2 (Owner 2)")
    db_session.add(team2)
    await db_session.commit()
    await db_session.refresh(team2)

    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH)],
        ),
        patch(
            "app.api.endpoints.teams.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            return_value=MOCK_ROSTER_SUMMARY,
        ) as mock_scrape,
    ):
        response = await client.post("/api/me/teams", json=_post_payload(scoresheet_team_id=2))

    assert response.status_code == 201
    data = response.json()
    assert data["scoresheet_id"] == 2
    # league_name comes from the DB league object (sample_league uses "Test League")
    assert data["league_name"] == league.name
    assert data["league_scoresheet_data_path"] == DATA_PATH

    # Verify UserTeam was created
    from sqlalchemy import select

    user = setup_team_context["user"]
    ut_result = await db_session.execute(
        select(UserTeam).where(UserTeam.user_id == user.id, UserTeam.team_id == team2.id)
    )
    assert ut_result.scalar_one_or_none() is not None

    # Roster scrape was triggered
    assert mock_scrape.called


@pytest.mark.asyncio
async def test_add_team_slow_path(client, db_session, setup_team_context):
    """Slow path: league/team not in DB → fetch + persist → creates UserTeam → 201."""
    # Create a second league with no teams and no data_path
    league2 = League(name="NL Hank Aaron", season=2026, league_type="NL")
    db_session.add(league2)
    await db_session.commit()
    await db_session.refresh(league2)

    # Pre-create the team that persist_league_and_teams would create
    # (since we mock persist_league_and_teams, we need the team to exist)
    new_data_path = "FOR_WWW1/NL_Hank_Aaron"
    league2.scoresheet_data_path = new_data_path
    team_new = Team(league_id=league2.id, scoresheet_id=1, name="Team #1 (Owner 1)")
    db_session.add(team_new)
    await db_session.commit()
    await db_session.refresh(league2)
    await db_session.refresh(team_new)

    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[
                ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH),
                ScrapedLeague(name="NL Hank Aaron", data_path=new_data_path),
            ],
        ),
        patch(
            "app.api.endpoints.teams.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=SAMPLE_SCRAPED_TEAMS,
        ),
        patch(
            "app.api.endpoints.teams.persist_league_and_teams",
            new_callable=AsyncMock,
            return_value=league2,
        ),
        patch(
            "app.api.endpoints.teams.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            return_value=MOCK_ROSTER_SUMMARY,
        ),
    ):
        response = await client.post(
            "/api/me/teams",
            json=_post_payload(data_path=new_data_path, scoresheet_team_id=1),
        )

    assert response.status_code == 201
    data = response.json()
    assert data["scoresheet_id"] == 1


@pytest.mark.asyncio
async def test_add_team_409_already_associated(client, db_session, setup_team_context):
    """Returns 409 if user is already associated with the team."""
    league = setup_team_context["league"]
    team = setup_team_context["team"]  # scoresheet_id=1

    league.scoresheet_data_path = DATA_PATH
    league.league_type = "AL"
    await db_session.commit()

    with patch(
        "app.api.endpoints.teams.get_cached_leagues",
        return_value=[ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH)],
    ):
        # team1 (scoresheet_id=1) is already in setup_team_context
        response = await client.post(
            "/api/me/teams", json=_post_payload(scoresheet_team_id=team.scoresheet_id)
        )

    assert response.status_code == 409
    assert "already associated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_add_team_400_invalid_data_path(client, db_session, setup_team_context):
    """Returns 400 if data_path is not in the league cache."""
    with patch(
        "app.api.endpoints.teams.get_cached_leagues",
        return_value=[],  # empty cache → data_path not found
    ):
        response = await client.post(
            "/api/me/teams", json=_post_payload(data_path="FOR_WWW1/Unknown_League")
        )

    assert response.status_code == 400
    assert "not found in cache" in response.json()["detail"]


@pytest.mark.asyncio
async def test_add_team_400_invalid_scoresheet_team_id(client, db_session, setup_team_context):
    """Returns 400 if scoresheet_team_id does not exist in the league."""
    league = setup_team_context["league"]
    league.scoresheet_data_path = DATA_PATH
    league.league_type = "AL"
    await db_session.commit()
    await db_session.refresh(league)

    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH)],
        ),
        patch(
            "app.api.endpoints.teams.fetch_league_teams",
            new_callable=AsyncMock,
            return_value=SAMPLE_SCRAPED_TEAMS,
        ),
        patch(
            "app.api.endpoints.teams.persist_league_and_teams",
            new_callable=AsyncMock,
            return_value=league,
        ),
    ):
        # scoresheet_id=99 does not exist in the league (only 1-10 in SAMPLE_SCRAPED_TEAMS)
        response = await client.post(
            "/api/me/teams", json=_post_payload(scoresheet_team_id=99)
        )

    assert response.status_code == 400
    assert "not found in league" in response.json()["detail"]


@pytest.mark.asyncio
async def test_add_team_502_on_http_error_slow_path(client, db_session, setup_team_context):
    """Slow path: fetch_league_teams raises HTTPStatusError → 502."""
    mock_response = httpx.Response(503)
    error = httpx.HTTPStatusError("503", request=None, response=mock_response)

    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH)],
        ),
        patch(
            "app.api.endpoints.teams.fetch_league_teams",
            new_callable=AsyncMock,
            side_effect=error,
        ),
    ):
        response = await client.post("/api/me/teams", json=_post_payload())

    assert response.status_code == 502
    assert "502" in response.json()["detail"] or "Upstream" in response.json()["detail"]


@pytest.mark.asyncio
async def test_add_team_502_on_network_error_slow_path(client, db_session, setup_team_context):
    """Slow path: fetch_league_teams raises RequestError → 502."""
    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH)],
        ),
        patch(
            "app.api.endpoints.teams.fetch_league_teams",
            new_callable=AsyncMock,
            side_effect=httpx.RequestError("connection refused"),
        ),
    ):
        response = await client.post("/api/me/teams", json=_post_payload())

    assert response.status_code == 502
    assert "Network" in response.json()["detail"]


@pytest.mark.asyncio
async def test_add_team_roster_scrape_failure_is_nonfatal(client, db_session, setup_team_context):
    """Roster scrape failure is non-fatal: endpoint still returns 201."""
    league = setup_team_context["league"]
    league.scoresheet_data_path = DATA_PATH
    league.league_type = "AL"
    await db_session.commit()
    await db_session.refresh(league)

    team2 = Team(league_id=league.id, scoresheet_id=2, name="Team #2 (Owner 2)")
    db_session.add(team2)
    await db_session.commit()
    await db_session.refresh(team2)

    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[ScrapedLeague(name=LEAGUE_NAME, data_path=DATA_PATH)],
        ),
        patch(
            "app.api.endpoints.teams.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            side_effect=Exception("roster scrape blew up"),
        ),
    ):
        response = await client.post("/api/me/teams", json=_post_payload(scoresheet_team_id=2))

    assert response.status_code == 201
    assert response.json()["scoresheet_id"] == 2


# ---------------------------------------------------------------------------
# DELETE /api/me/teams/{team_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remove_team_success(client, db_session, setup_team_context):
    """Success → 204, only UserTeam row deleted (league/team data remains)."""
    from sqlalchemy import select

    league = setup_team_context["league"]
    team1 = setup_team_context["team"]
    user = setup_team_context["user"]

    # Add a second team so user has 2 teams
    team2 = Team(league_id=league.id, scoresheet_id=2, name="Team #2")
    db_session.add(team2)
    await db_session.commit()
    await db_session.refresh(team2)

    ut2 = UserTeam(user_id=user.id, team_id=team2.id, role="owner")
    db_session.add(ut2)
    await db_session.commit()
    await db_session.refresh(ut2)

    response = await client.delete(f"/api/me/teams/{team2.id}")
    assert response.status_code == 204

    # Only UserTeam deleted — league, team, and team1 remain
    ut_result = await db_session.execute(
        select(UserTeam).where(UserTeam.user_id == user.id, UserTeam.team_id == team2.id)
    )
    assert ut_result.scalar_one_or_none() is None

    # team2 row itself still exists
    team_result = await db_session.execute(select(Team).where(Team.id == team2.id))
    assert team_result.scalar_one_or_none() is not None

    # team1 association still exists
    ut1_result = await db_session.execute(
        select(UserTeam).where(UserTeam.user_id == user.id, UserTeam.team_id == team1.id)
    )
    assert ut1_result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_remove_team_404_not_found(client, db_session, setup_team_context):
    """Returns 404 if the user-team association does not exist."""
    response = await client.delete("/api/me/teams/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_remove_team_400_last_team(client, db_session, setup_team_context):
    """Returns 400 when trying to remove the user's only team."""
    team = setup_team_context["team"]

    response = await client.delete(f"/api/me/teams/{team.id}")
    assert response.status_code == 400
    assert "Cannot remove last team" in response.json()["detail"]


@pytest.mark.asyncio
async def test_remove_team_works_with_multiple_teams(client, db_session, setup_team_context):
    """Successfully removes one team when user has 2+ teams."""
    from sqlalchemy import select

    league = setup_team_context["league"]
    user = setup_team_context["user"]

    team2 = Team(league_id=league.id, scoresheet_id=2, name="Team #2")
    team3 = Team(league_id=league.id, scoresheet_id=3, name="Team #3")
    db_session.add_all([team2, team3])
    await db_session.commit()
    await db_session.refresh(team2)
    await db_session.refresh(team3)

    ut2 = UserTeam(user_id=user.id, team_id=team2.id, role="owner")
    ut3 = UserTeam(user_id=user.id, team_id=team3.id, role="owner")
    db_session.add_all([ut2, ut3])
    await db_session.commit()

    # User now has 3 teams — can remove team2
    response = await client.delete(f"/api/me/teams/{team2.id}")
    assert response.status_code == 204

    # team3 association still intact
    ut3_result = await db_session.execute(
        select(UserTeam).where(UserTeam.user_id == user.id, UserTeam.team_id == team3.id)
    )
    assert ut3_result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Multi-league isolation integration tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_teams_multi_owner_returns_correct_user_teams(
    client, db_session, setup_team_context
):
    """
    Regression: when team 1 has two owners, GET /api/me/teams must return
    each user's own teams, not the teams of whichever owner .first() picks.

    Before the fix: get_my_teams looked up the user via X-Team-Id → UserTeam.first(),
    which always returned user 1 regardless of who was authenticated.
    """
    from sqlalchemy import select

    # setup_team_context: user1 (test@example.com) + team1 (UserTeam)
    team1 = setup_team_context["team"]
    league = setup_team_context["league"]

    # Create user2 and associate them with BOTH team1 AND a new team_b
    user2 = User(email="user2@example.com")
    db_session.add(user2)
    await db_session.commit()
    await db_session.refresh(user2)

    league_b = League(name="NL Second League", season=2026, league_type="NL")
    db_session.add(league_b)
    await db_session.commit()
    await db_session.refresh(league_b)

    team_b = Team(league_id=league_b.id, scoresheet_id=7, name="Team #7 (user2 only)")
    db_session.add(team_b)
    await db_session.commit()
    await db_session.refresh(team_b)

    # user2 owns both team1 and team_b
    ut_user2_team1 = UserTeam(user_id=user2.id, team_id=team1.id, role="owner")
    ut_user2_teamb = UserTeam(user_id=user2.id, team_id=team_b.id, role="owner")
    db_session.add_all([ut_user2_team1, ut_user2_teamb])
    await db_session.commit()

    # user2 authenticated → should see 2 teams
    resp_user2 = await client.get(
        "/api/me/teams", headers={"X-User-Email": "user2@example.com"}
    )
    assert resp_user2.status_code == 200
    user2_teams = resp_user2.json()["teams"]
    user2_team_ids = {t["id"] for t in user2_teams}
    assert len(user2_teams) == 2, f"user2 should see 2 teams, got {len(user2_teams)}"
    assert team1.id in user2_team_ids
    assert team_b.id in user2_team_ids

    # Verify league_scoresheet_data_path is present in response
    for t in user2_teams:
        assert "league_scoresheet_data_path" in t

    # user1 authenticated (dev bypass via DEFAULT_TEAM_ID=1) → should see 1 team
    resp_user1 = await client.get(
        "/api/me/teams", headers={"X-User-Email": "test@example.com"}
    )
    assert resp_user1.status_code == 200
    user1_teams = resp_user1.json()["teams"]
    assert len(user1_teams) == 1, f"user1 should see 1 team, got {len(user1_teams)}"
    assert user1_teams[0]["id"] == team1.id


@pytest.mark.asyncio
async def test_add_second_team_preserves_first_team(client, db_session, setup_team_context):
    """
    Adding a team in a second league leaves the first team intact.
    GET /api/players scoped to each team shows their respective roster.
    """
    from app.models import Player, PlayerRoster

    league_a = setup_team_context["league"]
    team_a = setup_team_context["team"]

    # Second league + team (fast path: pre-create in DB)
    league_b = League(
        name="NL Second League", season=2026, league_type="NL",
        scoresheet_data_path="FOR_WWW1/NL_Second_League",
    )
    db_session.add(league_b)
    await db_session.commit()
    await db_session.refresh(league_b)

    team_b = Team(league_id=league_b.id, scoresheet_id=5, name="Team #5 (Bleacher Bums)")
    db_session.add(team_b)
    await db_session.commit()
    await db_session.refresh(team_b)

    # POST /api/me/teams to add team_b for the user
    with (
        patch(
            "app.api.endpoints.teams.get_cached_leagues",
            return_value=[ScrapedLeague(name="NL Second League", data_path="FOR_WWW1/NL_Second_League")],
        ),
        patch(
            "app.api.endpoints.teams.scrape_and_persist_rosters",
            new_callable=AsyncMock,
            return_value=MOCK_ROSTER_SUMMARY,
        ),
    ):
        response = await client.post(
            "/api/me/teams",
            json={"data_path": "FOR_WWW1/NL_Second_League", "scoresheet_team_id": 5},
        )
    assert response.status_code == 201

    # GET /api/me/teams → both teams present
    me_resp = await client.get("/api/me/teams")
    assert me_resp.status_code == 200
    my_teams = me_resp.json()["teams"]
    assert len(my_teams) == 2
    team_ids = {t["id"] for t in my_teams}
    assert team_a.id in team_ids
    assert team_b.id in team_ids

    # Roster an AL player to team_a and an NL player to team_b
    al_player = Player(first_name="AL", last_name="Guy", scoresheet_id=200,
                       primary_position="OF", is_trade_bait=False)
    nl_player = Player(first_name="NL", last_name="Guy", scoresheet_id=1200,
                       primary_position="OF", is_trade_bait=False)
    db_session.add_all([al_player, nl_player])
    await db_session.commit()
    await db_session.refresh(al_player)
    await db_session.refresh(nl_player)

    roster_a = PlayerRoster(player_id=al_player.id, team_id=team_a.id, league_id=team_a.league_id, status="rostered")
    roster_b = PlayerRoster(player_id=nl_player.id, team_id=team_b.id, league_id=team_b.league_id, status="rostered")
    db_session.add_all([roster_a, roster_b])
    await db_session.commit()

    # GET /api/players with team_a → al_player rostered to team_a
    resp_a = await client.get("/api/players", headers={"X-Team-Id": str(team_a.id)})
    assert resp_a.status_code == 200
    players_a = {p["scoresheet_id"]: p for p in resp_a.json()["players"]}
    assert players_a[200]["team_id"] == team_a.id

    # GET /api/players with team_b → nl_player rostered to team_b
    resp_b = await client.get("/api/players", headers={"X-Team-Id": str(team_b.id)})
    assert resp_b.status_code == 200
    players_b = {p["scoresheet_id"]: p for p in resp_b.json()["players"]}
    assert players_b[1200]["team_id"] == team_b.id


@pytest.mark.asyncio
async def test_remove_team_preserves_other_team(client, db_session, setup_team_context):
    """
    Removing a team from one league leaves the other league's team and roster intact.
    GET /api/teams with the remaining team returns only its league's teams.
    """
    league_a = setup_team_context["league"]
    team_a = setup_team_context["team"]
    user = setup_team_context["user"]

    # Second league + team, associated with user
    league_b = League(name="NL League B", season=2026, league_type="NL")
    db_session.add(league_b)
    await db_session.commit()
    await db_session.refresh(league_b)

    team_b = Team(league_id=league_b.id, scoresheet_id=3, name="NL Team B")
    db_session.add(team_b)
    await db_session.commit()
    await db_session.refresh(team_b)

    ut_b = UserTeam(user_id=user.id, team_id=team_b.id, role="owner")
    db_session.add(ut_b)
    await db_session.commit()

    # DELETE team_b
    response = await client.delete(f"/api/me/teams/{team_b.id}")
    assert response.status_code == 204

    # GET /api/me/teams → only team_a remains
    me_resp = await client.get("/api/me/teams")
    assert me_resp.status_code == 200
    remaining = me_resp.json()["teams"]
    assert len(remaining) == 1
    assert remaining[0]["id"] == team_a.id

    # GET /api/teams with team_a → only league_a's teams
    teams_resp = await client.get("/api/teams", headers={"X-Team-Id": str(team_a.id)})
    assert teams_resp.status_code == 200
    all_teams = teams_resp.json()["teams"]
    assert all(t["league_id"] == league_a.id for t in all_teams)
