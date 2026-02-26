"""Tests for seed_league script."""

from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models import League
from app.scripts.seed_league import seed_league


class TestSeedLeague:
    """Tests for seed_league async function."""

    @pytest.mark.asyncio
    async def test_creates_league(self, db_session, make_mock_get_session):
        """seed_league creates a league with correct fields."""
        mock_settings = type("Settings", (), {
            "SEED_LEAGUE_NAME": "AL Test League",
            "SEED_LEAGUE_SEASON": 2026,
            "SEED_LEAGUE_DATA_PATH": "FOR_WWW1/AL_Test_League",
        })()

        with (
            patch("app.scripts.seed_league.get_session", make_mock_get_session()),
            patch("app.scripts.seed_league.settings", mock_settings),
        ):
            await seed_league()

        result = await db_session.execute(select(League))
        league = result.scalar_one()

        assert league.name == "AL Test League"
        assert league.season == 2026
        assert league.league_type == "AL"
        assert league.scoresheet_data_path == "FOR_WWW1/AL_Test_League"

    @pytest.mark.asyncio
    async def test_upsert_updates_existing(self, db_session, make_mock_get_session):
        """Second call updates existing league rather than duplicating."""
        mock_settings = type("Settings", (), {
            "SEED_LEAGUE_NAME": "AL Test League",
            "SEED_LEAGUE_SEASON": 2025,
            "SEED_LEAGUE_DATA_PATH": "FOR_WWW1/AL_Test_League",
        })()

        with (
            patch("app.scripts.seed_league.get_session", make_mock_get_session()),
            patch("app.scripts.seed_league.settings", mock_settings),
        ):
            await seed_league()

        # Update season
        mock_settings.SEED_LEAGUE_SEASON = 2026

        with (
            patch("app.scripts.seed_league.get_session", make_mock_get_session()),
            patch("app.scripts.seed_league.settings", mock_settings),
        ):
            await seed_league()

        result = await db_session.execute(select(League))
        leagues = result.scalars().all()
        assert len(leagues) == 1
        assert leagues[0].season == 2026

    @pytest.mark.asyncio
    async def test_unknown_league_type_sets_none(self, db_session, make_mock_get_session):
        """League name that doesn't match any type pattern → league_type=None."""
        mock_settings = type("Settings", (), {
            "SEED_LEAGUE_NAME": "ZZZZZ Unknown Name",
            "SEED_LEAGUE_SEASON": 2026,
            "SEED_LEAGUE_DATA_PATH": "FOR_WWW1/ZZZZZ_Unknown",
        })()

        with (
            patch("app.scripts.seed_league.get_session", make_mock_get_session()),
            patch("app.scripts.seed_league.settings", mock_settings),
        ):
            await seed_league()

        result = await db_session.execute(select(League))
        league = result.scalar_one()
        assert league.league_type is None
