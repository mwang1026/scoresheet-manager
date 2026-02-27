"""
Integration tests for seed_daily_stats script.

Tests database seeding and upsert behavior.
Uses test database fixtures.
"""

from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HitterDailyStats, PitcherDailyStats
from app.scripts.seed_daily_stats import (
    convert_date_strings,
    seed_hitter_stats,
    seed_pitcher_stats,
)


@pytest.fixture
def sync_session(sync_engine):
    """Create a sync session for testing seed functions."""
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(bind=sync_engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def sample_hitter_stats():
    """Sample hitter stats for testing."""
    return [
        {
            "player_id": 1,
            "date": "2025-09-15",
            "g": 1,
            "pa": 5,
            "ab": 4,
            "h": 3,
            "single": 1,
            "double": 1,
            "triple": 0,
            "hr": 1,
            "tb": 6,
            "r": 2,
            "rbi": 3,
            "so": 1,
            "go": 0,
            "fo": 1,
            "ao": 1,
            "gdp": 0,
            "bb": 1,
            "ibb": 0,
            "hbp": 0,
            "sb": 1,
            "cs": 0,
            "sf": 0,
            "sh": 0,
            "lob": 2,
        },
        {
            "player_id": 2,
            "date": "2025-09-16",
            "g": 1,
            "pa": 4,
            "ab": 3,
            "h": 1,
            "single": 1,
            "double": 0,
            "triple": 0,
            "hr": 0,
            "tb": 1,
            "r": 0,
            "rbi": 0,
            "so": 2,
            "go": 1,
            "fo": 0,
            "ao": 0,
            "gdp": 0,
            "bb": 1,
            "ibb": 0,
            "hbp": 0,
            "sb": 0,
            "cs": 0,
            "sf": 0,
            "sh": 0,
            "lob": 1,
        },
    ]


@pytest.fixture
def sample_pitcher_stats():
    """Sample pitcher stats for testing."""
    return [
        {
            "player_id": 10,
            "date": "2025-09-12",
            "g": 1,
            "gs": 1,
            "gf": 0,
            "cg": 0,
            "sho": 0,
            "sv": 0,
            "svo": 0,
            "bs": 0,
            "hld": 0,
            "ip_outs": 21,
            "w": 1,
            "l": 0,
            "er": 2,
            "r": 2,
            "bf": 28,
            "ab": 25,
            "h": 5,
            "double": 1,
            "triple": 0,
            "hr": 1,
            "tb": 8,
            "bb": 2,
            "ibb": 0,
            "hbp": 1,
            "k": 8,
            "go": 7,
            "fo": 5,
            "ao": 5,
            "sb": 1,
            "cs": 0,
            "sf": 0,
            "sh": 0,
            "wp": 1,
            "bk": 0,
            "pk": 0,
            "ir": 0,
            "irs": 0,
            "pitches": 105,
            "strikes": 70,
        },
        {
            "player_id": 11,
            "date": "2025-09-18",
            "g": 1,
            "gs": 0,
            "gf": 1,
            "cg": 0,
            "sho": 0,
            "sv": 1,
            "svo": 1,
            "bs": 0,
            "hld": 0,
            "ip_outs": 3,
            "w": 0,
            "l": 0,
            "er": 0,
            "r": 0,
            "bf": 3,
            "ab": 3,
            "h": 0,
            "double": 0,
            "triple": 0,
            "hr": 0,
            "tb": 0,
            "bb": 0,
            "ibb": 0,
            "hbp": 0,
            "k": 2,
            "go": 1,
            "fo": 0,
            "ao": 0,
            "sb": 0,
            "cs": 0,
            "sf": 0,
            "sh": 0,
            "wp": 0,
            "bk": 0,
            "pk": 0,
            "ir": 2,
            "irs": 0,
            "pitches": 12,
            "strikes": 9,
        },
    ]


class TestDateConversion:
    """Tests for date string conversion."""

    def test_convert_date_strings(self):
        """Test converting date strings to date objects."""
        stats = [
            {"player_id": 1, "date": "2025-09-15", "pa": 5},
            {"player_id": 2, "date": "2025-09-16", "pa": 4},
        ]

        result = convert_date_strings(stats)

        assert result[0]["date"] == date(2025, 9, 15)
        assert result[1]["date"] == date(2025, 9, 16)

    def test_convert_already_date_objects(self):
        """Test that already-converted dates are not re-converted."""
        stats = [{"player_id": 1, "date": date(2025, 9, 15), "pa": 5}]

        result = convert_date_strings(stats)

        # Should still be date object
        assert result[0]["date"] == date(2025, 9, 15)


class TestHitterStatsSeeding:
    """Tests for hitter stats seeding."""

    def test_seed_hitter_stats(self, sync_session, sample_hitter_stats):
        """Test seeding hitter stats into database."""
        # Convert dates
        stats = convert_date_strings(sample_hitter_stats)

        # Mock SessionLocal to return our test session
        with patch("app.scripts.seed_daily_stats.SessionLocal", return_value=sync_session):
            # Seed
            seed_hitter_stats(stats)

        # Verify inserted
        result = sync_session.execute(select(HitterDailyStats)).scalars().all()

        assert len(result) == 2

        # Check first row
        stat1 = next(s for s in result if s.player_id == 1)
        assert stat1.date == date(2025, 9, 15)
        assert stat1.pa == 5
        assert stat1.ab == 4
        assert stat1.h == 3
        assert stat1.hr == 1
        assert stat1.bb == 1

        # Check second row
        stat2 = next(s for s in result if s.player_id == 2)
        assert stat2.date == date(2025, 9, 16)
        assert stat2.pa == 4
        assert stat2.h == 1

    def test_seed_hitter_stats_upsert_overwrites(self, sync_session, sample_hitter_stats):
        """Test that re-seeding updates existing rows."""
        # Convert dates
        stats = convert_date_strings(sample_hitter_stats)

        # Mock SessionLocal to return our test session
        with patch("app.scripts.seed_daily_stats.SessionLocal", return_value=sync_session):
            # Seed first time
            seed_hitter_stats(stats)

            # Verify initial state
            result = sync_session.execute(
                select(HitterDailyStats).where(HitterDailyStats.player_id == 1)
            ).scalar_one()
            assert result.h == 3

            # Modify stats and re-seed
            stats[0]["h"] = 4  # Change hits from 3 to 4
            seed_hitter_stats(stats)

            # Verify updated
            sync_session.expire_all()  # Clear session cache
            result = sync_session.execute(
                select(HitterDailyStats).where(HitterDailyStats.player_id == 1)
            ).scalar_one()
            assert result.h == 4  # Should be updated

    def test_seed_empty_hitter_stats(self):
        """Test seeding with empty list does not error."""
        # Should not raise
        seed_hitter_stats([])


class TestPitcherStatsSeeding:
    """Tests for pitcher stats seeding."""

    def test_seed_pitcher_stats(self, sync_session, sample_pitcher_stats):
        """Test seeding pitcher stats into database."""
        # Convert dates
        stats = convert_date_strings(sample_pitcher_stats)

        # Mock SessionLocal to return our test session
        with patch("app.scripts.seed_daily_stats.SessionLocal", return_value=sync_session):
            # Seed
            seed_pitcher_stats(stats)

        # Verify inserted
        result = sync_session.execute(select(PitcherDailyStats)).scalars().all()

        assert len(result) == 2

        # Check first row
        stat1 = next(s for s in result if s.player_id == 10)
        assert stat1.date == date(2025, 9, 12)
        assert stat1.g == 1
        assert stat1.gs == 1
        assert stat1.ip_outs == 21
        assert stat1.w == 1
        assert stat1.er == 2
        assert stat1.k == 8

        # Check second row
        stat2 = next(s for s in result if s.player_id == 11)
        assert stat2.date == date(2025, 9, 18)
        assert stat2.gs == 0
        assert stat2.gf == 1
        assert stat2.sv == 1

    def test_seed_pitcher_stats_upsert_overwrites(self, sync_session, sample_pitcher_stats):
        """Test that re-seeding updates existing rows."""
        # Convert dates
        stats = convert_date_strings(sample_pitcher_stats)

        # Mock SessionLocal to return our test session
        with patch("app.scripts.seed_daily_stats.SessionLocal", return_value=sync_session):
            # Seed first time
            seed_pitcher_stats(stats)

            # Verify initial state
            result = sync_session.execute(
                select(PitcherDailyStats).where(PitcherDailyStats.player_id == 10)
            ).scalar_one()
            assert result.k == 8

            # Modify stats and re-seed
            stats[0]["k"] = 10  # Change strikeouts from 8 to 10
            seed_pitcher_stats(stats)

            # Verify updated
            sync_session.expire_all()  # Clear session cache
            result = sync_session.execute(
                select(PitcherDailyStats).where(PitcherDailyStats.player_id == 10)
            ).scalar_one()
            assert result.k == 10  # Should be updated

    def test_seed_empty_pitcher_stats(self):
        """Test seeding with empty list does not error."""
        # Should not raise
        seed_pitcher_stats([])
