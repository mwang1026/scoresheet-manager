"""Tests for HitterProjection and PitcherProjection models."""

import pytest
from sqlalchemy import select

from app.models import HitterProjection, PitcherProjection, Player


@pytest.mark.asyncio
async def test_create_hitter_projection(db_session, sample_player_data):
    """Test creating a hitter projection with PECOTA data."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    projection = HitterProjection(
        player_id=player.id,
        source="PECOTA-50",
        season=2026,
        pa=650,
        g=150,
        ab=580,
        r=95,
        b1=90,
        b2=35,
        b3=3,
        hr=25,
        h=153,
        tb=244,
        rbi=85,
        bb=60,
        hbp=5,
        so=145,
        sb=15,
        cs=5,
        avg=0.264,
        obp=0.340,
        slg=0.421,
        babip=0.305,
        drc_plus=110,
        drb=5.2,
        drp=1.8,
        vorp=25.5,
        warp=3.2,
        dc_fl=True,
        drp_str="SS 2",
        comparables="Player A (75), Player B (72)",
    )
    db_session.add(projection)
    await db_session.commit()
    await db_session.refresh(projection)

    assert projection.id is not None
    assert projection.player_id == player.id
    assert projection.source == "PECOTA-50"
    assert projection.season == 2026
    assert projection.pa == 650
    assert projection.hr == 25
    assert float(projection.avg) == 0.264
    assert projection.drc_plus == 110


@pytest.mark.asyncio
async def test_hitter_projection_unique_constraint(db_session, sample_player_data):
    """Test that player can only have one projection per source."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # First projection
    proj1 = HitterProjection(
        player_id=player.id, source="PECOTA-50", season=2026, pa=600
    )
    db_session.add(proj1)
    await db_session.commit()

    # Duplicate source for same player
    proj2 = HitterProjection(
        player_id=player.id, source="PECOTA-50", season=2026, pa=650
    )
    db_session.add(proj2)

    with pytest.raises(Exception):  # UniqueConstraint violation
        await db_session.commit()


@pytest.mark.asyncio
async def test_create_pitcher_projection(db_session):
    """Test creating a pitcher projection with PECOTA data."""
    player = Player(
        first_name="Test",
        last_name="Pitcher",
        scoresheet_id=7777,
        mlb_id=777777,
        primary_position="P",
        bats="R",
        throws="R",
        age=26,
        is_trade_bait=False,
    )
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    projection = PitcherProjection(
        player_id=player.id,
        source="PECOTA-50",
        season=2026,
        w=12,
        l=8,
        sv=0,
        hld=0,
        g=30,
        gs=30,
        qs=18,
        bf=780,
        ip_outs=570,  # 190 IP = 570 outs
        h=165,
        hr=20,
        bb=45,
        hbp=8,
        so=195,
        era=3.45,
        whip=1.11,
        babip=0.295,
        bb9=2.13,
        so9=9.24,
        fip=3.25,
        cfip=95,
        dra=3.50,
        dra_minus=102,
        warp=3.8,
        gb_percent=45.5,
        dc_fl=True,
        comparables="Pitcher X (80), Pitcher Y (77)",
    )
    db_session.add(projection)
    await db_session.commit()
    await db_session.refresh(projection)

    assert projection.id is not None
    assert projection.player_id == player.id
    assert projection.source == "PECOTA-50"
    assert projection.w == 12
    assert projection.ip_outs == 570
    assert float(projection.era) == 3.45
    assert float(projection.fip) == 3.25
    assert float(projection.warp) == 3.8


@pytest.mark.asyncio
async def test_pitcher_projection_unique_constraint(db_session):
    """Test that pitcher can only have one projection per source."""
    player = Player(
        first_name="Test",
        last_name="Pitcher",
        scoresheet_id=6666,
        primary_position="P",
        is_trade_bait=False,
    )
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # First projection
    proj1 = PitcherProjection(
        player_id=player.id, source="PECOTA-50", season=2026, g=30
    )
    db_session.add(proj1)
    await db_session.commit()

    # Duplicate source
    proj2 = PitcherProjection(
        player_id=player.id, source="PECOTA-50", season=2026, g=32
    )
    db_session.add(proj2)

    with pytest.raises(Exception):  # UniqueConstraint violation
        await db_session.commit()


@pytest.mark.asyncio
async def test_multiple_projection_sources(db_session, sample_player_data):
    """Test that player can have projections from multiple sources."""
    player = Player(**sample_player_data)
    db_session.add(player)
    await db_session.commit()
    await db_session.refresh(player)

    # PECOTA projection
    pecota = HitterProjection(
        player_id=player.id, source="PECOTA-50", season=2026, pa=600, hr=25
    )
    # Future: Steamer projection
    steamer = HitterProjection(
        player_id=player.id, source="Steamer", season=2026, pa=620, hr=28
    )

    db_session.add_all([pecota, steamer])
    await db_session.commit()

    # Query all projections
    result = await db_session.execute(
        select(HitterProjection).where(HitterProjection.player_id == player.id)
    )
    projections = result.scalars().all()

    assert len(projections) == 2
    sources = {p.source for p in projections}
    assert sources == {"PECOTA-50", "Steamer"}
