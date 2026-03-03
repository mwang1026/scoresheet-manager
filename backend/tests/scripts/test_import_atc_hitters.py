"""Tests for import_atc_hitters script."""

import tempfile
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import HitterProjection, Player
from app.scripts.import_atc_hitters import import_atc_hitters


ATC_TSV_HEADER = (
    "#\tName\tTeam\tG\tPA\tAB\tH\t2B\t3B\tHR\tR\tRBI\tBB\tSO\tHBP\t"
    "SB\tCS\tBB%\tK%\tISO\tBABIP\tAVG\tOBP\tSLG\tOPS\twOBA\twRC+\t"
    "ADP\tVol\tSkew\tDim\tmlb_id"
)


def _make_atc_row(
    name="Test Hitter", team="NYY", mlb_id="12345",
    g="155", pa="685", ab="560", h="160", b2="30", b3="2", hr="48",
    r="120", rbi="115", bb="110", so="175", hbp="8", sb="8", cs="2",
):
    """Build a TSV row string for an ATC hitter."""
    return (
        f"1\t{name}\t{team}\t{g}\t{pa}\t{ab}\t{h}\t{b2}\t{b3}\t{hr}\t"
        f"{r}\t{rbi}\t{bb}\t{so}\t{hbp}\t{sb}\t{cs}\t16.1%\t25.5%\t"
        f".304\t.320\t.286\t.410\t.590\t1.000\t.420\t180\t"
        f"5.5\t1.2\t-0.3\t0.5\t{mlb_id}"
    )


def _write_tsv(rows: list[str]) -> Path:
    """Write a TSV file and return its path."""
    content = ATC_TSV_HEADER + "\n" + "\n".join(rows) + "\n"
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False)
    f.write(content)
    f.close()
    return Path(f.name)


class TestImportAtcHitters:
    """Integration tests for import_atc_hitters."""

    def test_imports_projection_for_existing_player(self, sync_engine):
        """Imports ATC projection for a player that exists in the DB."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)

        # Pre-seed player
        with SL() as session:
            player = Player(
                first_name="Test", last_name="Hitter",
                scoresheet_id=1, mlb_id=12345,
                primary_position="OF",
            )
            session.add(player)
            session.commit()

        tsv_path = _write_tsv([_make_atc_row()])

        import app.scripts.import_atc_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_atc_hitters(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 1
                assert projections[0].source == "ATC"
                assert projections[0].pa == 685
                assert projections[0].hr == 48
                # Singles derived: 160 - 30 - 2 - 48 = 80
                assert projections[0].b1 == 80
                # TB: 80 + 60 + 6 + 192 = 338
                assert projections[0].tb == 338
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_skips_rows_with_no_mlb_id(self, sync_engine):
        """Rows without mlb_id should be skipped."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_atc_row(mlb_id="")])

        import app.scripts.import_atc_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_atc_hitters(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_skips_rows_with_no_matching_player(self, sync_engine):
        """Rows where mlb_id has no matching Player should be skipped."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)
        # No player seeded — mlb_id 99999 doesn't exist
        tsv_path = _write_tsv([_make_atc_row(mlb_id="99999")])

        import app.scripts.import_atc_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_atc_hitters(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_does_not_create_new_players(self, sync_engine):
        """Unlike PECOTA, ATC import should never create Player records."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)
        tsv_path = _write_tsv([_make_atc_row(mlb_id="99999")])

        import app.scripts.import_atc_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_atc_hitters(str(tsv_path))

            with SL() as session:
                players = session.execute(select(Player)).scalars().all()
                assert len(players) == 0
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_upsert_updates_existing_atc_projection(self, sync_engine):
        """Re-import should update, not duplicate, ATC projections."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)

        # Pre-seed player
        with SL() as session:
            player = Player(
                first_name="Test", last_name="Hitter",
                scoresheet_id=1, mlb_id=12345,
                primary_position="OF",
            )
            session.add(player)
            session.commit()

        tsv_path = _write_tsv([_make_atc_row()])

        import app.scripts.import_atc_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            # Import twice
            import_atc_hitters(str(tsv_path))
            import_atc_hitters(str(tsv_path))

            with SL() as session:
                projections = session.execute(select(HitterProjection)).scalars().all()
                assert len(projections) == 1  # Not duplicated
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()

    def test_two_way_player_prefers_non_pitcher(self, sync_engine):
        """For hitter projections, prefer the non-pitcher entry."""
        SL = sessionmaker(sync_engine, expire_on_commit=False)

        # Pre-seed two entries for same mlb_id
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
            hitter_id = hitter.id

        tsv_path = _write_tsv([_make_atc_row(name="Shohei Ohtani", mlb_id="660271")])

        import app.scripts.import_atc_hitters as mod
        orig = mod.SessionLocal
        mod.SessionLocal = SL

        try:
            import_atc_hitters(str(tsv_path))

            with SL() as session:
                proj = session.execute(select(HitterProjection)).scalar_one()
                assert proj.player_id == hitter_id
        finally:
            mod.SessionLocal = orig
            tsv_path.unlink()
