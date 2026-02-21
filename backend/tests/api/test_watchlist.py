"""Tests for /api/watchlist endpoints."""

import pytest

from app.models import DraftQueue, Player, Team, User, Watchlist


@pytest.mark.asyncio
async def test_get_watchlist_empty(client, db_session):
    """Test getting watchlist when it's empty."""
    # Create user
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

    # Get watchlist
    response = await client.get("/api/watchlist")
    assert response.status_code == 200

    data = response.json()
    assert data["player_ids"] == []


@pytest.mark.asyncio
async def test_get_watchlist(client, db_session, sample_player_data):
    """Test getting watchlist with players."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

    # Create players
    player1 = Player(**sample_player_data)
    player2 = Player(
        **{**sample_player_data, "scoresheet_id": 8888, "mlb_id": 888888}
    )
    db_session.add_all([player1, player2])
    await db_session.commit()
    await db_session.refresh(player1)
    await db_session.refresh(player2)

    # Add to watchlist
    watchlist1 = Watchlist(user_id=user.id, player_id=player1.id)
    watchlist2 = Watchlist(user_id=user.id, player_id=player2.id)
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
async def test_add_to_watchlist(client, db_session, sample_player_data):
    """Test adding a player to the watchlist."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

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
async def test_add_to_watchlist_idempotent(client, db_session, sample_player_data):
    """Test that adding the same player twice is idempotent."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

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
async def test_remove_from_watchlist(client, db_session, sample_player_data):
    """Test removing a player from the watchlist."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add to watchlist
    watchlist = Watchlist(user_id=user.id, player_id=player.id)
    db_session.add(watchlist)
    await db_session.commit()

    # Remove from watchlist
    response = await client.delete(f"/api/watchlist/{player.id}")
    assert response.status_code == 200

    data = response.json()
    assert player.id not in data["player_ids"]


@pytest.mark.asyncio
async def test_remove_from_watchlist_also_removes_from_queue(
    client, db_session, sample_player_data
):
    """Test that removing from watchlist also removes from draft queue."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

    # Create player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add to watchlist and queue
    watchlist = Watchlist(user_id=user.id, player_id=player.id)
    queue = DraftQueue(user_id=user.id, player_id=player.id, rank=0)
    db_session.add_all([watchlist, queue])
    await db_session.commit()

    # Remove from watchlist
    response = await client.delete(f"/api/watchlist/{player.id}")
    assert response.status_code == 200

    # Verify removed from both watchlist and queue
    from sqlalchemy import select

    watchlist_result = await db_session.execute(
        select(Watchlist).where(Watchlist.user_id == user.id)
    )
    assert watchlist_result.scalars().first() is None

    queue_result = await db_session.execute(
        select(DraftQueue).where(DraftQueue.user_id == user.id)
    )
    assert queue_result.scalars().first() is None


@pytest.mark.asyncio
async def test_remove_from_watchlist_idempotent(client, db_session, sample_player_data):
    """Test that removing a player not in watchlist is idempotent."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

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
