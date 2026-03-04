"""Tests for app.services.projection_import helpers."""

import logging
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services.projection_import import (
    batch_upsert_projections,
    enrich_player_from_pecota,
    ip_to_outs,
    parse_date,
    parse_float,
    parse_int,
)


# ---------------------------------------------------------------------------
# parse_int
# ---------------------------------------------------------------------------


def test_parse_int_valid():
    assert parse_int("42") == 42


def test_parse_int_empty():
    assert parse_int("") is None


def test_parse_int_whitespace():
    assert parse_int("  ") is None


def test_parse_int_invalid():
    assert parse_int("abc") is None


# ---------------------------------------------------------------------------
# parse_float
# ---------------------------------------------------------------------------


def test_parse_float_valid():
    assert parse_float("3.14") == pytest.approx(3.14)


def test_parse_float_empty():
    assert parse_float("") is None


def test_parse_float_invalid():
    assert parse_float("xyz") is None


# ---------------------------------------------------------------------------
# parse_date
# ---------------------------------------------------------------------------


def test_parse_date_valid():
    assert parse_date("1995-04-15") == date(1995, 4, 15)


def test_parse_date_empty():
    assert parse_date("") is None


def test_parse_date_invalid_format():
    assert parse_date("15/04/1995") is None


# ---------------------------------------------------------------------------
# ip_to_outs
# ---------------------------------------------------------------------------


def test_ip_to_outs_whole_innings():
    assert ip_to_outs("6.0") == 18


def test_ip_to_outs_fractional():
    # "192.3" means 192 innings + 1 out = 577 outs
    # float("192.3") * 3 = 576.9 → round = 577
    assert ip_to_outs("192.3") == 577


def test_ip_to_outs_empty():
    assert ip_to_outs("") == 0


def test_ip_to_outs_invalid():
    assert ip_to_outs("abc") == 0


# ---------------------------------------------------------------------------
# enrich_player_from_pecota
# ---------------------------------------------------------------------------


def _make_player(**kwargs):
    """Create a SimpleNamespace player with all enrichable fields defaulting to None."""
    defaults = dict(bp_id=None, birthday=None, throws=None, height=None, weight=None)
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_enrich_all_fields_missing_row_has_values():
    player = _make_player()
    row = {
        "bpid": "12345",
        "birthday": "1990-06-15",
        "throws": "R",
        "height": "72",
        "weight": "195",
    }
    result = enrich_player_from_pecota(player, row)
    assert result is True
    assert player.bp_id == 12345
    assert player.birthday == date(1990, 6, 15)
    assert player.throws == "R"
    assert player.height == 72
    assert player.weight == 195


def test_enrich_all_fields_present_returns_false():
    player = _make_player(
        bp_id=99,
        birthday=date(1990, 1, 1),
        throws="L",
        height=70,
        weight=180,
    )
    row = {
        "bpid": "999",
        "birthday": "2000-01-01",
        "throws": "R",
        "height": "75",
        "weight": "220",
    }
    result = enrich_player_from_pecota(player, row)
    assert result is False
    # Nothing should have changed
    assert player.bp_id == 99
    assert player.birthday == date(1990, 1, 1)
    assert player.throws == "L"
    assert player.height == 70
    assert player.weight == 180


def test_enrich_partial_only_fills_missing():
    player = _make_player(throws="L", height=70)
    row = {
        "bpid": "42",
        "birthday": "1985-03-22",
        "throws": "R",  # should NOT overwrite
        "height": "75",  # should NOT overwrite
        "weight": "200",
    }
    result = enrich_player_from_pecota(player, row)
    assert result is True
    assert player.bp_id == 42
    assert player.birthday == date(1985, 3, 22)
    assert player.throws == "L"  # unchanged
    assert player.height == 70  # unchanged
    assert player.weight == 200


def test_enrich_empty_row_values_returns_false():
    player = _make_player()
    row = {"bpid": "", "birthday": "", "throws": "", "height": "", "weight": ""}
    result = enrich_player_from_pecota(player, row)
    assert result is False
    assert player.bp_id is None
    assert player.birthday is None
    assert player.throws is None
    assert player.height is None
    assert player.weight is None


def test_enrich_missing_row_keys_returns_false():
    player = _make_player()
    row = {}
    result = enrich_player_from_pecota(player, row)
    assert result is False


# ---------------------------------------------------------------------------
# batch_upsert_projections — deduplication
# ---------------------------------------------------------------------------


def _proj(player_id: int, source: str, hr: int = 0) -> dict:
    """Minimal projection dict for testing deduplication."""
    return {"player_id": player_id, "source": source, "hr": hr}


@patch("app.services.projection_import.insert")
def test_batch_upsert_deduplicates_keeping_last(mock_insert):
    """When two rows share (player_id, source), only the last one is kept."""
    db = MagicMock()
    model = MagicMock()
    model.__tablename__ = "test"

    projections = [
        _proj(1, "ATC", hr=10),
        _proj(1, "ATC", hr=20),  # duplicate — should win
    ]

    mock_stmt = MagicMock()
    mock_insert.return_value = mock_stmt
    mock_stmt.on_conflict_do_update.return_value = mock_stmt

    result = batch_upsert_projections(db, model, projections)

    # Should have passed only 1 row to insert()
    call_values = mock_stmt.values.call_args[0][0]
    assert len(call_values) == 1
    assert call_values[0]["hr"] == 20
    assert result == 1


@patch("app.services.projection_import.insert")
def test_batch_upsert_no_dupes_passes_all_rows(mock_insert):
    """When no duplicates exist, all rows pass through unchanged."""
    db = MagicMock()
    model = MagicMock()
    model.__tablename__ = "test"

    projections = [
        _proj(1, "ATC", hr=10),
        _proj(2, "ATC", hr=20),
        _proj(1, "PECOTA-50", hr=30),
    ]

    mock_stmt = MagicMock()
    mock_insert.return_value = mock_stmt
    mock_stmt.on_conflict_do_update.return_value = mock_stmt

    result = batch_upsert_projections(db, model, projections)

    call_values = mock_stmt.values.call_args[0][0]
    assert len(call_values) == 3
    assert result == 3


@patch("app.services.projection_import.insert")
def test_batch_upsert_dedup_logs_warning(mock_insert, caplog):
    """Deduplication emits a warning log with the count of dropped rows."""
    db = MagicMock()
    model = MagicMock()
    model.__tablename__ = "test"

    projections = [
        _proj(1, "ATC", hr=10),
        _proj(1, "ATC", hr=20),
        _proj(1, "ATC", hr=30),  # third occurrence — 2 dupes total
    ]

    mock_stmt = MagicMock()
    mock_insert.return_value = mock_stmt
    mock_stmt.on_conflict_do_update.return_value = mock_stmt

    with caplog.at_level(logging.WARNING, logger="app.services.projection_import"):
        batch_upsert_projections(db, model, projections)

    assert any("Deduplicated 2 rows" in msg for msg in caplog.messages)


def test_batch_upsert_empty_returns_zero():
    """Empty list returns 0 without touching the database."""
    db = MagicMock()
    model = MagicMock()
    assert batch_upsert_projections(db, model, []) == 0
    db.execute.assert_not_called()
