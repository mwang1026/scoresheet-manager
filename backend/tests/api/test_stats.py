"""Tests for /api/stats endpoints."""

from datetime import date

import pytest

from app.models import HitterDailyStats, PitcherDailyStats, Player


@pytest.mark.asyncio
async def test_list_hitter_stats_empty(client):
    """Test listing hitter stats when database is empty."""
    response = await client.get("/api/stats/hitters?start=2025-09-01&end=2025-09-28")
    assert response.status_code == 200

    data = response.json()
    assert data["stats"] == []


@pytest.mark.asyncio
async def test_list_hitter_stats_requires_date_range(client):
    """Test that hitter stats endpoint requires start and end dates."""
    response = await client.get("/api/stats/hitters")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_list_hitter_stats_filters_scoresheet_only(
    client, db_session, sample_player_data, sample_pecota_player_data, sample_hitter_stats_data
):
    """Test that stats endpoint only returns stats for Scoresheet players."""
    # Add Scoresheet player
    scoresheet_player = Player(**sample_player_data)
    db_session.add(scoresheet_player)
    await db_session.flush()

    # Add PECOTA-only player (no scoresheet_id)
    pecota_player = Player(**sample_pecota_player_data)
    db_session.add(pecota_player)
    await db_session.flush()

    # Add stats for both players
    scoresheet_stats = HitterDailyStats(
        player_id=scoresheet_player.id, **sample_hitter_stats_data
    )
    db_session.add(scoresheet_stats)

    pecota_stats = HitterDailyStats(player_id=pecota_player.id, **sample_hitter_stats_data)
    db_session.add(pecota_stats)

    await db_session.commit()

    # Query API
    response = await client.get("/api/stats/hitters?start=2025-09-01&end=2025-09-28")
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 1  # Only Scoresheet player's stats
    assert data["stats"][0]["player_id"] == scoresheet_player.id


@pytest.mark.asyncio
async def test_list_hitter_stats_date_filtering(
    client, db_session, sample_player_data, sample_hitter_stats_data
):
    """Test date range filtering for hitter stats."""
    # Add player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.flush()

    # Add stats for multiple dates
    dates = [date(2025, 9, 1), date(2025, 9, 15), date(2025, 9, 28)]
    for d in dates:
        stats = HitterDailyStats(player_id=player.id, **{**sample_hitter_stats_data, "date": d})
        db_session.add(stats)

    await db_session.commit()

    # Query for subset of dates
    response = await client.get("/api/stats/hitters?start=2025-09-01&end=2025-09-15")
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 2  # Only first two dates
    returned_dates = [s["date"] for s in data["stats"]]
    assert "2025-09-01" in returned_dates
    assert "2025-09-15" in returned_dates
    assert "2025-09-28" not in returned_dates


