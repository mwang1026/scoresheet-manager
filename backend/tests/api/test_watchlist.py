"""Tests for /api/watchlist endpoints."""

import pytest

from app.models import DraftQueue, Player, Watchlist


@pytest.mark.asyncio
async def test_get_watchlist_empty(client, setup_team_context):
    """Test getting watchlist when it's empty."""
    # Get watchlist
    response = await client.get("/api/watchlist")
    assert response.status_code == 200

    data = response.json()
    assert data["player_ids"] == []


@pytest.mark.asyncio
async def test_get_watchlist(client, db_session, setup_team_context, sample_player_data):
    """Test getting watchlist with players."""
    team = setup_team_context["team"]

    # Create players
    player1 = Player(**sample_player_data)
    player2 = Player(
        **{**sample_player_data, "scoresheet_id": 200, "mlb_id": 888888}
    )
    db_session.add_all([player1, player2])
    await db_session.commit()
    await db_session.refresh(player1)
    await db_session.refresh(player2)

    # Add to watchlist
    watchlist1 = Watchlist(team_id=team.id, player_id=player1.id)
    watchlist2 = Watchlist(team_id=team.id, player_id=player2.id)
    db_session.add_all([watchlist1, watchlist2])
    await db_session.commit()

    # Get watchlist
    response = await client.get("/api/watchlist")
    assert response.status_code == 200

    data = response.json()
    assert len(data["player_ids"]) == 2
    assert player1.id in data["player_ids"]
    assert player2.id in data["player_ids"]


@pytest.mark.asyncio
async def test_add_to_watchlist(client, db_session, setup_team_context, sample_player_data):
    """Test adding a player to the watchlist."""
    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add to watchlist
    response = await client.post("/api/watchlist", json={"player_id": player.id})
    assert response.status_code == 200

    data = response.json()
    assert player.id in data["player_ids"]


@pytest.mark.asyncio
async def test_add_to_watchlist_idempotent(client, db_session, setup_team_context, sample_player_data):
    """Test that adding the same player twice is idempotent."""
    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add to watchlist twice
    response1 = await client.post("/api/watchlist", json={"player_id": player.id})
    assert response1.status_code == 200

    response2 = await client.post("/api/watchlist", json={"player_id": player.id})
    assert response2.status_code == 200

    # Should still only have one entry
    data = response2.json()
    assert len(data["player_ids"]) == 1
    assert player.id in data["player_ids"]


@pytest.mark.asyncio
async def test_remove_from_watchlist(client, db_session, setup_team_context, sample_player_data):
    """Test removing a player from the watchlist."""
    team = setup_team_context["team"]

    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add to watchlist
    watchlist = Watchlist(team_id=team.id, player_id=player.id)
    db_session.add(watchlist)
    await db_session.commit()

    # Remove from watchlist
    response = await client.delete(f"/api/watchlist/{player.id}")
    assert response.status_code == 200

    data = response.json()
    assert player.id not in data["player_ids"]


@pytest.mark.asyncio
async def test_remove_from_watchlist_also_removes_from_queue(
    client, db_session, setup_team_context, sample_player_data
):
    """Test that removing from watchlist also removes from draft queue."""
    team = setup_team_context["team"]

    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add to watchlist and queue
    watchlist = Watchlist(team_id=team.id, player_id=player.id)
    queue = DraftQueue(team_id=team.id, player_id=player.id, rank=0)
    db_session.add_all([watchlist, queue])
    await db_session.commit()

    # Remove from watchlist
    response = await client.delete(f"/api/watchlist/{player.id}")
    assert response.status_code == 200

    # Verify removed from both watchlist and queue
    from sqlalchemy import select

    watchlist_result = await db_session.execute(
        select(Watchlist).where(Watchlist.team_id == team.id)
    )
    assert watchlist_result.scalars().first() is None

    queue_result = await db_session.execute(
        select(DraftQueue).where(DraftQueue.team_id == team.id)
    )
    assert queue_result.scalars().first() is None


@pytest.mark.asyncio
async def test_remove_from_watchlist_idempotent(client, db_session, setup_team_context, sample_player_data):
    """Test that removing a player not in watchlist is idempotent."""
    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Remove from watchlist (player not in watchlist)
    response = await client.delete(f"/api/watchlist/{player.id}")
    assert response.status_code == 200

    data = response.json()
    assert player.id not in data["player_ids"]


@pytest.mark.asyncio
async def test_watchlist_isolation_between_teams(client, db_session, sample_league, sample_player_data):
    """Test that watchlist data is isolated per team via X-Team-Id header."""
    from app.models import League, Team

    # Create 2 teams
    team1 = Team(league_id=sample_league.id, name="Team One", scoresheet_id=1)
    team2 = Team(league_id=sample_league.id, name="Team Two", scoresheet_id=2)
    db_session.add_all([team1, team2])
    await db_session.commit()
    await db_session.refresh(team1)
    await db_session.refresh(team2)

    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add player to team1's watchlist via DB
    watchlist1 = Watchlist(team_id=team1.id, player_id=player.id)
    db_session.add(watchlist1)
    await db_session.commit()

    # GET with X-Team-Id: team1 — should have the player
    response1 = await client.get("/api/watchlist", headers={"X-Team-Id": str(team1.id)})
    assert response1.status_code == 200
    data1 = response1.json()
    assert player.id in data1["player_ids"]

    # GET with X-Team-Id: team2 — should be empty
    response2 = await client.get("/api/watchlist", headers={"X-Team-Id": str(team2.id)})
    assert response2.status_code == 200
    data2 = response2.json()
    assert player.id not in data2["player_ids"]
    assert data2["player_ids"] == []
