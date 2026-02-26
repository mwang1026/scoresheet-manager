"""Tests for seed_all orchestration script."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.scripts.seed_all import seed_all


class TestSeedAll:
    """Tests for seed_all orchestration."""

    @pytest.mark.asyncio
    async def test_calls_all_steps_in_order(self):
        """Verify seed_all calls seed_league → import_teams → seed_users → rosters."""
        call_order = []

        async def mock_seed_league():
            call_order.append("seed_league")

        async def mock_import_teams():
            call_order.append("import_teams")

        async def mock_seed_users():
            call_order.append("seed_users")

        mock_settings = type("Settings", (), {
            "SEED_LEAGUE_NAME": "Test League",
        })()

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # No league → skip rosters
        mock_session.execute = AsyncMock(return_value=mock_result)

        with (
            patch("app.scripts.seed_all.seed_league", side_effect=mock_seed_league),
            patch("app.scripts.seed_all.import_teams", side_effect=mock_import_teams),
            patch("app.scripts.seed_all.seed_users", side_effect=mock_seed_users),
            patch("app.config.settings", mock_settings),
            # Mock the lazy import of AsyncSessionLocal inside seed_all
            patch("app.database.AsyncSessionLocal") as mock_factory,
        ):
            mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            await seed_all()

        assert call_order == ["seed_league", "import_teams", "seed_users"]

    @pytest.mark.asyncio
    async def test_roster_scrape_failure_is_non_fatal(self):
        """Roster scrape failure should warn but not crash."""
        async def noop():
            pass

        mock_settings = type("Settings", (), {
            "SEED_LEAGUE_NAME": "Test League",
        })()

        with (
            patch("app.scripts.seed_all.seed_league", side_effect=noop),
            patch("app.scripts.seed_all.import_teams", side_effect=noop),
            patch("app.scripts.seed_all.seed_users", side_effect=noop),
            patch("app.config.settings", mock_settings),
            patch("app.database.AsyncSessionLocal") as mock_factory,
        ):
            # Make the context manager raise
            mock_factory.return_value.__aenter__ = AsyncMock(
                side_effect=Exception("Network error")
            )
            mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            # Should NOT raise — failure is non-fatal
            await seed_all()

    @pytest.mark.asyncio
    async def test_calls_scrape_when_league_has_data_path(self):
        """When league exists and has data_path, scrape_and_persist_rosters is called."""
        async def noop():
            pass

        mock_settings = type("Settings", (), {
            "SEED_LEAGUE_NAME": "Test League",
        })()

        mock_league = MagicMock()
        mock_league.scoresheet_data_path = "FOR_WWW1/Test"

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_league
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_scrape = AsyncMock(return_value={
            "teams_processed": 10,
            "players_added": 5,
            "players_removed": 2,
            "unresolved_pins": 0,
        })

        with (
            patch("app.scripts.seed_all.seed_league", side_effect=noop),
            patch("app.scripts.seed_all.import_teams", side_effect=noop),
            patch("app.scripts.seed_all.seed_users", side_effect=noop),
            patch("app.config.settings", mock_settings),
            patch("app.database.AsyncSessionLocal") as mock_factory,
            patch(
                "app.services.scoresheet_scraper.scrape_and_persist_rosters",
                mock_scrape,
            ),
        ):
            mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            await seed_all()

        mock_scrape.assert_called_once_with(mock_session, mock_league)
