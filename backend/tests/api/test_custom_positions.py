"""Tests for custom positions (OOP) endpoints."""

import pytest

from app.models import Player, PlayerPosition, PlayerRoster, RosterStatus, Team, User, UserTeam
from app.models.custom_position import CustomPosition


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_player(db_session, scoresheet_id=9999, mlb_id=999999, position="SS", **overrides):
    data = {
        "first_name": "Test",
        "last_name": "Player",
        "scoresheet_id": scoresheet_id,
        "mlb_id": mlb_id,
        "primary_position": position,
        "bats": "R",
        "throws": "R",
        "age": 25,
        "current_mlb_team": "TST",
        "is_trade_bait": False,
        **overrides,
    }
    player = Player(**data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)
    return player


# ---------------------------------------------------------------------------
# GET /api/custom-positions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_empty(client, db_session, setup_team_context):
    """GET returns empty dict when team has no custom positions."""
    response = await client.get("/api/custom-positions")
    assert response.status_code == 200
    assert response.json() == {"positions": {}}


@pytest.mark.asyncio
async def test_get_with_positions(client, db_session, setup_team_context):
    """GET returns all custom positions for the team."""
    team = setup_team_context["team"]
    p1 = await _create_player(db_session, scoresheet_id=100, mlb_id=100000)
    p2 = await _create_player(db_session, scoresheet_id=101, mlb_id=100001, position="2B")

    db_session.add_all([
        CustomPosition(team_id=team.id, player_id=p1.id, position="3B"),
        CustomPosition(team_id=team.id, player_id=p1.id, position="OF"),
        CustomPosition(team_id=team.id, player_id=p2.id, position="SS"),
    ])
    await db_session.commit()

    response = await client.get("/api/custom-positions")
    assert response.status_code == 200
    data = response.json()["positions"]
    assert sorted(data[str(p1.id)]) == ["3B", "OF"]
    assert data[str(p2.id)] == ["SS"]


# ---------------------------------------------------------------------------
# POST /api/custom-positions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_position(client, db_session, setup_team_context):
    """POST adds a custom position and returns updated map."""
    player = await _create_player(db_session)

    response = await client.post(
        "/api/custom-positions",
        json={"player_id": player.id, "position": "3B"},
    )
    assert response.status_code == 200
    data = response.json()["positions"]
    assert data[str(player.id)] == ["3B"]


@pytest.mark.asyncio
async def test_add_idempotent(client, db_session, setup_team_context):
    """POST same position twice is idempotent — no error, no duplicate."""
    player = await _create_player(db_session)

    await client.post("/api/custom-positions", json={"player_id": player.id, "position": "3B"})
    response = await client.post("/api/custom-positions", json={"player_id": player.id, "position": "3B"})
    assert response.status_code == 200
    data = response.json()["positions"]
    assert data[str(player.id)] == ["3B"]