@pytest.mark.asyncio
async def test_list_hitter_stats_player_id_filter(
    client, db_session, sample_hitter_stats_data
):
    """Test filtering hitter stats by player_id."""
    # Add two players
    player1 = Player(
        first_name="Player",
        last_name="One",
        scoresheet_id=1001,
        primary_position="SS",
        is_trade_bait=False,
    )
    player2 = Player(
        first_name="Player",
        last_name="Two",
        scoresheet_id=1002,
        primary_position="OF",
        is_trade_bait=False,
    )
    db_session.add_all([player1, player2])
    await db_session.flush()

    # Add stats for both players
    stats1 = HitterDailyStats(player_id=player1.id, **sample_hitter_stats_data)
    stats2 = HitterDailyStats(player_id=player2.id, **sample_hitter_stats_data)
    db_session.add_all([stats1, stats2])
    await db_session.commit()

    # Query for single player
    response = await client.get(
        f"/api/stats/hitters?start=2025-09-01&end=2025-09-28&player_id={player1.id}"
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 1
    assert data["stats"][0]["player_id"] == player1.id


@pytest.mark.asyncio
async def test_list_pitcher_stats_empty(client):
    """Test listing pitcher stats when database is empty."""
    response = await client.get("/api/stats/pitchers?start=2025-09-01&end=2025-09-28")
    assert response.status_code == 200

    data = response.json()
    assert data["stats"] == []


@pytest.mark.asyncio
async def test_list_pitcher_stats_requires_date_range(client):
    """Test that pitcher stats endpoint requires start and end dates."""
    response = await client.get("/api/stats/pitchers")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_list_pitcher_stats_filters_scoresheet_only(
    client, db_session, sample_player_data, sample_pecota_player_data, sample_pitcher_stats_data
):
    """Test that pitcher stats endpoint only returns stats for Scoresheet players."""
    # Modify player data to be pitchers
    sample_player_data["primary_position"] = "P"
    sample_pecota_player_data["primary_position"] = "P"

    # Add Scoresheet player
    scoresheet_player = Player(**sample_player_data)
    db_session.add(scoresheet_player)
    await db_session.flush()

    # Add PECOTA-only player
    pecota_player = Player(**sample_pecota_player_data)
    db_session.add(pecota_player)
    await db_session.flush()

    # Add stats for both players
    scoresheet_stats = PitcherDailyStats(
        player_id=scoresheet_player.id, **sample_pitcher_stats_data
    )
    db_session.add(scoresheet_stats)

    pecota_stats = PitcherDailyStats(player_id=pecota_player.id, **sample_pitcher_stats_data)
    db_session.add(pecota_stats)

    await db_session.commit()

    # Query API
    response = await client.get("/api/stats/pitchers?start=2025-09-01&end=2025-09-28")
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 1  # Only Scoresheet player's stats
    assert data["stats"][0]["player_id"] == scoresheet_player.id


@pytest.mark.asyncio
async def test_list_pitcher_stats_date_filtering(
    client, db_session, sample_pitcher_stats_data
):
    """Test date range filtering for pitcher stats."""
    # Add pitcher
    player = Player(
        first_name="Pitcher",
        last_name="Test",
        scoresheet_id=1001,
        primary_position="P",
        is_trade_bait=False,
    )
    db_session.add(player)
    await db_session.flush()

    # Add stats for multiple dates
    dates = [date(2025, 9, 1), date(2025, 9, 15), date(2025, 9, 28)]
    for d in dates:
        stats = PitcherDailyStats(
            player_id=player.id, **{**sample_pitcher_stats_data, "date": d}
        )
        db_session.add(stats)

    await db_session.commit()

    # Query for subset of dates
    response = await client.get("/api/stats/pitchers?start=2025-09-01&end=2025-09-15")
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 2  # Only first two dates
    returned_dates = [s["date"] for s in data["stats"]]
    assert "2025-09-01" in returned_dates
    assert "2025-09-15" in returned_dates
    assert "2025-09-28" not in returned_dates


@pytest.mark.asyncio
async def test_list_pitcher_stats_player_id_filter(
    client, db_session, sample_pitcher_stats_data
):
    """Test filtering pitcher stats by player_id."""
    # Add two pitchers
    player1 = Player(
        first_name="Pitcher",
        last_name="One",
        scoresheet_id=1001,
        primary_position="P",
        is_trade_bait=False,
    )
    player2 = Player(
        first_name="Pitcher",
        last_name="Two",
        scoresheet_id=1002,
        primary_position="P",
        is_trade_bait=False,
    )
    db_session.add_all([player1, player2])
    await db_session.flush()

    # Add stats for both players
    stats1 = PitcherDailyStats(player_id=player1.id, **sample_pitcher_stats_data)
    stats2 = PitcherDailyStats(player_id=player2.id, **sample_pitcher_stats_data)
    db_session.add_all([stats1, stats2])
    await db_session.commit()

    # Query for single player
    response = await client.get(
        f"/api/stats/pitchers?start=2025-09-01&end=2025-09-28&player_id={player1.id}"
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 1
    assert data["stats"][0]["player_id"] == player1.id


@pytest.mark.asyncio
async def test_hitter_stats_ordering(client, db_session, sample_hitter_stats_data):
    """Test that hitter stats are ordered by player_id, date."""
    # Add two players
    player1 = Player(
        first_name="Player",
        last_name="One",
        scoresheet_id=1002,  # Higher scoresheet_id
        primary_position="SS",
        is_trade_bait=False,
    )
    player2 = Player(
        first_name="Player",
        last_name="Two",
        scoresheet_id=1001,  # Lower scoresheet_id
        primary_position="OF",
        is_trade_bait=False,
    )
    db_session.add_all([player1, player2])
    await db_session.flush()

    # Add stats for both on multiple dates (reversed order)
    dates = [date(2025, 9, 15), date(2025, 9, 1)]
    for d in dates:
        stats1 = HitterDailyStats(player_id=player1.id, **{**sample_hitter_stats_data, "date": d})
        stats2 = HitterDailyStats(player_id=player2.id, **{**sample_hitter_stats_data, "date": d})
        db_session.add_all([stats1, stats2])

    await db_session.commit()

    # Query API
    response = await client.get("/api/stats/hitters?start=2025-09-01&end=2025-09-28")
    assert response.status_code == 200

    data = response.json()
    assert len(data["stats"]) == 4

    # Should be ordered by player_id (player1 has lower id), then date
    assert data["stats"][0]["player_id"] == player1.id
    assert data["stats"][0]["date"] == "2025-09-01"
    assert data["stats"][1]["player_id"] == player1.id
    assert data["stats"][1]["date"] == "2025-09-15"
    assert data["stats"][2]["player_id"] == player2.id
    assert data["stats"][2]["date"] == "2025-09-01"
    assert data["stats"][3]["player_id"] == player2.id
    assert data["stats"][3]["date"] == "2025-09-15"
