"""Tests for the player_import service (shared upsert logic)."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.models import Player, PlayerPosition
from app.services.player_import import (
    REQUIRED_TSV_COLUMNS,
    UpsertResult,
    strip_draft_suffix,
    upsert_player_and_positions,
    validate_tsv_columns,
)

SAMPLE_ROW = {
    "SSBB": "10",
    "MLBAM": "676979",
    "NL": "1001",
    "pos": "SS",
    "h": "R",
    "age": "27",
    "team": "Bos",
    "firstName": "Test",
    "lastName": "Player",
    "1B": "",
    "2B": "3.50",
    "3B": "",
    "SS": "4.73",
    "OF": "",
    "osbAL": "",
    "ocsAL": "",
    "osbNL": "",
    "ocsNL": "",
    "BAvR": "5",
    "OBvR": "10",
    "SLvR": "15",
    "BAvL": "-3",
    "OBvL": "-8",
    "SLvL": "-20",
}


def test_upsert_player_and_positions(sync_engine):
    """Creates Player + positions from a valid TSV row."""
    Session = sessionmaker(sync_engine, expire_on_commit=False)
    with Session() as session:
        result = upsert_player_and_positions(session, SAMPLE_ROW)
        session.commit()

        assert isinstance(result, UpsertResult)
        assert result.scoresheet_id == 10
        assert result.mlb_id == 676979
        assert result.first_name == "Test"
        assert result.last_name == "Player"
        assert result.positions_count == 2

        player = session.execute(
            select(Player).where(Player.scoresheet_id == 10)
        ).scalar_one()
        assert player.primary_position == "SS"
        assert player.ba_vr == 5
        assert player.ob_vl == -8

        positions = session.execute(
            select(PlayerPosition).where(PlayerPosition.player_id == player.id)
        ).scalars().all()
        assert len(positions) == 2
        pos_map = {p.position: float(p.rating) for p in positions}
        assert pos_map["2B"] == 3.50
        assert pos_map["SS"] == 4.73


def test_upsert_player_and_positions_update(sync_engine):
    """Second call with same scoresheet_id updates fields."""
    Session = sessionmaker(sync_engine, expire_on_commit=False)

    with Session() as session:
        upsert_player_and_positions(session, SAMPLE_ROW)
        session.commit()

        updated_row = {**SAMPLE_ROW, "team": "NYY", "age": "28", "SS": "5.00"}
        result = upsert_player_and_positions(session, updated_row)
        session.commit()

        assert result.scoresheet_id == 10

        player = session.execute(
            select(Player).where(Player.scoresheet_id == 10)
        ).scalar_one()
        assert player.current_mlb_team == "NYY"
        assert player.age == 28

        ss_pos = session.execute(
            select(PlayerPosition).where(
                PlayerPosition.player_id == player.id,
                PlayerPosition.position == "SS",
            )
        ).scalar_one()
        assert float(ss_pos.rating) == 5.00


def test_validate_tsv_columns_valid():
    """No exception for complete column set."""
    fieldnames = list(REQUIRED_TSV_COLUMNS) + ["extra_col"]
    validate_tsv_columns(fieldnames)  # should not raise


def test_validate_tsv_columns_missing():
    """ValueError listing missing columns."""
    fieldnames = ["SSBB", "MLBAM"]
    with pytest.raises(ValueError, match="missing required columns"):
        validate_tsv_columns(fieldnames)


def test_validate_tsv_columns_none():
    """ValueError for None header."""
    with pytest.raises(ValueError, match="no header row"):
        validate_tsv_columns(None)


class TestStripDraftSuffix:
    """Tests for strip_draft_suffix utility."""

    def test_strips_draft_round_suffix(self):
        assert strip_draft_suffix("Ike(round/1/2025/MLB/draft)") == "Ike"

    def test_strips_suffix_with_space(self):
        assert strip_draft_suffix("Ike (round/1/2025/MLB/draft)") == "Ike"

    def test_strips_multi_digit_round(self):
        assert strip_draft_suffix("Jane(round/15/2024/MLB/draft)") == "Jane"

    def test_no_suffix_unchanged(self):
        assert strip_draft_suffix("Jane") == "Jane"

    def test_empty_string(self):
        assert strip_draft_suffix("") == ""
