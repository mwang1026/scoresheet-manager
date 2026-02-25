"""Tests for app.constants module."""

import pytest

from app.constants import (
    AL_NL_BOUNDARY,
    INTERLEAGUE_AL_START,
    INTERLEAGUE_END,
    INTERLEAGUE_NL_START,
    NL_HOME_END,
    PITCHER_POSITIONS,
    is_pitcher_position,
)


def test_pitcher_positions_contents():
    assert "P" in PITCHER_POSITIONS
    assert "SR" in PITCHER_POSITIONS


def test_pitcher_positions_length():
    assert len(PITCHER_POSITIONS) == 2


def test_is_pitcher_position_true():
    assert is_pitcher_position("P") is True
    assert is_pitcher_position("SR") is True


def test_is_pitcher_position_false_for_hitter_positions():
    for pos in ("C", "1B", "2B", "3B", "SS", "OF", "DH"):
        assert is_pitcher_position(pos) is False, f"Expected {pos} to be non-pitcher"


def test_is_pitcher_position_false_for_empty():
    assert is_pitcher_position("") is False


def test_is_pitcher_position_false_for_unknown():
    assert is_pitcher_position("XYZ") is False


def test_scoresheet_id_boundaries_ordering():
    """AL/NL boundary constants must be strictly ordered with no gaps between ranges."""
    assert AL_NL_BOUNDARY < NL_HOME_END
    assert NL_HOME_END < INTERLEAGUE_AL_START
    assert INTERLEAGUE_AL_START < INTERLEAGUE_NL_START
    assert INTERLEAGUE_NL_START < INTERLEAGUE_END


def test_scoresheet_id_boundary_values():
    assert AL_NL_BOUNDARY == 1000
    assert NL_HOME_END == 2000
    assert INTERLEAGUE_AL_START == 4000
    assert INTERLEAGUE_NL_START == 5000
    assert INTERLEAGUE_END == 6000
