"""Tests for /api/projections endpoint."""

import pytest

from app.models import HitterProjection, PitcherProjection, Player


@pytest.mark.asyncio
async def test_list_projections_empty(client):
    """Test listing projections when database is empty."""
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    assert data["projections"] == []


@pytest.mark.asyncio
async def test_list_projections_filters_scoresheet_only(
    client, db_session, sample_player_data, sample_pecota_player_data,
    sample_hitter_projection_data, sample_pitcher_projection_data
):
    """Test that projections endpoint only returns projections for Scoresheet players."""
    # Modify player data to be hitter and pitcher
    sample_player_data["primary_position"] = "SS"
    sample_pecota_player_data["primary_position"] = "P"

    # Add Scoresheet player (hitter)
    scoresheet_player = Player(**sample_player_data)
    db_session.add(scoresheet_player)
    await db_session.flush()

    # Add PECOTA-only player (pitcher, no scoresheet_id)
    pecota_player = Player(**sample_pecota_player_data)
    db_session.add(pecota_player)
    await db_session.flush()

    # Add projections for both players
    scoresheet_projection = HitterProjection(
        player_id=scoresheet_player.id, **sample_hitter_projection_data
    )
    db_session.add(scoresheet_projection)

    pecota_projection = PitcherProjection(
        player_id=pecota_player.id, **sample_pitcher_projection_data
    )
    db_session.add(pecota_projection)

    await db_session.commit()

    # Query API
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1  # Only Scoresheet player's projection
    assert data["projections"][0]["player_id"] == scoresheet_player.id


@pytest.mark.asyncio
async def test_list_projections_source_filter(
    client, db_session, sample_player_data, sample_hitter_projection_data
):
    """Test filtering projections by source."""
    # Add player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.flush()

    # Add projections from multiple sources
    proj_50 = HitterProjection(
        player_id=player.id, **{**sample_hitter_projection_data, "source": "PECOTA-50"}
    )
    proj_10 = HitterProjection(
        player_id=player.id, **{**sample_hitter_projection_data, "source": "PECOTA-10"}
    )
    proj_90 = HitterProjection(
        player_id=player.id, **{**sample_hitter_projection_data, "source": "PECOTA-90"}
    )
    db_session.add_all([proj_50, proj_10, proj_90])
    await db_session.commit()

    # Query for specific source
    response = await client.get("/api/projections?source=PECOTA-50")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1
    assert data["projections"][0]["source"] == "PECOTA-50"


@pytest.mark.asyncio
async def test_list_projections_player_id_filter(
    client, db_session, sample_hitter_projection_data
):
    """Test filtering projections by player_id."""
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

    # Add projections for both players
    proj1 = HitterProjection(player_id=player1.id, **sample_hitter_projection_data)
    proj2 = HitterProjection(player_id=player2.id, **sample_hitter_projection_data)
    db_session.add_all([proj1, proj2])
    await db_session.commit()

    # Query for single player
    response = await client.get(f"/api/projections?player_id={player1.id}")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1
    assert data["projections"][0]["player_id"] == player1.id


@pytest.mark.asyncio
async def test_hitter_projection_field_mapping(
    client, db_session, sample_player_data, sample_hitter_projection_data
):
    """Test that hitter projection fields are correctly mapped (b1→single, b2→double, b3→triple)."""
    # Add player and projection
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.flush()

    projection = HitterProjection(player_id=player.id, **sample_hitter_projection_data)
    db_session.add(projection)
    await db_session.commit()

    # Query API
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1

    proj = data["projections"][0]
    assert proj["player_type"] == "hitter"
    assert proj["single"] == 90  # b1
    assert proj["double"] == 30  # b2
    assert proj["triple"] == 3   # b3

    # Fields not in DB should default to 0
    assert proj["ibb"] == 0
    assert proj["sf"] == 0
    assert proj["sh"] == 0
    assert proj["go"] == 0
    assert proj["fo"] == 0
    assert proj["gdp"] == 0