@pytest.mark.asyncio
async def test_add_invalid_position(client, db_session, setup_team_context):
    """POST with invalid position returns 422."""
    player = await _create_player(db_session)

    response = await client.post(
        "/api/custom-positions",
        json={"player_id": player.id, "position": "DH"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_add_natural_eligibility_rejected(client, db_session, setup_team_context):
    """POST rejected when player already has natural eligibility."""
    # Player is a natural SS
    player = await _create_player(db_session, position="SS")

    response = await client.post(
        "/api/custom-positions",
        json={"player_id": player.id, "position": "SS"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_add_secondary_eligibility_rejected(client, db_session, setup_team_context):
    """POST rejected when player has secondary eligibility at the position."""
    player = await _create_player(db_session, position="SS")
    # Add a PlayerPosition record for 2B eligibility
    db_session.add(PlayerPosition(player_id=player.id, position="2B", rating=4.10))
    await db_session.commit()

    response = await client.post(
        "/api/custom-positions",
        json={"player_id": player.id, "position": "2B"},
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_add_nonexistent_player(client, db_session, setup_team_context):
    """POST for nonexistent player returns 404."""
    response = await client.post(
        "/api/custom-positions",
        json={"player_id": 99999, "position": "3B"},
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/custom-positions/{player_id}/{position}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remove_position(client, db_session, setup_team_context):
    """DELETE removes the custom position."""
    team = setup_team_context["team"]
    player = await _create_player(db_session)

    db_session.add(CustomPosition(team_id=team.id, player_id=player.id, position="3B"))
    await db_session.commit()

    response = await client.delete(f"/api/custom-positions/{player.id}/3B")
    assert response.status_code == 200
    assert response.json()["positions"] == {}


@pytest.mark.asyncio
async def test_remove_nonexistent_is_noop(client, db_session, setup_team_context):
    """DELETE for nonexistent position is a no-op (returns current state)."""
    player = await _create_player(db_session)

    response = await client.delete(f"/api/custom-positions/{player.id}/3B")
    assert response.status_code == 200
    assert response.json()["positions"] == {}


# ---------------------------------------------------------------------------
# Team isolation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_team_isolation(client, db_session, sample_league):
    """Team A cannot see Team B's custom positions."""
    team_a = Team(league_id=sample_league.id, name="Team A", scoresheet_id=10)
    team_b = Team(league_id=sample_league.id, name="Team B", scoresheet_id=11)
    db_session.add_all([team_a, team_b])
    await db_session.commit()
    await db_session.refresh(team_a)
    await db_session.refresh(team_b)

    user = User(email="test@example.com", role="user")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    db_session.add(UserTeam(user_id=user.id, team_id=team_a.id, role="owner"))
    db_session.add(UserTeam(user_id=user.id, team_id=team_b.id, role="owner"))
    await db_session.commit()

    player = await _create_player(db_session)

    # Add position as team B
    db_session.add(CustomPosition(team_id=team_b.id, player_id=player.id, position="3B"))
    await db_session.commit()

    # Request as team A — should not see team B's positions
    response = await client.get(
        "/api/custom-positions",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_a.id)},
    )
    assert response.status_code == 200
    assert response.json()["positions"] == {}

    # Request as team B — should see the position
    response_b = await client.get(
        "/api/custom-positions",
        headers={"X-User-Email": user.email, "X-Team-Id": str(team_b.id)},
    )
    assert response_b.status_code == 200
    assert str(player.id) in response_b.json()["positions"]


# ---------------------------------------------------------------------------
# OOP merging into /api/players
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_oop_merged_into_player_list(client, db_session, setup_team_context):
    """After adding an OOP custom position, GET /api/players returns the player
    with the OOP rating merged into the corresponding eligible_* field and
    the position listed in oop_positions."""
    team = setup_team_context["team"]

    # Create a pure SS player (no natural 3B eligibility)
    # Use scoresheet_id < 1000 to be in the AL home range for the test league
    player = await _create_player(db_session, scoresheet_id=500, mlb_id=500000, position="SS")
    # Add natural SS eligibility
    db_session.add(PlayerPosition(player_id=player.id, position="SS", rating=4.75))
    await db_session.commit()

    # Roster the player on the team so they appear in the league-scoped list
    db_session.add(PlayerRoster(player_id=player.id, team_id=team.id, status=RosterStatus.ROSTERED))
    await db_session.commit()

    # Add OOP custom position: SS -> 3B
    db_session.add(CustomPosition(team_id=team.id, player_id=player.id, position="3B"))
    await db_session.commit()

    # Fetch player list with team context
    response = await client.get(
        "/api/players",
        headers={"X-Team-Id": str(team.id)},
    )
    assert response.status_code == 200

    players_data = response.json()["players"]
    target = next((p for p in players_data if p["id"] == player.id), None)
    assert target is not None

    # OOP 3B rating should be populated (SS->3B base = 2.61, multiplier = 4.75/4.75 = 1.0)
    assert target["eligible_3b"] is not None
    assert abs(target["eligible_3b"] - 2.61) < 0.05

    # oop_positions should contain "3B"
    assert "3B" in target["oop_positions"]

    # Natural SS should still be there
    assert target["eligible_ss"] is not None
    assert abs(target["eligible_ss"] - 4.75) < 0.01
