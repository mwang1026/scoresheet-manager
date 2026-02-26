"""Tests for import_pecota_pitchers script."""

import tempfile
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import PitcherProjection, Player
from app.scripts.import_pecota_pitchers import import_pecota_pitchers


SAMPLE_PITCHER_TSV_HEADER = (
    "mlbid\tbpid\tfirst_name\tlast_name\tpos\tbats\tthrows\tbirthday\theight\t"
    "weight\tage\tteam\tseason\tw\tl\tsv\thld\tg\tgs\tqs\tbf\tip\th\thr\tbb\t"
    "hbp\tso\tera\twhip\tbabip\tbb9\tso9\tfip\tcfip\tdra\tdra_minus\twarp\t"
    "gb_percent\tdc_fl\tcomparables"
)


def _make_pitcher_row(
    mlbid="54321", bpid="88", first_name="Test", last_name="Pitcher",
    pos="P", bats="R", throws="R", team="LAD", season="2026",
):
    """Build a TSV row string for a pitcher."""
    return (
        f"{mlbid}\t{bpid}\t{first_name}\t{last_name}\t{pos}\t{bats}\t{throws}\t"
        f"1992-05-15\t75\t220\t34\t{team}\t{season}\t12\t8\t0\t0\t30\t30\t18\t"
        f"750\t180.0\t170\t20\t50\t5\t190\t3.50\t1.22\t0.295\t2.5\t9.5\t3.40\t"
        f"95\t3.60\t90\t4.5\t45.5\tFALSE\t"
    )


def _write_tsv(rows: list[str]) -> Path:
    """Write a TSV file and return its path."""
    content = SAMPLE_PITCHER_TSV_HEADER + "\n" + "\n".join(rows) + "\n"
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False)
    f.write(content)
    f.close()
    return Path(f.name)


class TestImportPecotaPitchers:
    """Integration tests for import_pecota_pitchers."""

    def test_creates_player_and_projection(self, sync_engine):
        """New player from PECOTA creates Player + PitcherProjection."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_pitcher_row()])

        import app.scripts.import_pecota_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_pitchers(str(tsv_path))

            with SessionLocal() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 1
                assert players[0].mlb_id == 54321
                assert players[0].primary_position == "P"

                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 1
                assert projections[0].source == "PECOTA-50"
                assert projections[0].w == 12
                assert projections[0].so == 190
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_enriches_existing_player(self, sync_engine):
        """Existing player gets enriched, not duplicated."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

        # Pre-seed player
        with SessionLocal() as session:
            player = Player(
                first_name="Test", last_name="Pitcher",
                scoresheet_id=10, mlb_id=54321,
                primary_position="P", bp_id=None,
            )
            session.add(player)
            session.commit()

        tsv_path = _write_tsv([_make_pitcher_row(bpid="88")])

        import app.scripts.import_pecota_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_pitchers(str(tsv_path))

            with SessionLocal() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 1
                assert players[0].bp_id == 88

                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 1
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_two_way_player_prefers_pitcher(self, sync_engine):
        """For pitcher projections, prefer the pitcher entry."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

        with SessionLocal() as session:
            hitter = Player(
                first_name="Shohei", last_name="Ohtani-H",
                scoresheet_id=1, mlb_id=660271,
                primary_position="DH",
            )
            pitcher = Player(
                first_name="Shohei", last_name="Ohtani-P",
                scoresheet_id=2, mlb_id=660271,
                primary_position="P",
            )
            session.add_all([hitter, pitcher])
            session.commit()
            pitcher_id = pitcher.id

        tsv_path = _write_tsv([_make_pitcher_row(mlbid="660271", first_name="Shohei", last_name="Ohtani")])

        import app.scripts.import_pecota_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_pitchers(str(tsv_path))

            with SessionLocal() as session:
                proj = session.execute(select(PitcherProjection)).scalar_one()
                assert proj.player_id == pitcher_id
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_skips_row_with_no_mlbid(self, sync_engine):
        """Rows without mlbid should be skipped."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_pitcher_row(mlbid="")])

        import app.scripts.import_pecota_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_pitchers(str(tsv_path))

            with SessionLocal() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_upsert_updates_existing_projection(self, sync_engine):
        """Re-import should update, not duplicate, projections."""
        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_pitcher_row()])

        import app.scripts.import_pecota_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SessionLocal

        try:
            import_pecota_pitchers(str(tsv_path))
            import_pecota_pitchers(str(tsv_path))

            with SessionLocal() as session:
                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 1
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()
