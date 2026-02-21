"""Tests for /api/draft-queue endpoints."""

import pytest

from app.models import DraftQueue, Player, Team, User, Watchlist


@pytest.mark.asyncio
async def test_get_draft_queue_empty(client, db_session):
    """Test getting draft queue when it's empty."""
    # Create user
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

    # Get queue
    response = await client.get("/api/draft-queue")
    assert response.status_code == 200

    data = response.json()
    assert data["player_ids"] == []


@pytest.mark.asyncio
async def test_get_draft_queue_ordered(client, db_session, sample_player_data):
    """Test that draft queue returns players in rank order."""
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
    player3 = Player(
        **{**sample_player_data, "scoresheet_id": 7777, "mlb_id": 777777}
    )
    db_session.add_all([player1, player2, player3])
    await db_session.commit()
    await db_session.refresh(player1)
    await db_session.refresh(player2)
    await db_session.refresh(player3)

    # Add to queue in specific order
    queue1 = DraftQueue(user_id=user.id, player_id=player2.id, rank=0)
    queue2 = DraftQueue(user_id=user.id, player_id=player1.id, rank=1)
    queue3 = DraftQueue(user_id=user.id, player_id=player3.id, rank=2)
    db_session.add_all([queue1, queue2, queue3])
    await db_session.commit()

    # Get queue
    response = await client.get("/api/draft-queue")
    assert response.status_code == 200

    data = response.json()
    assert len(data["player_ids"]) == 3
    # Verify order matches rank
    assert data["player_ids"][0] == player2.id
    assert data["player_ids"][1] == player1.id
    assert data["player_ids"][2] == player3.id


@pytest.mark.asyncio
async def test_add_to_draft_queue(client, db_session, sample_player_data):
    """Test adding a player to the draft queue."""
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

    # Add to queue
    response = await client.post("/api/draft-queue", json={"player_id": player.id})
    assert response.status_code == 200

    data = response.json()
    assert player.id in data["player_ids"]


@pytest.mark.asyncio
async def test_add_to_draft_queue_also_adds_to_watchlist(
    client, db_session, sample_player_data
):
    """Test that adding to queue also adds to watchlist."""
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

    # Add to queue
    response = await client.post("/api/draft-queue", json={"player_id": player.id})
    assert response.status_code == 200

    # Verify also in watchlist
    from sqlalchemy import select

    watchlist_result = await db_session.execute(
        select(Watchlist).where(
            Watchlist.user_id == user.id, Watchlist.player_id == player.id
        )
    )
    assert watchlist_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_add_to_draft_queue_idempotent(client, db_session, sample_player_data):
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

    # Add to queue twice
    response1 = await client.post("/api/draft-queue", json={"player_id": player.id})
    assert response1.status_code == 200

    response2 = await client.post("/api/draft-queue", json={"player_id": player.id})
    assert response2.status_code == 200

    # Should still only have one entry
    data = response2.json()
    assert len(data["player_ids"]) == 1
    assert player.id in data["player_ids"]


@pytest.mark.asyncio
async def test_remove_from_draft_queue(client, db_session, sample_player_data):
    """Test removing a player from the draft queue."""
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

    # Add to queue
    queue1 = DraftQueue(user_id=user.id, player_id=player1.id, rank=0)
    queue2 = DraftQueue(user_id=user.id, player_id=player2.id, rank=1)
    db_session.add_all([queue1, queue2])
    await db_session.commit()

    # Remove first player
    response = await client.delete(f"/api/draft-queue/{player1.id}")
    assert response.status_code == 200

    data = response.json()
    assert player1.id not in data["player_ids"]
    assert player2.id in data["player_ids"]

    # Verify ranks were reordered
    from sqlalchemy import select

    queue_result = await db_session.execute(
        select(DraftQueue)
        .where(DraftQueue.user_id == user.id)
        .order_by(DraftQueue.rank)
    )
    remaining = queue_result.scalars().all()
    assert len(remaining) == 1
    assert remaining[0].player_id == player2.id
    assert remaining[0].rank == 0  # Should be reranked to 0


@pytest.mark.asyncio
async def test_remove_from_draft_queue_keeps_in_watchlist(
    client, db_session, sample_player_data
):
    """Test that removing from queue does NOT remove from watchlist."""
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

    # Remove from queue
    response = await client.delete(f"/api/draft-queue/{player.id}")
    assert response.status_code == 200

    # Verify still in watchlist
    from sqlalchemy import select

    watchlist_result = await db_session.execute(
        select(Watchlist).where(
            Watchlist.user_id == user.id, Watchlist.player_id == player.id
        )
    )
    assert watchlist_result.scalars().first() is not None


@pytest.mark.asyncio
async def test_reorder_draft_queue(client, db_session, sample_player_data):
    """Test reordering the entire draft queue."""
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
    player3 = Player(
        **{**sample_player_data, "scoresheet_id": 7777, "mlb_id": 777777}
    )
    db_session.add_all([player1, player2, player3])
    await db_session.commit()
    await db_session.refresh(player1)
    await db_session.refresh(player2)
    await db_session.refresh(player3)

    # Add to queue in initial order
    queue1 = DraftQueue(user_id=user.id, player_id=player1.id, rank=0)
    queue2 = DraftQueue(user_id=user.id, player_id=player2.id, rank=1)
    queue3 = DraftQueue(user_id=user.id, player_id=player3.id, rank=2)
    db_session.add_all([queue1, queue2, queue3])
    await db_session.commit()

    # Reorder: reverse the order
    new_order = [player3.id, player2.id, player1.id]
    response = await client.put(
        "/api/draft-queue/reorder", json={"player_ids": new_order}
    )
    assert response.status_code == 200

    data = response.json()
    assert data["player_ids"] == new_order


@pytest.mark.asyncio
async def test_reorder_draft_queue_empty(client, db_session):
    """Test reordering with an empty list."""
    # Create user and team
    team = Team(name="Test Team", scoresheet_id=1, is_my_team=True)
    db_session.add(team)
    await db_session.commit()
    await db_session.refresh(team)

    user = User(id=1, email="test@example.com", team_id=team.id, role="user")
    db_session.add(user)
    await db_session.commit()

    # Reorder with empty list
    response = await client.put("/api/draft-queue/reorder", json={"player_ids": []})
    assert response.status_code == 200

    data = response.json()
    assert data["player_ids"] == []
