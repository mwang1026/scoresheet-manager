"""
Tests for fetch_mlb_boxscores script.

Tests player ID lookup, stub creation, date handling, and JSON output.
Uses test database for lookup/stub tests.
"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models import Player
from app.scripts.fetch_mlb_boxscores import (
    build_mlb_id_lookup,
    create_stub_players,
    get_date_range,
    parse_args,
    resolve_unknown_stats,
    save_stats_to_json,
)


# ---------------------------------------------------------------------------
# build_mlb_id_lookup
# ---------------------------------------------------------------------------


class TestBuildMlbIdLookup:
    """Tests for build_mlb_id_lookup."""

    def test_regular_hitter(self, sync_engine):
        """Test hitter gets 'hitter' key in lookup."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            p = Player(
                first_name="Aaron",
                last_name="Judge",
                scoresheet_id=1,
                mlb_id=592450,
                primary_position="OF",
            )
            session.add(p)
            session.commit()
            player_id = p.id

        with Session() as session:
            lookup = build_mlb_id_lookup(session)

        assert 592450 in lookup
        assert lookup[592450] == {"hitter": player_id}

    def test_regular_pitcher(self, sync_engine):
        """Test pitcher gets 'pitcher' key in lookup."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            p = Player(
                first_name="Gerrit",
                last_name="Cole",
                scoresheet_id=2,
                mlb_id=543037,
                primary_position="P",
            )
            session.add(p)
            session.commit()
            player_id = p.id

        with Session() as session:
            lookup = build_mlb_id_lookup(session)

        assert 543037 in lookup
        assert lookup[543037] == {"pitcher": player_id}

    def test_two_way_player(self, sync_engine):
        """Test two-way player (same mlb_id, different positions) gets both entries."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            p_h = Player(
                first_name="Shohei",
                last_name="Ohtani",
                scoresheet_id=100,
                mlb_id=660271,
                primary_position="DH",
            )
            p_p = Player(
                first_name="Shohei",
                last_name="Ohtani",
                scoresheet_id=101,
                mlb_id=660271,
                primary_position="P",
            )
            session.add_all([p_h, p_p])
            session.commit()
            hitter_id = p_h.id
            pitcher_id = p_p.id

        with Session() as session:
            lookup = build_mlb_id_lookup(session)

        assert 660271 in lookup
        assert lookup[660271]["hitter"] == hitter_id
        assert lookup[660271]["pitcher"] == pitcher_id

    def test_includes_pecota_only_players(self, sync_engine):
        """Test PECOTA-only players (no scoresheet_id) are included."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            p = Player(
                first_name="PECOTA",
                last_name="Only",
                scoresheet_id=None,
                mlb_id=777777,
                primary_position="3B",
            )
            session.add(p)
            session.commit()
            player_id = p.id

        with Session() as session:
            lookup = build_mlb_id_lookup(session)

        assert 777777 in lookup
        assert lookup[777777] == {"hitter": player_id}

    def test_skips_null_mlb_id(self, sync_engine):
        """Test players without mlb_id are excluded from lookup."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            p = Player(
                first_name="No",
                last_name="MLB",
                scoresheet_id=50,
                mlb_id=None,
                primary_position="1B",
            )
            session.add(p)
            session.commit()

        with Session() as session:
            lookup = build_mlb_id_lookup(session)

        assert len(lookup) == 0

    def test_sr_position_is_pitcher(self, sync_engine):
        """Test SR (setup/relief) position is classified as pitcher."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            p = Player(
                first_name="Setup",
                last_name="Man",
                scoresheet_id=200,
                mlb_id=111111,
                primary_position="SR",
            )
            session.add(p)
            session.commit()
            player_id = p.id

        with Session() as session:
            lookup = build_mlb_id_lookup(session)

        assert lookup[111111] == {"pitcher": player_id}


# ---------------------------------------------------------------------------
# create_stub_players
# ---------------------------------------------------------------------------


class TestCreateStubPlayers:
    """Tests for create_stub_players."""

    def test_creates_player_with_correct_fields(self, sync_engine):
        """Test stub creation with correct minimal fields."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        unknown_info = {
            888888: {
                "first_name": "Mystery",
                "last_name": "Player",
                "position": "LF",
            }
        }

        with Session() as session:
            new_ids = create_stub_players(unknown_info, session)

        assert 888888 in new_ids

        with Session() as session:
            player = session.execute(
                select(Player).where(Player.mlb_id == 888888)
            ).scalar_one()
            assert player.first_name == "Mystery"
            assert player.last_name == "Player"
            assert player.primary_position == "LF"
            assert player.scoresheet_id is None
            assert player.mlb_id == 888888

    def test_name_with_suffix(self, sync_engine):
        """Test name preserves suffixes like 'Jr.'."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        unknown_info = {
            222: {
                "first_name": "Ronald",
                "last_name": "Acuna Jr.",
                "position": "CF",
            }
        }

        with Session() as session:
            create_stub_players(unknown_info, session)

        with Session() as session:
            player = session.execute(
                select(Player).where(Player.mlb_id == 222)
            ).scalar_one()
            assert player.first_name == "Ronald"
            assert player.last_name == "Acuna Jr."

    def test_empty_info_returns_empty(self, sync_engine):
        """Test empty unknown_info returns empty dict."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        with Session() as session:
            result = create_stub_players({}, session)
        assert result == {}

    def test_default_position_when_empty(self, sync_engine):
        """Test empty position defaults to DH."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        unknown_info = {
            333: {"first_name": "No", "last_name": "Position", "position": ""}
        }

        with Session() as session:
            create_stub_players(unknown_info, session)

        with Session() as session:
            player = session.execute(
                select(Player).where(Player.mlb_id == 333)
            ).scalar_one()
            assert player.primary_position == "DH"

    def test_returns_new_player_ids(self, sync_engine):
        """Test that returned IDs are valid database player IDs."""
        from sqlalchemy.orm import sessionmaker

        Session = sessionmaker(sync_engine, expire_on_commit=False)

        unknown_info = {
            444: {"first_name": "Test", "last_name": "A", "position": "1B"},
            555: {"first_name": "Test", "last_name": "B", "position": "SS"},
        }

        with Session() as session:
            new_ids = create_stub_players(unknown_info, session)

        assert len(new_ids) == 2
        assert 444 in new_ids
        assert 555 in new_ids

        # Verify IDs point to real players
        with Session() as session:
            for mlb_id, player_id in new_ids.items():
                player = session.get(Player, player_id)
                assert player is not None
                assert player.mlb_id == mlb_id


# ---------------------------------------------------------------------------
# resolve_unknown_stats
# ---------------------------------------------------------------------------


class TestResolveUnknownStats:
    """Tests for resolve_unknown_stats."""

    def test_replaces_mlb_id_with_player_id(self):
        """Test _mlb_id is replaced with player_id from mapping."""
        stats = [{"_mlb_id": 999, "date": "2025-09-15", "h": 2}]

        result = resolve_unknown_stats(stats, {999: 42})

        assert len(result) == 1
        assert result[0]["player_id"] == 42
        assert "_mlb_id" not in result[0]

    def test_keeps_known_player_stats(self):
        """Test stats with player_id pass through unchanged."""
        stats = [{"player_id": 1, "date": "2025-09-15", "h": 3}]

        result = resolve_unknown_stats(stats, {})

        assert len(result) == 1
        assert result[0]["player_id"] == 1

    def test_drops_unresolvable_stats(self, caplog):
        """Test stats that cannot be resolved are dropped with warning."""
        stats = [{"_mlb_id": 999, "date": "2025-09-15", "h": 2}]

        result = resolve_unknown_stats(stats, {})  # No mapping for 999

        assert len(result) == 0
        assert "Could not resolve player_id for mlb_id 999" in caplog.text

    def test_mixed_known_and_unknown(self):
        """Test mix of known and unknown stats are handled correctly."""
        stats = [
            {"player_id": 1, "date": "2025-09-15", "h": 3},
            {"_mlb_id": 999, "date": "2025-09-15", "h": 2},
            {"player_id": 2, "date": "2025-09-15", "h": 1},
        ]

        result = resolve_unknown_stats(stats, {999: 42})

        assert len(result) == 3
        player_ids = [r["player_id"] for r in result]
        assert player_ids == [1, 42, 2]


# ---------------------------------------------------------------------------
# save_stats_to_json
# ---------------------------------------------------------------------------


class TestSaveStatsToJson:
    """Tests for save_stats_to_json."""

    def test_writes_hitter_and_pitcher_json(self, tmp_path):
        """Verify save_stats_to_json writes correct JSON files."""
        hitter_stats = [{"player_id": 1, "date": "2025-09-01", "h": 2}]
        pitcher_stats = [{"player_id": 2, "date": "2025-09-01", "k": 5}]

        save_stats_to_json(hitter_stats, pitcher_stats, tmp_path)

        with open(tmp_path / "hitter_daily_stats.json") as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["h"] == 2

        with open(tmp_path / "pitcher_daily_stats.json") as f:
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


# ---------------------------------------------------------------------------
# CLI args
# ---------------------------------------------------------------------------


class TestParseArgs:
    """Tests for parse_args."""

    def test_defaults(self):
        """Test all args default to None (yesterday is resolved later)."""
        with patch("sys.argv", ["fetch_mlb_boxscores"]):
            args = parse_args()
        assert args.date is None
        assert args.start is None
        assert args.end is None

    def test_single_date(self):
        """Test --date flag is parsed correctly."""
        with patch("sys.argv", ["fetch_mlb_boxscores", "--date", "09/15/2025"]):
            args = parse_args()
        assert args.date == "09/15/2025"

    def test_date_range(self):
        """Test --start and --end flags are parsed correctly."""
        with patch(
            "sys.argv",
            ["fetch_mlb_boxscores", "--start", "04/01/2026", "--end", "04/30/2026"],
        ):
            args = parse_args()
        assert args.start == "04/01/2026"
        assert args.end == "04/30/2026"


# ---------------------------------------------------------------------------
# get_date_range
# ---------------------------------------------------------------------------


class TestGetDateRange:
    """Tests for get_date_range."""

    def test_single_date(self):
        """Test single --date resolves to one YYYY-MM-DD entry."""
        args = type("Args", (), {"date": "09/15/2025", "start": None, "end": None})()
        dates = get_date_range(args)
        assert dates == ["2025-09-15"]

    def test_date_range(self):
        """Test --start/--end resolves to inclusive date range."""
        args = type(
            "Args", (), {"date": None, "start": "09/13/2025", "end": "09/15/2025"}
        )()
        dates = get_date_range(args)
        assert dates == ["2025-09-13", "2025-09-14", "2025-09-15"]

    def test_default_yesterday(self):
        """Test no args defaults to yesterday."""
        args = type("Args", (), {"date": None, "start": None, "end": None})()
        dates = get_date_range(args)
        expected = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        assert dates == [expected]

    def test_same_start_end(self):
        """Test --start == --end resolves to single date."""
        args = type(
            "Args", (), {"date": None, "start": "04/15/2026", "end": "04/15/2026"}
        )()
        dates = get_date_range(args)
        assert dates == ["2026-04-15"]