@pytest.mark.asyncio
async def test_pitcher_projection_er_calculation(
    client, db_session, sample_pitcher_projection_data
):
    """Test that pitcher ER is back-calculated from ERA and IP."""
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

    # Add projection with ERA=3.50, IP=180.0 (540 outs)
    # Expected ER = round(3.50 * 180 / 9) = round(70) = 70
    projection = PitcherProjection(player_id=player.id, **sample_pitcher_projection_data)
    db_session.add(projection)
    await db_session.commit()

    # Query API
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1

    proj = data["projections"][0]
    assert proj["player_type"] == "pitcher"
    assert proj["er"] == 70  # Back-calculated from ERA=3.50, IP=180.0

    # Fields not in DB should default to 0
    assert proj["gf"] == 0
    assert proj["cg"] == 0
    assert proj["sho"] == 0
    assert proj["r"] == 0
    assert proj["ibb"] == 0
    assert proj["wp"] == 0
    assert proj["bk"] == 0


@pytest.mark.asyncio
async def test_hitter_projection_advanced_metrics(
    client, db_session, sample_player_data, sample_hitter_projection_data
):
    """Test that hitter advanced metrics are populated."""
    # Add player and projection
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.flush()

    projection = HitterProjection(player_id=player.id, **sample_hitter_projection_data)
    db_session.add(projection)
    await db_session.commit()

    # Query API
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    proj = data["projections"][0]

    assert proj["advanced"] is not None
    assert proj["advanced"]["avg"] == 0.274
    assert proj["advanced"]["obp"] == 0.345
    assert proj["advanced"]["slg"] == 0.470
    assert proj["advanced"]["babip"] == 0.300
    assert proj["advanced"]["drc_plus"] == 110
    assert proj["advanced"]["vorp"] == 25.5
    assert proj["advanced"]["warp"] == 3.2


@pytest.mark.asyncio
async def test_pitcher_projection_advanced_metrics(
    client, db_session, sample_pitcher_projection_data
):
    """Test that pitcher advanced metrics are populated."""
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

    projection = PitcherProjection(player_id=player.id, **sample_pitcher_projection_data)
    db_session.add(projection)
    await db_session.commit()

    # Query API
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    proj = data["projections"][0]

    assert proj["advanced"] is not None
    assert proj["advanced"]["era"] == 3.50
    assert proj["advanced"]["whip"] == 1.22
    assert proj["advanced"]["fip"] == 3.40
    assert proj["advanced"]["dra"] == 3.60
    assert proj["advanced"]["dra_minus"] == 95
    assert proj["advanced"]["warp"] == 4.5
    assert proj["advanced"]["gb_percent"] == 45.5


@pytest.mark.asyncio
async def test_list_projections_combined_response(
    client, db_session, sample_hitter_projection_data, sample_pitcher_projection_data
):
    """Test that endpoint returns both hitter and pitcher projections together."""
    # Add hitter
    hitter = Player(
        first_name="Hitter",
        last_name="Test",
        scoresheet_id=1001,
        primary_position="SS",
        is_trade_bait=False,
    )
    db_session.add(hitter)
    await db_session.flush()

    # Add pitcher
    pitcher = Player(
        first_name="Pitcher",
        last_name="Test",
        scoresheet_id=1002,
        primary_position="P",
        is_trade_bait=False,
    )
    db_session.add(pitcher)
    await db_session.flush()

    # Add projections
    hitter_proj = HitterProjection(player_id=hitter.id, **sample_hitter_projection_data)
    pitcher_proj = PitcherProjection(player_id=pitcher.id, **sample_pitcher_projection_data)
    db_session.add_all([hitter_proj, pitcher_proj])
    await db_session.commit()

    # Query API
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 2

    # Should have one of each type
    player_types = [p["player_type"] for p in data["projections"]]
    assert "hitter" in player_types
    assert "pitcher" in player_types


@pytest.mark.asyncio
async def test_list_projections_season_filter(
    client, db_session, sample_player_data, sample_hitter_projection_data
):
    """Test filtering projections by season."""
    # Add player
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.flush()

    # Add projections for different seasons
    proj_2026 = HitterProjection(
        player_id=player.id, **{**sample_hitter_projection_data, "season": 2026}
    )
    proj_2025 = HitterProjection(
        player_id=player.id, **{**sample_hitter_projection_data, "season": 2025, "source": "PECOTA-OLD"}
    )
    db_session.add_all([proj_2026, proj_2025])
    await db_session.commit()

    # Query for 2026 (default)
    response = await client.get("/api/projections")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1
    assert data["projections"][0]["season"] == 2026

    # Query for 2025
    response = await client.get("/api/projections?season=2025")
    assert response.status_code == 200

    data = response.json()
    assert len(data["projections"]) == 1
    assert data["projections"][0]["season"] == 2025
