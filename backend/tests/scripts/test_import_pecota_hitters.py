"""Tests for import_pecota_hitters script."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import HitterProjection, Player
from app.scripts.import_pecota_hitters import import_pecota_hitters


SAMPLE_HITTER_TSV_HEADER = (
    "mlbid\tbpid\tfirst_name\tlast_name\tpos\tbats\tthrows\tbirthday\theight\t"
    "weight\tage\tteam\tseason\tpa\tg\tab\tr\tb1\tb2\tb3\thr\th\ttb\trbi\tbb\t"
    "hbp\tso\tsb\tcs\tavg\tobp\tslg\tbabip\tdrc_plus\tdrb\tdrp\tvorp\twarp\t"
    "dc_fl\tdrp_str\tcomparables"
)


def _make_hitter_row(
    mlbid="12345", bpid="99", first_name="Test", last_name="Hitter",
    pos="OF", bats="R", throws="R", team="NYY", season="2026",
):
    """Build a TSV row string for a hitter."""
    return (
        f"{mlbid}\t{bpid}\t{first_name}\t{last_name}\t{pos}\t{bats}\t{throws}\t"
        f"1995-01-01\t72\t200\t31\t{team}\t{season}\t600\t150\t540\t85\t90\t30\t3\t"
        f"25\t148\t254\t80\t55\t5\t140\t10\t3\t0.274\t0.345\t0.470\t0.300\t110\t"
        f"1.5\t0.5\t25.5\t3.2\tFALSE\t\t"
    )


def _write_tsv(rows: list[str]) -> Path:
    """Write a TSV file and return its path."""
    content = SAMPLE_HITTER_TSV_HEADER + "\n" + "\n".join(rows) + "\n"
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False)
    f.write(content)
    f.close()
    return Path(f.name)


class TestImportPecotaHitters:
    """Integration tests for import_pecota_hitters."""

    def test_creates_player_and_projection(self, sync_engine):
        """New player from PECOTA creates Player + HitterProjection."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_hitter_row()])

        import app.scripts.import_pecota_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_hitters(str(tsv_path))

            with SessionLocal() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 1
                assert players[0].mlb_id == 12345
                assert players[0].first_name == "Test"

                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 1
                assert projections[0].source == "PECOTA-50"
                assert projections[0].pa == 600
                assert projections[0].hr == 25
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_enriches_existing_player(self, sync_engine):
        """Existing player gets enriched, not duplicated."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

        # Pre-seed player
        with SessionLocal() as session:
            player = Player(
                first_name="Test", last_name="Hitter",
                scoresheet_id=1, mlb_id=12345,
                primary_position="OF", bp_id=None,
            )
            session.add(player)
            session.commit()

        tsv_path = _write_tsv([_make_hitter_row(bpid="99")])

        import app.scripts.import_pecota_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_hitters(str(tsv_path))

            with SessionLocal() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 1  # Not duplicated
                assert players[0].bp_id == 99  # Enriched

                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 1
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_two_way_player_prefers_non_pitcher(self, sync_engine):
        """For hitter projections, prefer the non-pitcher entry."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

        # Pre-seed two entries for same mlb_id (two-way player)
        with SessionLocal() as session:
            pitcher = Player(
                first_name="Shohei", last_name="Ohtani-P",
                scoresheet_id=1, mlb_id=660271,
                primary_position="P",
            )
            hitter = Player(
                first_name="Shohei", last_name="Ohtani-H",
                scoresheet_id=2, mlb_id=660271,
                primary_position="DH",
            )
            session.add_all([pitcher, hitter])
            session.commit()
            hitter_id = hitter.id

        tsv_path = _write_tsv([_make_hitter_row(mlbid="660271", first_name="Shohei", last_name="Ohtani")])

        import app.scripts.import_pecota_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_hitters(str(tsv_path))

            with SessionLocal() as session:
                # Projection should be linked to the hitter (DH), not the pitcher
                proj = session.execute(select(HitterProjection)).scalar_one()
                assert proj.player_id == hitter_id
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_skips_row_with_no_mlbid(self, sync_engine):
        """Rows without mlbid should be skipped."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_hitter_row(mlbid="")])

        import app.scripts.import_pecota_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_hitters(str(tsv_path))

            with SessionLocal() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 0

                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_upsert_updates_existing_projection(self, sync_engine):
        """Re-import should update, not duplicate, projections."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_hitter_row()])

        import app.scripts.import_pecota_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            # Import twice
            import_pecota_hitters(str(tsv_path))
            import_pecota_hitters(str(tsv_path))

            with SessionLocal() as session:
                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 1  # Not duplicated
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()
