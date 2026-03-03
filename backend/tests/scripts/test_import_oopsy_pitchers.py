"""Tests for import_oopsy_pitchers script."""

import tempfile
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import PitcherProjection, Player
from app.scripts.import_oopsy_pitchers import import_oopsy_pitchers


# Same column layout as ATC (FanGraphs format)
OOPSY_PITCHER_TSV_HEADER = (
    "#\tName\tTeam\tGS\tG\tIP\tW\tL\tQS\tSV\tHLD\t"
    "H\tER\tHR\tSO\tBB\tK/9\tBB/9\tK/BB\tHR/9\tAVG\t"
    "WHIP\tBABIP\tLOB%\tERA\tFIP\tADP\tmlb_id"
)


def _make_oopsy_pitcher_row(
    name="Test Pitcher", team="NYY", mlb_id="12345",
    gs="29", g="29", ip="188.1", w="14", l="7", qs="18",
    sv="0", hld="0", h="144", er="57", hr="18", so="228", bb="38",
):
    """Build a TSV row string for an OOPSY pitcher."""
    return (
        f"1\t{name}\t{team}\t{gs}\t{g}\t{ip}\t{w}\t{l}\t{qs}\t{sv}\t{hld}\t"
        f"{h}\t{er}\t{hr}\t{so}\t{bb}\t10.91\t1.83\t5.95\t0.88\t.208\t"
        f"0.97\t.282\t76.9%\t2.72\t2.69\t6.8\t{mlb_id}"
    )


def _write_tsv(rows: list[str]) -> Path:
    """Write a TSV file and return its path."""
    content = OOPSY_PITCHER_TSV_HEADER + "\n" + "\n".join(rows) + "\n"
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False)
    f.write(content)
    f.close()
    return Path(f.name)


class TestImportOOPSYPitchers:
    """Integration tests for import_oopsy_pitchers."""

    def test_imports_projection_with_oopsy_source(self, sync_engine):
        """Imports OOPSY projection with source='OOPSY'."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)

        with SL() as session:
            player = Player(
                first_name="Test", last_name="Pitcher",
                scoresheet_id=1, mlb_id=12345,
                primary_position="P",
            )
            session.add(player)
            session.commit()

        tsv_path = _write_tsv([_make_oopsy_pitcher_row()])

        import app.scripts.import_oopsy_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_oopsy_pitchers(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 1
                assert projections[0].source == "OOPSY"
                assert projections[0].w == 14
                assert projections[0].so == 228
                assert projections[0].ip_outs == 564  # round(188.1 * 3)
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_skips_rows_with_no_mlb_id(self, sync_engine):
        """Rows without mlb_id should be skipped."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_oopsy_pitcher_row(mlb_id="")])

        import app.scripts.import_oopsy_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_oopsy_pitchers(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_skips_rows_with_no_matching_player(self, sync_engine):
        """Rows where mlb_id has no matching Player should be skipped."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_oopsy_pitcher_row(mlb_id="99999")])

        import app.scripts.import_oopsy_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_oopsy_pitchers(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_upsert_updates_existing_oopsy_projection(self, sync_engine):
        """Re-import should update, not duplicate, OOPSY projections."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)

        with SL() as session:
            player = Player(
                first_name="Test", last_name="Pitcher",
                scoresheet_id=1, mlb_id=12345,
                primary_position="P",
            )
            session.add(player)
            session.commit()

        tsv_path = _write_tsv([_make_oopsy_pitcher_row()])

        import app.scripts.import_oopsy_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_oopsy_pitchers(str(tsv_path))
            import_oopsy_pitchers(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(PitcherProjection)).scalars().all()
                assert len(projections) == 1  # Not duplicated
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_two_way_player_prefers_pitcher(self, sync_engine):
        """For pitcher projections, prefer the pitcher entry."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)

        with SL() as session:
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
            pitcher_id = pitcher.id

        tsv_path = _write_tsv([_make_oopsy_pitcher_row(name="Shohei Ohtani", mlb_id="660271")])

        import app.scripts.import_oopsy_pitchers as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_oopsy_pitchers(str(tsv_path))

            with SL() as session:
                proj = session.execute(select(PitcherProjection)).scalar_one()
                assert proj.player_id == pitcher_id
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()
