"""Tests for Player and PlayerPosition models."""

import pytest
from sqlalchemy import select

from app.models import Player, PlayerPosition


@pytest.mark.asyncio
async def test_create_player(db_session, sample_player_data):
    """Test creating a player with all fields."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    assert player.id is not None
    assert player.first_name == "Test"
    assert player.last_name == "Player"
    assert player.scoresheet_id == 9999
    assert player.mlb_id == 999999
    assert player.primary_position == "SS"


@pytest.mark.asyncio
async def test_player_scoresheet_id_unique(db_session, sample_player_data):
    """Test that scoresheet_id must be unique."""
    player1 = Player(**sample_player_data)
    db_session.add(player1)
    await db_session.commit()

    # Try to create duplicate scoresheet_id
    player2_data = sample_player_data.copy()
    player2_data["mlb_id"] = 888888  # Different mlb_id
    player2 = Player(**player2_data)
    db_session.add(player2)

    with pytest.raises(Exception):  # IntegrityError
        await db_session.commit()


@pytest.mark.asyncio
async def test_player_mlb_id_not_unique(db_session, sample_player_data):
    """Test that mlb_id can be duplicated (for two-way players)."""
    # Ohtani-P
    player1 = Player(
        first_name="Shohei",
        last_name="Ohtani-P",
        scoresheet_id=1000,
        mlb_id=660271,
        primary_position="P",
        bats="R",
        throws="R",
        age=31,
        is_trade_bait=False,
    )
    db_session.add(player1)
    await db_session.commit()

    # Ohtani-H (same mlb_id, different scoresheet_id)
    player2 = Player(
        first_name="Shohei",
        last_name="Ohtani-H",
        scoresheet_id=1001,
        mlb_id=660271,  # Same mlb_id
        primary_position="DH",
        bats="R",
        throws="R",
        age=31,
        is_trade_bait=False,
    )
    db_session.add(player2)
    await db_session.commit()  # Should not raise

    # Verify both exist
    result = await db_session.execute(select(Player).where(Player.mlb_id == 660271))
    players = result.scalars().all()
    assert len(players) == 2


@pytest.mark.asyncio
async def test_player_check_constraint(db_session):
    """Test that player must have either scoresheet_id or mlb_id."""
    player = Player(
        first_name="No",
        last_name="IDs",
        scoresheet_id=None,
        mlb_id=None,
        primary_position="P",
        is_trade_bait=False,
    )
    db_session.add(player)

    with pytest.raises(Exception):  # CheckConstraint violation
        await db_session.commit()


@pytest.mark.asyncio
async def test_player_position_rating(db_session, sample_player_data):
    """Test creating player with defensive position ratings."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add defensive positions
    ss_position = PlayerPosition(player_id=player.id, position="SS", rating=4.80)
    of_position = PlayerPosition(player_id=player.id, position="OF", rating=3.50)
    db_session.add_all([ss_position, of_position])
    await db_session.commit()

    # Query positions
    result = await db_session.execute(
        select(PlayerPosition).where(PlayerPosition.player_id == player.id)
    )
    positions = result.scalars().all()

    assert len(positions) == 2
    assert any(p.position == "SS" and p.rating == 4.80 for p in positions)
    assert any(p.position == "OF" and p.rating == 3.50 for p in positions)


@pytest.mark.asyncio
async def test_player_position_unique_constraint(db_session, sample_player_data):
    """Test that player can't have duplicate position ratings."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # Add SS position
    position1 = PlayerPosition(player_id=player.id, position="SS", rating=4.80)
    db_session.add(position1)
    await db_session.commit()

    # Try to add duplicate SS position
    position2 = PlayerPosition(player_id=player.id, position="SS", rating=5.00)
    db_session.add(position2)

    with pytest.raises(Exception):  # UniqueConstraint violation
        await db_session.commit()


@pytest.mark.asyncio
async def test_player_catcher_steal_rates(db_session):
    """Test catcher-specific steal rate fields."""
    catcher = Player(
        first_name="Test",
        last_name="Catcher",
        scoresheet_id=8888,
        mlb_id=888888,
        primary_position="C",
        bats="R",
        throws="R",
        age=27,
        is_trade_bait=False,
        osb_al=0.75,
        ocs_al=0.25,
        osb_nl=0.70,
        ocs_nl=0.30,
    )
    db_session.add(catcher)
    await db_session.commit()
    await db_session.refresh(catcher)

    assert float(catcher.osb_al) == 0.75
    assert float(catcher.ocs_al) == 0.25
    assert float(catcher.osb_nl) == 0.70
    assert float(catcher.ocs_nl) == 0.30


@pytest.mark.asyncio
async def test_player_batting_splits(db_session, sample_player_data):
    """Test batting split adjustment fields."""
    player_data = sample_player_data.copy()
    player_data.update({
        "ba_vr": 5,
        "ob_vr": 10,
        "sl_vr": 15,
        "ba_vl": -3,
        "ob_vl": -8,
        "sl_vl": -12,
    })

    player = Player(**player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    assert player.ba_vr == 5
    assert player.ob_vr == 10
    assert player.sl_vr == 15
    assert player.ba_vl == -3
    assert player.ob_vl == -8
    assert player.sl_vl == -12
