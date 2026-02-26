"""Tests for fetch_mlb_daily_stats script."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models import Player
from app.scripts.fetch_mlb_daily_stats import (
    get_scoresheet_players,
    parse_args,
    save_stats_to_json,
)


class TestSaveStatsToJson:
    """Tests for save_stats_to_json."""

    def test_writes_hitter_and_pitcher_json(self, tmp_path):
        """Verify save_stats_to_json writes correct JSON files."""
        hitter_stats = [{"player_id": 1, "date": "2025-09-01", "h": 2}]
        pitcher_stats = [{"player_id": 2, "date": "2025-09-01", "k": 5}]

        save_stats_to_json(hitter_stats, pitcher_stats, tmp_path)

        hitter_file = tmp_path / "hitter_daily_stats.json"
        pitcher_file = tmp_path / "pitcher_daily_stats.json"

        assert hitter_file.exists()
        assert pitcher_file.exists()

        with open(hitter_file) as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["h"] == 2

        with open(pitcher_file) as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["k"] == 5

    def test_creates_directories(self, tmp_path):
        """Verify save_stats_to_json creates output dirs."""
        nested = tmp_path / "a" / "b" / "c"
        save_stats_to_json([], [], nested)
        assert nested.exists()

    def test_empty_stats(self, tmp_path):
        """Empty stats produce empty JSON arrays."""
        save_stats_to_json([], [], tmp_path)

        with open(tmp_path / "hitter_daily_stats.json") as f:
            assert json.load(f) == []
        with open(tmp_path / "pitcher_daily_stats.json") as f:
            assert json.load(f) == []


class TestGetScoresheetPlayers:
    """Tests for get_scoresheet_players."""

    def test_returns_scoresheet_players_with_mlb_ids(self, sync_engine):
        """Verify only Scoresheet players with mlb_id are returned."""
        from sqlalchemy.orm import sessionmaker

        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

        # Seed players
        with SessionLocal() as session:
            # Scoresheet player with mlb_id — should be returned
            p1 = Player(
                first_name="Test", last_name="Player",
                scoresheet_id=1, mlb_id=12345,
                primary_position="SS",
            )
            # Scoresheet player without mlb_id — should be excluded
            p2 = Player(
                first_name="No", last_name="MLB",
                scoresheet_id=2, mlb_id=None,
                primary_position="OF",
            )
            # PECOTA-only player (no scoresheet_id) — should be excluded
            p3 = Player(
                first_name="PECOTA", last_name="Only",
                scoresheet_id=None, mlb_id=99999,
                primary_position="P",
            )
            session.add_all([p1, p2, p3])
            session.commit()

        with patch("app.scripts.fetch_mlb_daily_stats.SessionLocal", SessionLocal):
            players = get_scoresheet_players()

        assert len(players) == 1
        assert players[0]["mlb_id"] == 12345
        assert players[0]["name"] == "Test Player"
        assert players[0]["position"] == "SS"

    def test_output_format(self, sync_engine):
        """Verify each player dict has the expected keys."""
        from sqlalchemy.orm import sessionmaker

        SessionLocal = sessionmaker(sync_engine, expire_on_commit=False)

        with SessionLocal() as session:
            p = Player(
                first_name="Aaron", last_name="Judge",
                scoresheet_id=10, mlb_id=592450,
                primary_position="OF",
            )
            session.add(p)
            session.commit()

        with patch("app.scripts.fetch_mlb_daily_stats.SessionLocal", SessionLocal):
            players = get_scoresheet_players()

        assert len(players) == 1
        assert set(players[0].keys()) == {"id", "mlb_id", "position", "name"}


class TestParseArgs:
    """Tests for parse_args."""

    def test_defaults(self):
        with patch("sys.argv", ["fetch_mlb_daily_stats"]):
            args = parse_args()
        assert args.start == "09/01/2025"
        assert args.end == "09/28/2025"
        assert args.season == 2025
