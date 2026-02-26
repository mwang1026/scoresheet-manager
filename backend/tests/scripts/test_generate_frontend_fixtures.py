"""Tests for generate_frontend_fixtures script."""

import json
from pathlib import Path

import pytest

from app.scripts.generate_frontend_fixtures import (
    remap_player_ids,
    save_fixtures,
)


class TestRemapPlayerIds:
    """Tests for remap_player_ids."""

    def test_correct_remapping(self):
        stats = [
            {"player_id": 100, "date": "2025-09-01", "h": 2},
            {"player_id": 200, "date": "2025-09-01", "h": 3},
        ]
        mapping = {100: 1, 200: 2}

        result = remap_player_ids(stats, mapping)

        assert result[0]["player_id"] == 1
        assert result[1]["player_id"] == 2

    def test_preserves_other_fields(self):
        stats = [{"player_id": 100, "date": "2025-09-01", "h": 2, "hr": 1}]
        mapping = {100: 1}

        result = remap_player_ids(stats, mapping)

        assert result[0]["date"] == "2025-09-01"
        assert result[0]["h"] == 2
        assert result[0]["hr"] == 1

    def test_missing_id_logs_warning(self, caplog):
        """Player IDs not in mapping should log a warning."""
        stats = [{"player_id": 999, "date": "2025-09-01", "h": 0}]
        mapping = {100: 1}

        import logging
        with caplog.at_level(logging.WARNING, logger="app.scripts.generate_frontend_fixtures"):
            result = remap_player_ids(stats, mapping)

        assert "999" in caplog.text
        # player_id should remain unmapped
        assert result[0]["player_id"] == 999

    def test_empty_stats(self):
        result = remap_player_ids([], {100: 1})
        assert result == []


class TestSaveFixtures:
    """Tests for save_fixtures."""

    def test_writes_three_json_files(self, tmp_path, monkeypatch):
        """Verify save_fixtures writes players.json, hitter-stats.json, pitcher-stats.json."""
        monkeypatch.setattr(
            "app.scripts.generate_frontend_fixtures.FRONTEND_FIXTURES_DIR", tmp_path
        )

        players = [
            {"id": 1, "name": "Test Player", "_db_id": 100},
            {"id": 2, "name": "Another Player", "_db_id": 200},
        ]
        hitter_stats = [{"player_id": 1, "h": 2}]
        pitcher_stats = [{"player_id": 2, "k": 5}]

        save_fixtures(players, hitter_stats, pitcher_stats)

        # Verify all three files exist
        assert (tmp_path / "players.json").exists()
        assert (tmp_path / "hitter-stats.json").exists()
        assert (tmp_path / "pitcher-stats.json").exists()

    def test_strips_db_id_from_players(self, tmp_path, monkeypatch):
        """Players output should not contain _db_id."""
        monkeypatch.setattr(
            "app.scripts.generate_frontend_fixtures.FRONTEND_FIXTURES_DIR", tmp_path
        )

        players = [{"id": 1, "name": "Test", "_db_id": 100}]
        save_fixtures(players, [], [])

        with open(tmp_path / "players.json") as f:
            data = json.load(f)

        assert len(data) == 1
        assert "_db_id" not in data[0]
        assert data[0]["id"] == 1
        assert data[0]["name"] == "Test"

    def test_stats_content_correct(self, tmp_path, monkeypatch):
        """Verify stats file content matches input."""
        monkeypatch.setattr(
            "app.scripts.generate_frontend_fixtures.FRONTEND_FIXTURES_DIR", tmp_path
        )

        hitter_stats = [{"player_id": 1, "H": 3, "HR": 1}]
        pitcher_stats = [{"player_id": 2, "K": 10, "W": 1}]

        save_fixtures([], hitter_stats, pitcher_stats)

        with open(tmp_path / "hitter-stats.json") as f:
            assert json.load(f) == hitter_stats

        with open(tmp_path / "pitcher-stats.json") as f:
            assert json.load(f) == pitcher_stats
