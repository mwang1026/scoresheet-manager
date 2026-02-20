"""Tests for import_players script."""

import csv
import tempfile
from pathlib import Path

import pytest
from sqlalchemy import select

from app.models import Player, PlayerPosition
from app.scripts.import_players import import_players


@pytest.fixture
def sample_scoresheet_tsv():
    """Create a temporary TSV file with sample Scoresheet data."""
    content = """SSBB\tMLBAM\tNL\tpos\th\tage\tteam\tfirstName\tlastName\t1B\t2B\t3B\tSS\tOF\tosbAL\tocsAL\tosbNL\tocsNL\tBAvR\tOBvR\tSLvR\tBAvL\tOBvL\tSLvL
1\t676979\t1001\tP\tL\t26\tBos\tGarrett\tCrochet\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
2\t682928\t1543\tSS\tL\t25\tWas\tCJ\tAbrams\t\t\t\t4.73\t\t\t\t\t\t0\t5\t13\t0\t-15\t-35
3\t660271\t1094\tP\tR\t31\tLAD\tShohei\tOhtani-P\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
4\t660271\t1737\tDH\tR\t31\tLAD\tShohei\tOhtani-H\t\t\t\t\t\t\t\t\t\t3\t11\t21\t-6\t-28\t-52
5\t669257\t1050\tC\tR\t28\tMil\tWilliam\tContreras\t\t\t\t\t\t0.75\t0.25\t0.70\t0.30\t5\t8\t12\t-2\t-5\t-10
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False) as f:
        f.write(content)
        return Path(f.name)


def test_import_players_parses_tsv(sample_scoresheet_tsv, sync_engine):
    """Test that import_players correctly parses and imports player data."""
    from sqlalchemy.orm import sessionmaker

    # Override SessionLocal for this test
    SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

    # Monkey-patch the import to use sync engine
    import app.scripts.import_players as import_module
    original_session = import_module.SessionLocal
    import_module.SessionLocal = SessionLocal

    try:
        import_players(str(sample_scoresheet_tsv))

        # Verify players imported
        with SessionLocal() as session:
            players = session.execute(select(Player)).scalars().all()
            assert len(players) == 5

            # Check specific players
            crochet = session.execute(
                select(Player).where(Player.scoresheet_id == 1)
            ).scalar_one()
            assert crochet.first_name == "Garrett"
            assert crochet.last_name == "Crochet"
            assert crochet.mlb_id == 676979
            assert crochet.primary_position == "P"

            abrams = session.execute(
                select(Player).where(Player.scoresheet_id == 2)
            ).scalar_one()
            assert abrams.first_name == "CJ"
            assert abrams.last_name == "Abrams"
            assert abrams.primary_position == "SS"
            assert abrams.ba_vr == 0
            assert abrams.ob_vr == 5
            assert abrams.sl_vr == 13

            # Check two-way player (both Ohtanis should exist)
            ohtanis = session.execute(
                select(Player).where(Player.mlb_id == 660271)
            ).scalars().all()
            assert len(ohtanis) == 2
            assert any(p.primary_position == "P" for p in ohtanis)
            assert any(p.primary_position == "DH" for p in ohtanis)

    finally:
        import_module.SessionLocal = original_session
        sample_scoresheet_tsv.unlink()


def test_import_players_defensive_positions(sample_scoresheet_tsv, sync_engine):
    """Test that defensive position ratings are imported."""
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

    import app.scripts.import_players as import_module
    original_session = import_module.SessionLocal
    import_module.SessionLocal = SessionLocal

    try:
        import_players(str(sample_scoresheet_tsv))

        with SessionLocal() as session:
            # CJ Abrams should have SS position rating
            abrams = session.execute(
                select(Player).where(Player.scoresheet_id == 2)
            ).scalar_one()

            positions = session.execute(
                select(PlayerPosition).where(PlayerPosition.player_id == abrams.id)
            ).scalars().all()

            assert len(positions) == 1
            assert positions[0].position == "SS"
            assert float(positions[0].rating) == 4.73

    finally:
        import_module.SessionLocal = original_session
        sample_scoresheet_tsv.unlink()


def test_import_players_catcher_stats(sample_scoresheet_tsv, sync_engine):
    """Test that catcher steal rates are imported."""
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

    import app.scripts.import_players as import_module
    original_session = import_module.SessionLocal
    import_module.SessionLocal = SessionLocal

    try:
        import_players(str(sample_scoresheet_tsv))

        with SessionLocal() as session:
            # William Contreras should have catcher steal rates
            contreras = session.execute(
                select(Player).where(Player.scoresheet_id == 5)
            ).scalar_one()

            assert contreras.primary_position == "C"
            assert float(contreras.osb_al) == 0.75
            assert float(contreras.ocs_al) == 0.25
            assert float(contreras.osb_nl) == 0.70
            assert float(contreras.ocs_nl) == 0.30

    finally:
        import_module.SessionLocal = original_session
        sample_scoresheet_tsv.unlink()
